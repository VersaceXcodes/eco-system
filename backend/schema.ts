import { z } from 'zod';

// ======================
// USERS SCHEMAS
// ======================

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  full_name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createUserInputSchema = z.object({
  email: z.string().email().min(1).max(255),
  password_hash: z.string().min(8).max(255),
  full_name: z.string().min(1).max(100)
});

export const updateUserInputSchema = z.object({
  id: z.string(),
  email: z.string().email().min(1).max(255).optional(),
  password_hash: z.string().min(8).max(255).optional(),
  full_name: z.string().min(1).max(100).optional()
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['id', 'email', 'full_name', 'created_at', 'updated_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// inferred types
export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;


// ======================
// PRODUCTS SCHEMAS
// ======================

const productCategoryEnum = z.enum([
  'electronics',
  'clothing',
  'home',
  'fitness',
  'kitchen',
  'sports',
  'office'
]);

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().min(0),
  image_url: z.string().url(),
  category: productCategoryEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createProductInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  price: z.number().min(0).max(1000000),
  image_url: z.string().url().max(512),
  category: productCategoryEnum
});

export const updateProductInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  price: z.number().min(0).max(1000000).optional(),
  image_url: z.string().url().max(512).optional(),
  category: productCategoryEnum.optional()
});

export const searchProductInputSchema = z.object({
  query: z.string().optional(),
  category: productCategoryEnum.optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['id', 'name', 'price', 'category', 'created_at', 'updated_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// inferred types
export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
export type SearchProductInput = z.infer<typeof searchProductInputSchema>;


// ======================
// ORDERS SCHEMAS
// ======================

const orderStatusEnum = z.enum([
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
]);

export const orderSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  status: orderStatusEnum,
  total_amount: z.number().min(0),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createOrderInputSchema = z.object({
  user_id: z.string().min(1),
  status: orderStatusEnum,
  total_amount: z.number().min(0).max(1000000)
});

export const updateOrderInputSchema = z.object({
  id: z.string(),
  status: orderStatusEnum.optional(),
  total_amount: z.number().min(0).max(1000000).optional()
});

export const searchOrderInputSchema = z.object({
  query: z.string().optional(),
  user_id: z.string().optional(),
  status: orderStatusEnum.optional(),
  min_total: z.number().min(0).optional(),
  max_total: z.number().min(0).optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['id', 'user_id', 'status', 'total_amount', 'created_at', 'updated_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// inferred types
export type Order = z.infer<typeof orderSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type SearchOrderInput = z.infer<typeof searchOrderInputSchema>;


// ======================
// ORDER ITEMS SCHEMAS
// ======================

export const orderItemSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  product_id: z.string(),
  quantity: z.number().int().min(1),
  price_at_time: z.number().min(0),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createOrderItemInputSchema = z.object({
  order_id: z.string().min(1),
  product_id: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  price_at_time: z.number().min(0).max(1000000)
});

export const updateOrderItemInputSchema = z.object({
  id: z.string(),
  order_id: z.string().min(1).optional(),
  product_id: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  price_at_time: z.number().min(0).max(1000000).optional()
});

export const searchOrderItemInputSchema = z.object({
  query: z.string().optional(),
  order_id: z.string().optional(),
  product_id: z.string().optional(),
  min_quantity: z.number().int().min(1).optional(),
  max_quantity: z.number().int().min(1).optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum([
    'id', 
    'order_id', 
    'product_id', 
    'quantity', 
    'price_at_time', 
    'created_at', 
    'updated_at'
  ]).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// inferred types
export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemInputSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemInputSchema>;
export type SearchOrderItemInput = z.infer<typeof searchOrderItemInputSchema>;