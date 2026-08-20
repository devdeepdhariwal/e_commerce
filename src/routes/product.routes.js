import express from "express"
import authorise from "../middlewares/authorise.js";
import authenticate from "../middlewares/auth.middleware.js";
import { createProduct , getProduct, getProductBySlug, updateProduct, deleteProduct} from "../controllers/product.controller.js";
import { cacheMiddleware } from "../middlewares/cache.js";
import { productsKey, skipProductListCache } from "../utils/cacheKeys.js";

const PRODUCT_LIST_TTL = 10 * 60;

const router = express.Router();
router.post("/",authenticate,authorise("ADMIN"),createProduct)
router.get(
  "/",
  cacheMiddleware(PRODUCT_LIST_TTL, {
    keyFn: () => productsKey(),
    skipFn: (req) => skipProductListCache(req.query),
  }),
  getProduct,
);
router.get("/:slug", getProductBySlug );
router.put("/:id",authenticate,authorise("ADMIN"),updateProduct);
router.delete("/:id",authenticate,authorise("ADMIN"),deleteProduct);

export default router;