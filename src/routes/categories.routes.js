import express from "express"
import authorise from "../middlewares/authorise.js";
import authenticate from "../middlewares/auth.middleware.js";
import { createCategory, deleteCategory , getCategories} from "../controllers/categories.controller.js";

const router = express.Router();
router.post("/",authenticate,authorise("ADMIN"),createCategory)
router.delete("/:id",authenticate,authorise("ADMIN"),deleteCategory);
router.get("/",getCategories)
export default router;