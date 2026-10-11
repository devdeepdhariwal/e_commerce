import crypto from "crypto";
import env from "../config/env.js";
import redis from "../config/redis.js";
import { handlePayment } from "../services/webhook.service.js";

const WEBHOOK_EVENT_TTL_SECONDS = 86400;

export const webhookHandler = async (req, res) => {
  const razorpaySignature = req.headers["x-razorpay-signature"];
  if (!razorpaySignature) {
    return res.status(400).json({ message: "signature missing" });
  }

  const receivedBuffer = Buffer.from(razorpaySignature, "hex");
  const rawBody = req.body;

  const computedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const computedBuffer = Buffer.from(computedSignature, "hex");

  if (
    computedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(computedBuffer, receivedBuffer)
  ) {
    return res.status(401).json({ message: "invalid signature" });
  }

  const event = JSON.parse(rawBody.toString());

  if (event.event !== "payment.captured" && event.event !== "payment.failed") {
    return res.status(200).json({ ok: true });
  }

  const headerEventId = req.headers["x-razorpay-event-id"];
  const paymentId = event.payload?.payment?.entity?.id;
  const eventId = headerEventId || `${event.event}:${paymentId}`;
  const dedupeKey = `webhook_event:${eventId}`;

  const acquired = await redis.set(dedupeKey, "1", "EX", WEBHOOK_EVENT_TTL_SECONDS, "NX");
  if (acquired !== "OK") {
    return res.status(200).json({ ok: true });
  }

  try {
    await handlePayment(event);
    return res.status(200).json({ ok: true });
  } catch (error) {
    await redis.del(dedupeKey);
    console.error("Webhook processing failed:", error);
    return res.status(500).json({ message: "internal error" });
  }
};