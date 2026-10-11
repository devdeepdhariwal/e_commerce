import prisma from "../config/db.js";
import AppError from "../utils/AppError.js";
import product from "../models/product.model.js";
import { deleteCart } from "./cart.service.js";

export const handlePayment = async(event) =>{
 const razorpayOrderId = event.payload.payment.entity.order_id;
 const order = await prisma.order.findUnique({
    where : {
        razorpayOrderId : razorpayOrderId,
    },
    include: {
    items: true,
  },
 })

 if(!order){
    throw new AppError("order not found",404);
 }

const userId = order.userId;

 if(event.event == "payment.captured"){
    const razorpayPaymentId = event.payload.payment.entity.id;
    if (order.status === "PAID") {
      return;
    }
    if (order.status !== "PENDING") {
      console.warn(
        `payment.captured for non-pending order ${order.id} payment ${razorpayPaymentId}; manual refund required`
      );
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });
      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          status: "CAPTURED",
          razorpayPaymentId,
        },
      });
    });
   try {
      await deleteCart(userId);
    } catch (err) {
      console.error("Failed to clear cart after payment for user", userId, err);
    }
 }

 if(event.event == "payment.failed"){
    const razorpayPaymentId = event.payload.payment.entity.id;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
        },
      });

      if (updated.count === 0) {
        return updated;
      }

      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: {
          status: "FAILED",
          razorpayPaymentId,
        },
      });

      return updated;
    });

    if (result.count === 0) {
      return;
    }

    for (const item of order.items) {
      await product.updateOne(
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
 }
 

                                            }
