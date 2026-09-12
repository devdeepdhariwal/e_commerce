import { z } from "zod";

export const createAddressSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  phone: z.string().min(1, "Phone is required").max(20),
  line1: z.string().min(1, "Address line 1 is required").max(200),
  line2: z.string().max(200).optional().default(""),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
});
