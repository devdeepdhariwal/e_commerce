import express from "express"
import { createAddress, getMyAddresses } from "../controllers/address.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.js";
import { createAddressSchema } from "../validations/address.validation.js";

const router = express.Router();

router.post("/", authMiddleware, validate(createAddressSchema), createAddress);
router.get("/", authMiddleware, getMyAddresses);

export default router;