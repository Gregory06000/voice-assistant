// src/lib/catalogSchema.ts
import { z } from "zod";

export const VariantSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1), // "S", "M", "L", "41", "42"...
  price: z.number().nonnegative(),
  currency: z.string().min(3).max(3), // "EUR"
  available: z.boolean().optional().default(true),
});

export const ProductSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  image: z.string().url().optional(), // sera normalisé si relatif
  tags: z.array(z.string()).default([]),
  variants: z.array(VariantSchema).min(1),
});

export const CatalogArraySchema = z.array(ProductSchema);
export const CatalogWrappedSchema = z.object({ products: CatalogArraySchema });

export type Variant = z.infer<typeof VariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
