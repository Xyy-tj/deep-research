-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    credits INT DEFAULT 10,
    is_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usage records table
CREATE TABLE IF NOT EXISTS usage_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    query TEXT NOT NULL,
    query_depth INT NOT NULL,
    query_breadth INT NOT NULL,
    credits_used INT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Research records table
CREATE TABLE IF NOT EXISTS research_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    research_id VARCHAR(255) UNIQUE NOT NULL,
    query TEXT NOT NULL,
    query_depth INT NOT NULL,
    query_breadth INT NOT NULL,
    language VARCHAR(50) NOT NULL,
    credits_used INT NOT NULL,
    output_filename VARCHAR(255),
    output_path VARCHAR(255),
    num_references INT DEFAULT 0,
    num_learnings INT DEFAULT 0,
    visited_urls_count INT DEFAULT 0,
    config_json TEXT,
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    execution_time_ms INT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Invitation codes table
CREATE TABLE IF NOT EXISTS invitation_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    used_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    FOREIGN KEY (used_by) REFERENCES users(id)
);

-- Payment records table
CREATE TABLE IF NOT EXISTS payment_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    credits INT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed'
    payment_method VARCHAR(50) NOT NULL, -- 'wxpay', etc.
    payment_data TEXT, -- JSON string with payment provider data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Credit packages table
CREATE TABLE IF NOT EXISTS credit_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    credits INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    base_credits INT DEFAULT 2,
    depth_multiplier DECIMAL(5, 2) DEFAULT 1,
    breadth_multiplier DECIMAL(5, 2) DEFAULT 0.5,
    credit_exchange_rate DECIMAL(10, 2) DEFAULT 10,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX idx_research_records_user_id ON research_records(user_id);
CREATE INDEX idx_research_records_research_id ON research_records(research_id);
CREATE INDEX idx_credit_packages_is_active ON credit_packages(is_active);
