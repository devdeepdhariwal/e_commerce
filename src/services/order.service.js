import crypto from "crypto";
import AppError from "../utils/AppError.js";
import { revalidateCart } from "./cart.service.js";
import prisma from "../config/db.js";
import Product from "../models/product.model.js";
import razorpay from "../config/razorpay.js";
import Redis from "../config/redis.js";

// Delete the lock only when it still belongs to this request. A checkout that
// outlives the 30s TTL must not remove a lock a later request has acquired.
const RELEASE_CHECKOUT_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export const checkout = async (userId, addressId) => {
  if (!addressId) {
    throw new AppError("AddressId is required", 400);
  }

  const lockKey = `checkout_lock:${userId}`;
  const lockToken = crypto.randomUUID();
  const acquired = await Redis.set(lockKey, lockToken, "EX", 30, "NX");

  if (acquired !== "OK") {
    throw new AppError("Checkout already in progress", 409);
  }

  try {
    const existingPending = await prisma.order.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true },
    });
    if (existingPending) {
      throw new AppError(
        `You already have a pending order (${existingPending.id}). Pay for it or cancel it first.`,
        409
      );
    }

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
        image: variant.images?.[0] ?? "",
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
    await Redis.eval(RELEASE_CHECKOUT_LOCK, 1, lockKey, lockToken);
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

  const cancelled = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    if (result.count === 0) {
      throw new AppError("Order cannot be cancelled", 400);
    }

    await tx.payment.updateMany({
      where: { orderId },
      data: { status: "FAILED" },
    });

    return tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
  });

  // Restore inventory only after the status change commits.
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