import express from "express"
import authorise from "../middlewares/authorise.js";
import authenticate from "../middlewares/auth.middleware.js";
import { createProduct , getProduct, getProductBySlug, updateProduct, deleteProduct} from "../controllers/product.controller.js";



const router = express.Router();
router.post("/",authenticate,authorise("ADMIN"),createProduct)
router.get("/",getProduct);
router.get("/:slug", getProductBySlug );
router.put("/:id",authenticate,authorise("ADMIN"),updateProduct);
router.delete("/:id",authenticate,authorise("ADMIN"),deleteProduct);

export default router;