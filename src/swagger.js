import swaggerUi from "swagger-ui-express";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "E-Commerce API",
    version: "1.0.0",
    description:
      "Backend API for the e-commerce platform. PostgreSQL + MongoDB + Redis. JWT bearer auth.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          'Paste the accessToken returned by POST /auth/login. The header sent is: Authorization: Bearer <token>',
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
        },
      },
      RegisterReq: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", maxLength: 100, example: "Jane Doe" },
          email: { type: "string", format: "email", example: "jane@example.com" },
          password: {
            type: "string",
            minLength: 8,
            example: "Secret@123",
            description:
              "Min 8 chars, must include lowercase, uppercase, digit, special char (@$!%*?&)",
          },
        },
      },
      RegisterRes: {
        type: "object",
        properties: {
          message: { type: "string", example: "User registered successfully" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string" },
              isEmailVerified: { type: "boolean" },
            },
          },
        },
      },
      LoginReq: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "jane@example.com" },
          password: { type: "string", example: "Secret@123" },
        },
      },
      LoginRes: {
        type: "object",
        properties: {
          message: { type: "string", example: "Login successful" },
          accessToken: { type: "string" },
        },
      },
      MeRes: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string" },
              isEmailVerified: { type: "boolean" },
              role: { type: "string", enum: ["CUSTOMER", "ADMIN"] },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      SendOtpReq: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      VerifyOtpReq: {
        type: "object",
        required: ["email", "otp"],
        properties: {
          email: { type: "string", format: "email" },
          otp: { type: "string" },
        },
      },
      ForgotPasswordReq: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      ResetPasswordReq: {
        type: "object",
        required: ["email", "token", "newPassword"],
        properties: {
          email: { type: "string", format: "email" },
          token: { type: "string" },
          newPassword: {
            type: "string",
            minLength: 8,
            description:
              "Min 8 chars, must include lowercase, uppercase, digit, special char (@$!%*?&)",
          },
        },
      },
      SuccessMsg: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
        },
      },
      Attribute: {
        type: "object",
        properties: {
          name: { type: "string", example: "Color" },
          value: { type: "string", example: "Black" },
        },
      },
      Variant: {
        type: "object",
        properties: {
          attributes: { type: "array", items: { $ref: "#/components/schemas/Attribute" } },
          price: { type: "number", example: 29.99 },
          stock: { type: "integer", example: 50 },
          sku: { type: "string", example: "TSHIRT-BLK-M" },
        },
      },
      Product: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          categoryId: { type: "string" },
          categoryPath: { type: "array", items: { type: "string" } },
          images: { type: "array", items: { type: "string", format: "uri" } },
          variants: { type: "array", items: { $ref: "#/components/schemas/Variant" } },
          isActive: { type: "boolean" },
          createdBy: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductListRes: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
          pagination: {
            type: "object",
            properties: {
              totalCount: { type: "integer" },
              totalPages: { type: "integer" },
              hasNextPage: { type: "boolean" },
              hasPrevPage: { type: "boolean" },
            },
          },
        },
      },
      Category: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          parentId: { type: "string", nullable: true },
          path: { type: "array", items: { type: "string" } },
          isActive: { type: "boolean" },
        },
      },
      CategoryListRes: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array", items: { $ref: "#/components/schemas/Category" } },
        },
      },
      CartItem: {
        type: "object",
        properties: {
          productId: { type: "string" },
          sku: { type: "string" },
          quantity: { type: "integer" },
          price: { type: "number" },
          name: { type: "string" },
          image: { type: "string", nullable: true },
        },
      },
      CartRes: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
              itemCount: { type: "integer" },
              subtotal: { type: "number" },
            },
          },
        },
      },
      AddToCartReq: {
        type: "object",
        required: ["productId", "sku", "quantity"],
        properties: {
          productId: { type: "string" },
          sku: { type: "string" },
          quantity: { type: "integer", minimum: 1, example: 1 },
        },
      },
      AddToCartRes: {
        type: "object",
        properties: {
          message: { type: "string", example: "Product added sucessfully" },
          success: { type: "boolean" },
          item: { $ref: "#/components/schemas/CartItem" },
        },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description: "Creates a user and sends an OTP email for verification.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterReq" } } },
        },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRes" } } } },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          429: { description: "Rate limited" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description:
          "Returns an accessToken in the JSON body and sets an httpOnly refreshToken cookie.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginReq" } } },
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRes" } } } },
          400: { description: "Validation error" },
          401: { description: "Invalid credentials" },
          429: { description: "Rate limited" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/MeRes" } } } },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        description: "Blacklists the access token and deletes the refresh token.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMsg" } } } },
          400: { description: "Tokens required" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/auth/refresh-token": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        description: "Uses the httpOnly refreshToken cookie. Returns a new accessToken.",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { accessToken: { type: "string" } },
                },
              },
            },
          },
          401: { description: "Invalid / expired refresh token" },
        },
      },
    },
    "/auth/send-otp": {
      post: {
        tags: ["Auth"],
        summary: "Send OTP email",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SendOtpReq" } } },
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMsg" } } } },
          429: { description: "Rate limited" },
        },
      },
    },
    "/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyOtpReq" } } },
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMsg" } } } },
          429: { description: "Rate limited" },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset",
        description: "Sends a reset link/token to the user's email.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordReq" } } },
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMsg" } } } },
          429: { description: "Rate limited" },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with token",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordReq" } } },
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMsg" } } } },
          400: { description: "Invalid token or validation error" },
        },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        summary: "List products (paginated)",
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 10, maximum: 100 } },
          { in: "query", name: "name", schema: { type: "string" }, description: "Search by name (Atlas fuzzy)" },
          { in: "query", name: "category", schema: { type: "string" }, description: "Category slug" },
          { in: "query", name: "minPrice", schema: { type: "number" } },
          { in: "query", name: "maxPrice", schema: { type: "number" } },
          { in: "query", name: "cursor", schema: { type: "string" }, description: "Cursor-based pagination (only without name search)" },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ProductListRes" } } } },
        },
      },
    },
    "/products/{slug}": {
      get: {
        tags: ["Products"],
        summary: "Get product by slug",
        parameters: [{ in: "path", name: "slug", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    product: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
          404: { description: "Not found" },
        },
      },
    },
    "/categories": {
      get: {
        tags: ["Categories"],
        summary: "List all categories",
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryListRes" } } } },
        },
      },
    },
    "/cart": {
      get: {
        tags: ["Cart"],
        summary: "Get current user's cart",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/CartRes" } } } },
          401: { description: "Unauthorized" },
        },
      },
      delete: {
        tags: ["Cart"],
        summary: "Clear entire cart",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/CartRes" } } } },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/cart/add": {
      post: {
        tags: ["Cart"],
        summary: "Add item to cart",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AddToCartReq" } } },
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/AddToCartRes" } } } },
          400: { description: "Validation / stock error" },
          401: { description: "Unauthorized" },
          404: { description: "Product / variant not found" },
        },
      },
    },
    "/cart/item/{productId}/{sku}": {
      delete: {
        tags: ["Cart"],
        summary: "Remove one item from cart",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "path", name: "productId", required: true, schema: { type: "string" } },
          { in: "path", name: "sku", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "OK — returns updated cart", content: { "application/json": { schema: { $ref: "#/components/schemas/CartRes" } } } },
          401: { description: "Unauthorized" },
          404: { description: "Item not in cart" },
        },
      },
    },
    "/cart/revalidate": {
      post: {
        tags: ["Cart"],
        summary: "Revalidate cart (sync prices & stock)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        cart: { $ref: "#/components/schemas/CartRes/properties/data" },
                        pricesChanged: { type: "boolean" },
                        stockAdjusted: { type: "boolean" },
                        removed: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Cart is empty" },
          401: { description: "Unauthorized" },
        },
      },
    },
  },
};

/**
 * Mount Swagger UI on the Express app at /docs.
 * Injects a relaxed CSP just for the /docs route so Swagger assets load.
 */
export function mountSwagger(app) {
  const swaggerCsp = (_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
    );
    next();
  };

  app.use("/docs", swaggerCsp, swaggerUi.serve, swaggerUi.setup(spec));
}
