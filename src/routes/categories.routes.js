import express from "express"
import authorise from "../middlewares/authorise.js";
import authenticate from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.js";
import { createCategorySchema } from "../validations/category.validation.js";
import { createCategory, deleteCategory, getCategories } from "../controllers/categories.controller.js";
import { cacheMiddleware } from "../middlewares/cache.js";
import { categoriesKey } from "../utils/cacheKeys.js";

const CATEGORIES_TTL = 30 * 60;

const router = express.Router();
router.post("/", authenticate, authorise("ADMIN"), validate(createCategorySchema), createCategory);
router.delete("/:id", authenticate, authorise("ADMIN"), deleteCategory);
router.get(
  "/",
  cacheMiddleware(CATEGORIES_TTL, {
    keyFn: () => categoriesKey(),
  }),
  getCategories,
)
export default router;