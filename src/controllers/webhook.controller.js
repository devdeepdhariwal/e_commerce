import crypto from "crypto";
import { handlePayment } from "../services/webhook.service.js";

export const webhookHandler = async (req, res) => {
  const razorpaySignature = req.headers["x-razorpay-signature"];
  if (!razorpaySignature) {
    return res.status(400).json({ message: "signature missing" });
  }
  
  const receivedBuffer = Buffer.from(razorpaySignature, "hex");
  const rawBody = req.body;

  const computedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const computedBuffer = Buffer.from(computedSignature, "hex");

  if (computedBuffer.length !== receivedBuffer.length) {
    return res.status(400).json({ message: "invalid signature" });
  }

  if (!crypto.timingSafeEqual(computedBuffer, receivedBuffer)) {
    return res.status(400).json({ message: "invalid signature" });
  }

  const event = JSON.parse(rawBody.toString());

  if (event.event !== "payment.captured" && event.event !== "payment.failed") {
    return res.status(200).json({ ok: true });
  }

  try {
    await handlePayment(event);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return res.status(500).json({ message: "internal error" });
  }
};