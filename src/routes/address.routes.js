import express from "express"
import { createAddress , getMyAddresses} from "../controllers/address.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
const router = express.Router();


router.post("/",authMiddleware,createAddress);
router.get("/",authMiddleware,getMyAddresses);

export default router;