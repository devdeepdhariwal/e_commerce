import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("POST /webhooks/razorpay signature", () => {
  it("rejects a missing signature header", async () => {
    const res = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ event: "payment.captured" }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("signature missing");
  });

  it("rejects an invalid signature", async () => {
    const res = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "a".repeat(64))
      .send(JSON.stringify({ event: "payment.captured" }));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("invalid signature");
  });
});
