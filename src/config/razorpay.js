import Razorpay from "razorpay";

const isTest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

let client = null;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  if (!isTest) {
    throw new Error("Razorpay key_id and key_secret are required");
  }
  // In test mode, skip Razorpay initialization
  console.warn("⚠️  Razorpay keys missing — checkout tests will be skipped");
} else {
  client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export default client;