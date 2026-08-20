import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { addtocart , deleteCart, deleteCartItem, getCart, revalidateCart} from "../controllers/cart.controller.js";
const router = express.Router();

router.post("/add",authMiddleware,addtocart)
router.post("/revalidate",authMiddleware,revalidateCart)
router.get("/",authMiddleware,getCart)
router.delete("/item/:productId/:sku",authMiddleware,deleteCartItem)
router.delete("/",authMiddleware,deleteCart)

export default router