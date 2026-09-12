import * as orderService from "../services/order.service.js";
import AppError from "../utils/AppError.js";

export const checkoutOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.body;

    if (!addressId) {
      throw new AppError("addressId is required", 400);
    }

    const result = await orderService.checkout(userId, addressId);
    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!id) {
      throw new AppError("Order ID is required", 400);
    }

    const order = await orderService.getOrderById(userId, id);
    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const result = await orderService.getOrdersByUser(userId, { page, limit });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!id) {
      throw new AppError("Order ID is required", 400);
    }

    const order = await orderService.cancelOrder(userId, id);
    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
