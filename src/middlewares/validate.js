import AppError from "../utils/AppError.js";

/**
 * Validate request body, query, or params against a Zod schema.
 * @param {import("zod").ZodSchema} schema
 * @param {"body" | "query" | "params"} source - Where to read data from (default: "body")
 */
const validate = (schema, source = "body") => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return next(new AppError(messages.join("; "), 400));
    }

    // Replace with parsed (coerced + defaulted) data
    try {
      req[source] = result.data;
    } catch {
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    next();
  };
};

export default validate;
