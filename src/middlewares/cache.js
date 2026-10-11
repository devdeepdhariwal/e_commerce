import redis from "../config/redis.js";
import { categoriesKey, productsKey } from "../utils/cacheKeys.js";

export const cacheMiddleware = (ttlSeconds, { keyFn, skipFn } = {}) => {
  return async (req, res, next) => {
    if (process.env.VITEST === "true") {
      return next();
    }

    try {
      if (skipFn?.(req)) {
        return next();
      }

      const key = keyFn(req);
      const hit = await redis.get(key);

      if (hit) {
        res.set("X-Cache", "HIT");
        return res.status(200).json(JSON.parse(hit));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        res.json = originalJson;
        if (res.statusCode === 200 || res.statusCode === 304) {
          redis.set(key, JSON.stringify(body), "EX", ttlSeconds).catch((err) => {
            console.error("cache set failed:", err.message);
          });
        }
        res.set("X-Cache", "MISS");
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error("cache middleware failed open:", err.message);
      next();
    }
  };
};

async function deleteKeysByPattern(pattern) {
  let cursor = "0";
  let deleted = 0;

  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = String(next);
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return deleted;
}

export const invalidateProductListCache = async () => {
  try {
    const deleted = await deleteKeysByPattern("cache:products*");
    if (deleted === 0) {
      await redis.del(productsKey());
    }
  } catch (err) {
    console.error("product list cache invalidate failed:", err.message);
  }
};

export const invalidateCategoriesCache = async () => {
  try {
    await redis.del(categoriesKey());
    await invalidateProductListCache();
  } catch (err) {
    console.error("category cache invalidate failed:", err.message);
  }
};
