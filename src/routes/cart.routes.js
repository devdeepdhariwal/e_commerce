import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.js";
import { addToCartSchema } from "../validations/cart.validation.js";
import { addtocart, deleteCart, deleteCartItem, getCart, revalidateCart } from "../controllers/cart.controller.js";

const router = express.Router();

router.post("/add", authMiddleware, validate(addToCartSchema), addtocart);
router.post("/revalidate", authMiddleware, revalidateCart);
router.get("/", authMiddleware, getCart);
router.delete("/item/:productId/:sku", authMiddleware, deleteCartItem);
router.delete("/", authMiddleware, deleteCart);

export default router;