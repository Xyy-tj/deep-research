-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    credits INTEGER DEFAULT 10,
    is_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage records table
CREATE TABLE IF NOT EXISTS usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    query_depth INTEGER NOT NULL,
    query_breadth INTEGER NOT NULL,
    credits_used INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Research records table
CREATE TABLE IF NOT EXISTS research_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    research_id TEXT UNIQUE NOT NULL,
    query TEXT NOT NULL,
    query_depth INTEGER NOT NULL,
    query_breadth INTEGER NOT NULL,
    language TEXT NOT NULL,
    credits_used INTEGER NOT NULL,
    output_filename TEXT,
    output_path TEXT,
    num_references INTEGER DEFAULT 0,
    num_learnings INTEGER DEFAULT 0,
    visited_urls_count INTEGER DEFAULT 0,
    config_json TEXT,
    status TEXT DEFAULT 'completed',
    error_message TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    execution_time_ms INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Invitation codes table
CREATE TABLE IF NOT EXISTS invitation_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    used_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    FOREIGN KEY (used_by) REFERENCES users(id)
);

-- Payment records table
CREATE TABLE IF NOT EXISTS payment_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    credits INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'completed', 'failed'
    payment_method TEXT NOT NULL, -- 'wxpay', etc.
    payment_data TEXT, -- JSON string with payment provider data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Credit packages table
CREATE TABLE IF NOT EXISTS credit_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credits INTEGER NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    base_credits INTEGER DEFAULT 2,
    depth_multiplier REAL DEFAULT 1,
    breadth_multiplier REAL DEFAULT 0.5,
    credit_exchange_rate REAL DEFAULT 10,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_research_records_user_id ON research_records(user_id);
CREATE INDEX IF NOT EXISTS idx_research_records_research_id ON research_records(research_id);
CREATE INDEX IF NOT EXISTS idx_credit_packages_is_active ON credit_packages(is_active);
