import { z } from "zod";

const attributeSchema = z.object({
  name: z.string().min(1, "Attribute name is required"),
  value: z.string().min(1, "Attribute value is required"),
});

const variantSchema = z.object({
  attributes: z.array(attributeSchema).min(1, "At least one attribute is required"),
  price: z.number().nonnegative("Price must be >= 0"),
  stock: z.number().int().nonnegative("Stock must be >= 0").default(0),
  sku: z.string().min(1, "SKU is required"),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  description: z.string().min(1, "Description is required").max(5000),
  categoryId: z.string().min(1, "Category ID is required"),
  images: z.array(z.string().url("Each image must be a valid URL")).default([]),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  categoryId: z.string().min(1).optional(),
  images: z.array(z.string().url()).optional(),
  variants: z.array(variantSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  page: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return 1;
    const n = Number(val);
    return isNaN(n) || n < 1 ? 1 : Math.floor(n);
  }, z.number().int().default(1)),
  limit: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return 10;
    const n = Number(val);
    if (isNaN(n) || n < 1) return 10;
    if (n > 100) return 100;
    return Math.floor(n);
  }, z.number().int().default(10)),
  name: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  cursor: z.string().optional(),
}).passthrough(); // allow attr_* filters through
