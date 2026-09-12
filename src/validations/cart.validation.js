import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
});
