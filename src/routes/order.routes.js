import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.js";
import { checkoutSchema, orderQuerySchema } from "../validations/order.validation.js";
import { checkoutOrder, getOrder, listOrders, cancelOrder } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/checkout", authMiddleware, validate(checkoutSchema), checkoutOrder);
router.get("/", authMiddleware, validate(orderQuerySchema, "query"), listOrders);
router.get("/:id", authMiddleware, getOrder);
router.post("/:id/cancel", authMiddleware, cancelOrder);

export default router;
