-- Run this only if starting from a fresh database.
-- If you already have the database from the Spring Boot backend, you can skip this —
-- the existing tables already match this schema.

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  verification_code VARCHAR(64),
  verification_code_expiry_time DATETIME,
  enabled BOOLEAN DEFAULT FALSE,
  profile_img_url VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT,
  role_id INT,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS transaction_type (
  transaction_type_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type_name VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(255),
  transaction_type_id INT,
  enabled BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (transaction_type_id) REFERENCES transaction_type(transaction_type_id)
);

CREATE TABLE IF NOT EXISTS transaction (
  transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT,
  category_id INT,
  description VARCHAR(255),
  amount DOUBLE,
  date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES category(category_id)
);

CREATE TABLE IF NOT EXISTS budget (
  budget_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT,
  amount DOUBLE,
  month INT,
  year BIGINT
);

CREATE TABLE IF NOT EXISTS saved_transaction (
  plan_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT,
  transaction_type_id INT,
  category_id INT,
  amount DOUBLE,
  description VARCHAR(255),
  frequency VARCHAR(20),
  upcoming_date DATE
);
