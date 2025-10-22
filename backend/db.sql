-- Create tables in dependency order (users first, then products, then orders, then order_items)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    image_url TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time NUMERIC(10,2) NOT NULL CHECK (price_at_time >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed users table (5 users with plain-text passwords for testing)
INSERT INTO users (id, email, password_hash, full_name) VALUES
('user_1', 'alice@example.com', 'password123', 'Alice Johnson'),
('user_2', 'bob@example.com', 'password123', 'Bob Smith'),
('user_3', 'charlie@example.com', 'password123', 'Charlie Brown'),
('user_4', 'diana@example.com', 'admin123', 'Diana Williams'),
('user_5', 'eve@example.com', 'user123', 'Eve Davis');

-- Seed products table (10 products with Picsum Photos URLs)
INSERT INTO products (id, name, description, price, image_url, category) VALUES
('prod_1', 'Wireless Headphones', 'Noise-cancelling over-ear headphones with 30hr battery', 199.99, 'https://picsum.photos/seed/1001/800/600', 'electronics'),
('prod_2', 'Organic T-Shirt', '100% organic cotton t-shirt available in multiple colors', 24.99, 'https://picsum.photos/seed/1002/800/600', 'clothing'),
('prod_3', 'Stainless Steel Water Bottle', 'Insulated 20oz water bottle keeps drinks cold for 24hrs', 29.99, 'https://picsum.photos/seed/1003/800/600', 'home'),
('prod_4', 'Yoga Mat', 'Extra thick non-slip yoga mat with carrying strap', 34.99, 'https://picsum.photos/seed/1004/800/600', 'fitness'),
('prod_5', 'Coffee Maker', 'Programmable 12-cup coffee maker with timer', 79.99, 'https://picsum.photos/seed/1005/800/600', 'kitchen'),
('prod_6', 'Running Shoes', 'Lightweight running shoes with responsive cushioning', 89.99, 'https://picsum.photos/seed/1006/800/600', 'sports'),
('prod_7', 'Bluetooth Speaker', 'Portable waterproof speaker with 12hr playtime', 49.99, 'https://picsum.photos/seed/1007/800/600', 'electronics'),
('prod_8', 'Ceramic Dinner Set', '16-piece stoneware dinnerware set', 129.99, 'https://picsum.photos/seed/1008/800/600', 'kitchen'),
('prod_9', 'Smart Watch', 'Fitness tracker with heart rate monitor and GPS', 149.99, 'https://picsum.photos/seed/1009/800/600', 'electronics'),
('prod_10', 'Eco-Friendly Notebook', 'Recycled paper notebook with 120 pages', 12.99, 'https://picsum.photos/seed/1010/800/600', 'office');

-- Seed orders table (20 orders distributed across users)
INSERT INTO orders (id, user_id, status, total_amount) VALUES
('order_1', 'user_1', 'delivered', 234.98),
('order_2', 'user_1', 'shipped', 129.98),
('order_3', 'user_1', 'processing', 89.99),
('order_4', 'user_1', 'pending', 49.99),
('order_5', 'user_2', 'delivered', 229.98),
('order_6', 'user_2', 'shipped', 179.98),
('order_7', 'user_2', 'cancelled', 34.99),
('order_8', 'user_2', 'delivered', 244.97),
('order_9', 'user_3', 'shipped', 109.98),
('order_10', 'user_3', 'processing', 24.99),
('order_11', 'user_3', 'delivered', 199.99),
('order_12', 'user_3', 'shipped', 79.99),
('order_13', 'user_4', 'delivered', 229.98),
('order_14', 'user_4', 'delivered', 129.98),
('order_15', 'user_4', 'processing', 89.99),
('order_16', 'user_4', 'pending', 34.99),
('order_17', 'user_5', 'shipped', 149.99),
('order_18', 'user_5', 'shipped', 24.99),
('order_19', 'user_5', 'delivered', 214.97),
('order_20', 'user_5', 'processing', 49.99);

-- Seed order_items table (40 items - 2 per order on average)
INSERT INTO order_items (id, order_id, product_id, quantity, price_at_time) VALUES
('item_1', 'order_1', 'prod_1', 1, 199.99),
('item_2', 'order_1', 'prod_2', 1, 24.99),
('item_3', 'order_2', 'prod_3', 2, 29.99),
('item_4', 'order_2', 'prod_4', 1, 34.99),
('item_5', 'order_3', 'prod_7', 1, 49.99),
('item_6', 'order_3', 'prod_5', 1, 39.99),
('item_7', 'order_4', 'prod_7', 1, 49.99),
('item_8', 'order_5', 'prod_1', 1, 199.99),
('item_9', 'order_5', 'prod_3', 1, 29.99),
('item_10', 'order_6', 'prod_2', 2, 24.99),
('item_11', 'order_6', 'prod_6', 1, 89.99),
('item_12', 'order_7', 'prod_4', 1, 34.99),
('item_13', 'order_8', 'prod_9', 1, 149.99),
('item_14', 'order_8', 'prod_3', 1, 29.99),
('item_15', 'order_8', 'prod_10', 1, 14.99),
('item_16', 'order_9', 'prod_5', 1, 79.99),
('item_17', 'order_9', 'prod_10', 1, 29.99),
('item_18', 'order_10', 'prod_10', 1, 12.99),
('item_19', 'order_11', 'prod_1', 1, 199.99),
('item_20', 'order_12', 'prod_3', 1, 29.99),
('item_21', 'order_13', 'prod_9', 1, 149.99),
('item_22', 'order_13', 'prod_3', 1, 29.99),
('item_23', 'order_14', 'prod_2', 2, 24.99),
('item_24', 'order_14', 'prod_6', 1, 89.99),
('item_25', 'order_15', 'prod_7', 1, 49.99),
('item_26', 'order_15', 'prod_5', 1, 39.99),
('item_27', 'order_16', 'prod_4', 1, 34.99),
('item_28', 'order_17', 'prod_9', 1, 149.99),
('item_29', 'order_18', 'prod_10', 1, 12.99),
('item_30', 'order_19', 'prod_1', 1, 199.99),
('item_31', 'order_19', 'prod_3', 1, 29.99),
('item_32', 'order_19', 'prod_10', 1, 14.99),
('item_33', 'order_20', 'prod_7', 1, 49.99),
('item_34', 'order_1', 'prod_6', 1, 89.99),
('item_35', 'order_2', 'prod_8', 1, 129.99),
('item_36', 'order_3', 'prod_1', 1, 199.99),
('item_37', 'order_4', 'prod_4', 1, 34.99),
('item_38', 'order_5', 'prod_8', 1, 129.99),
('item_39', 'order_6', 'prod_9', 1, 149.99),
('item_40', 'order_7', 'prod_10', 1, 12.99);