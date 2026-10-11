You have my full e-commerce backend codebase (Node, Express 5, Prisma/PostgreSQL,
Mongoose/MongoDB, Redis/ioredis, Razorpay, Vitest + Supertest). Implement the
fixes below IN ORDER.

RULES
- Keep diffs minimal. Do not refactor unrelated code. Keep ES module style.
- Run `npm test` after each fix. All existing tests (93) must keep passing.
- Add tests for each fix as described.
- Do NOT change this intentional design: the cart is cleared only after
  payment.captured, not at checkout. Do not "fix" that.
- Never invent numbers. Report only what you actually run.
- If something I describe doesn't match the code, tell me instead of guessing.

FIX 1: Webhook secret (security)
- In src/config/env.js, make RAZORPAY_WEBHOOK_SECRET required and non-empty
  (min length 1) instead of defaulting to "". The app must fail fast at boot
  if it is missing.
- In webhook.controller.js, read the secret from the validated env object,
  not process.env. Return 400 if the signature header is missing, and 401
  if the signature is invalid.
- Make sure the test environment sets a dummy secret so tests still pass.
- Add a test: a webhook with an invalid signature is rejected, and one with
  a missing signature header is rejected.

FIX 2: Prevent duplicate PENDING orders (stock is deducted at checkout, and
the cart stays full until payment, so a second checkout can deduct stock again)
- In src/services/order.service.js checkout(), inside the try block, as the
  FIRST step after the lock is acquired and before revalidateCart, add:

    const existingPending = await prisma.order.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true },
    });
    if (existingPending) {
      throw new AppError(
        `You already have a pending order (${existingPending.id}). Pay for it or cancel it first.`,
        409
      );
    }

- Add tests: (a) a second checkout while an order is PENDING returns 409 and
  stock was deducted only once; (b) after cancelling the pending order,
  checkout succeeds again; (c) the cart is still intact while an order is
  pending or after a failed payment, and is cleared only after payment.captured.

FIX 2b: Make cancelOrder atomic (currently the status check is outside the
transaction, so two concurrent cancels can both restore stock)
- In cancelOrder, replace the read-then-check-then-update with an
  order.updateMany({ where: { id: orderId, userId, status: "PENDING" },
  data: { status: "CANCELLED" } }) INSIDE the prisma.$transaction. If
  result.count === 0, throw AppError("Order cannot be cancelled", 400).
- In the same transaction, mark the payment FAILED (use updateMany on the
  payment by order id, matching my actual Prisma field names).
- Restore MongoDB stock only AFTER the transaction commits, and only for the
  caller whose update succeeded.
- Keep the 404 behavior when the order doesn't exist or belongs to another
  user.
- Add a test: two concurrent cancel requests for the same order restore
  stock exactly once and one of them gets a 400.

FIX 2c: Webhook vs non-pending orders
- In webhook.service.js, if payment.captured arrives for an order whose
  status is not PENDING (for example CANCELLED), do NOT mark it PAID and do
  NOT touch stock. Log a warning including order id and payment id so it
  can be refunded manually, and return 200 so Razorpay stops retrying.
- Add a test for a captured payment on a CANCELLED order: order stays
  CANCELLED, stock unchanged.

FIX 3: payment.failed webhook must be atomic
- In webhook.service.js, wrap the payment.failed path in ONE
  prisma.$transaction: order status update + payment status update together,
  the same way payment.captured already does. Use a status-guarded
  updateMany (only PENDING orders move to FAILED).
- Do the MongoDB stock rollback only AFTER the transaction commits, only if
  the guarded update actually changed a row, so stock can never be restored
  twice.
- Add a test: order becomes FAILED, payment updated, stock restored exactly
  once even if the same failed webhook is delivered twice.

FIX 4: Webhook event deduplication
- Before processing, take the Razorpay event ID from header
  x-razorpay-event-id (fall back to `${event}:${payment.entity.id}` if the
  header is absent) and run:
    SET webhook_event:<id> "1" EX 86400 NX
  If it already exists, return 200 immediately without processing.
- If processing throws, delete that key so Razorpay's retry can succeed.
- Do this AFTER signature verification, never before.
- Add a test: sending the same event twice processes it only once.

FIX 5: Replace redis.keys with SCAN
- In src/middlewares/cache.js, replace every redis.keys(...) used for
  invalidation with a non-blocking SCAN loop (cursor, COUNT 100), deleting
  matches in batches. Keep the same exported function names and behavior.
- Search the whole codebase for any other redis.keys usage and fix it too.
- Add or adjust a test confirming product cache invalidation still works.

FIX 6 (optional, do it if time allows): Safe checkout lock release
- In checkout(), store a random token (crypto.randomUUID()) as the lock
  value instead of "1". In the finally block, release the lock only if the
  stored value still equals this request's token, using a small Lua script
  via redis.eval (compare-and-delete). Keep the 30 second TTL.
- Add a test or a short comment explaining why (a slow request must not
  delete another request's lock).

FIX 7: README accuracy
- Change "daily rotation" to "size-based rotation (5 MB, 5 files)".
- Replace every "100% test coverage" with "N/N tests passing", using the
  real count after the new tests.
- Add a "Known limitations" section with these points:
  * A process crash mid-checkout after stock deduction can leave stock
    deducted until reconciled (a saga or reconciliation job is the fix).
  * Unpaid PENDING orders are not auto-expired; a TTL-based cleanup job is
    the planned fix.
  * Cross-user stock safety relies on the atomic MongoDB $gte guard, not on
    the per-user checkout lock.
- Add a "Recent fixes" section with one line per fix (1, 2, 2b, 2c, 3, 4, 5,
  and 6 if done).
- Do not make any claim in the README that the code doesn't back up.

BENCHMARK (after all fixes pass tests)
- Add autocannon as a devDependency. Create scripts/cache_benchmark.js.
- Read the port from my env/config instead of hardcoding it.
- Make sure the database has seeded products first (run
  node src/seedProduct.js if the collection is empty).
- Cold cache: delete ALL keys matching cache:products* using SCAN (not a
  single hardcoded key), then run a 10 second test with 10 connections.
- Warm cache: run the exact same URL again immediately after, same settings.
- Repeat the cold/warm pair 3 times and report the average of the runs.
- Start the server yourself if it isn't running, and shut it down afterwards.
- Print and save to docs/benchmark.md: average latency, p95 latency and
  requests/sec for cold and warm, machine specs, seeded product count, and
  the exact commands used.
- If the benchmark cannot run (missing credentials, DB down), say exactly why
  and do not estimate any numbers.

FINAL REPORT
Give me:
1. Files changed per fix, as a short list.
2. The final `npm test` output.
3. The real benchmark table.
4. Anything in my code that contradicted what I described above.
5. One resume sentence of the form "Reduced product listing latency from
   X ms to Y ms (avg) with Redis caching", using only measured numbers.