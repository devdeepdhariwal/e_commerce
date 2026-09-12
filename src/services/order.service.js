import AppError from "../utils/AppError.js";
import { revalidateCart } from "./cart.service.js";
import prisma from "../config/db.js";
import Product from "../models/product.model.js";
import razorpay from "../config/razorpay.js";
import Redis from "../config/redis.js";

export const checkout = async (userId, addressId) => {
  if (!addressId) {
    throw new AppError("AddressId is required", 400);
  }

  const lockKey = `checkout_lock:${userId}`;
  const acquired = await Redis.set(lockKey, "1", "EX", 30, "NX");

  if (acquired !== "OK") {
    throw new AppError("Checkout already in progress", 409);
  }

  try {
    const { cart, pricesChanged, stockAdjusted, removed } =
      await revalidateCart(userId);

    if (pricesChanged || stockAdjusted || removed.length > 0) {
      throw new AppError("Cart changed, please confirm", 409);
    }

    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!address) {
      throw new AppError("Address not found", 404);
    }

    const lines = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        throw new AppError("Cart changed, please confirm", 409);
      }

      const variant = product.variants.find((v) => v.sku === item.sku);

      if (!variant) {
        throw new AppError("Cart changed, please confirm", 409);
      }

      if (variant.stock < item.quantity || variant.price !== item.price) {
        throw new AppError("Cart changed, please confirm", 409);
      }

      lines.push({
        productId: product._id.toString(),
        sku: variant.sku,
        name: product.name,
        price: variant.price,
        quantity: item.quantity,
        image: variant.images[0] ?? "",
      });
    }

    const total = lines.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0
    );

    const deducted = [];

    for (const line of lines) {
      const result = await Product.updateOne(
        {
          _id: line.productId,
          "variants.sku": line.sku,
          "variants.stock": { $gte: line.quantity },
        },
        {
          $inc: {
            "variants.$.stock": -line.quantity,
          },
        }
      );

      if (result.modifiedCount === 0) {
        for (const item of deducted) {
          await Product.updateOne(
            {
              _id: item.productId,
              "variants.sku": item.sku,
            },
            {
              $inc: {
                "variants.$.stock": item.quantity,
              },
            }
          );
        }

        throw new AppError("Item out of stock", 409);
      }

      deducted.push(line);
    }

    try {
      const amount = Math.round(total * 100);

      const razorpayOrder = await razorpay.orders.create({
        amount,
        currency: "INR",
      });

      const order = await prisma.$transaction(async (tx) => {
        return tx.order.create({
          data: {
            userId,
            addressId: address.id,
            status: "PENDING",
            totalAmount: total,
            razorpayOrderId: razorpayOrder.id,
            shipFullName: address.fullName,
            shipPhone: address.phone,
            shipLine1: address.line1,
            shipLine2: address.line2,
            shipCity: address.city,
            shipState: address.state,
            shipPostalCode: address.postalCode,
            shipCountry: address.country,
            items: {
              create: lines,
            },
            payment: {
              create: {
                razorpayOrderId: razorpayOrder.id,
                amount: total,
              },
            },
          },
          include: {
            items: true,
            payment: true,
          },
        });
      });

      return {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency: "INR",
      };
    } catch (error) {
      for (const item of deducted) {
        await Product.updateOne(
          {
            _id: item.productId,
            "variants.sku": item.sku,
          },
          {
            $inc: {
              "variants.$.stock": item.quantity,
            },
          }
        );
      }

      throw error;
    }
  } finally {
    await Redis.del(lockKey);
  }
};

export const getOrderById = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payment: true,
    },
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.userId !== userId) {
    throw new AppError("Order not found", 404);
  }

  return order;
};

export const getOrdersByUser = async (userId, { page, limit }) => {
  const skip = (page - 1) * limit;

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payment: {
          select: {
            id: true,
            status: true,
            razorpayPaymentId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return {
    orders,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
  };
};

export const cancelOrder = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.userId !== userId) {
    throw new AppError("Order not found", 404);
  }

  if (order.status !== "PENDING") {
    throw new AppError(
      `Cannot cancel order with status ${order.status}`,
      400
    );
  }

  // Update order status + payment status in a transaction
  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
      include: { items: true, payment: true },
    });

    if (updated.payment) {
      await tx.payment.update({
        where: { id: updated.payment.id },
        data: { status: "FAILED" },
      });
    }

    return updated;
  });

  // Restore inventory in MongoDB
  for (const item of cancelled.items) {
    await Product.updateOne(
      {
        _id: item.productId,
        "variants.sku": item.sku,
      },
      {
        $inc: {
          "variants.$.stock": item.quantity,
        },
      }
    );
  }

  return cancelled;
};