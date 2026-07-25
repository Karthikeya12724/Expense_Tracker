<h1 align="center">💰 Expense Tracker</h1>

<p align="center">
  <img alt="Static Badge" src="https://img.shields.io/badge/Node.js-darkgreen?style=for-the-badge">
  <img alt="Static Badge" src="https://img.shields.io/badge/Express-black?style=for-the-badge">
  <img alt="Static Badge" src="https://img.shields.io/badge/React.js-blue?style=for-the-badge">
  <img alt="Static Badge" src="https://img.shields.io/badge/mysql-red?style=for-the-badge">
  <img alt="Static Badge" src="https://img.shields.io/badge/jwt-orange?style=for-the-badge">
</p>

## Table of Contents

1. [Description](#description)
2. [Tech Stack](#tech-stack)
3. [Features](#features)
4. [How to Run](#how-to-run)

## Description

A full-stack expense tracking web application for managing day-to-day finances, with secure authentication, transaction management, budgeting, and admin controls.

## Tech Stack

- **Backend:** Node.js, Express, JWT
- **Frontend:** React.js
- **Database:** MySQL

## Features

- User authentication with sign-up, sign-in, email verification, and password reset
- Role-based access for regular users and administrators
- Transaction management with support for recurring/saved transactions
- Monthly summaries and spending statistics
- Budget tracking
- Admin panel for managing categories, users, and transactions with search, filter, and pagination

## How to Run

### 1. Clone the repository

```sh
git clone https://github.com/Karthikeya12724/Expense_Tracker.git
cd Expense_Tracker
```

### 2. Set up the database

Create a MySQL database:

```sql
CREATE DATABASE expense_tracker;
```

If starting completely fresh (no existing tables), run the schema script:

```sh
mysql -u root -p expense_tracker < node-backend/schema.sql
```

### 3. Configure the backend

Copy `node-backend/.env.example` to `node-backend/.env` and fill in your own values:

```properties
DB_HOST=localhost
DB_PORT=3306
DB_NAME=expense_tracker
DB_USER=YOUR_MYSQL_USERNAME
DB_PASSWORD=YOUR_MYSQL_PASSWORD

JWT_SECRET=some_long_random_secret_string
JWT_EXPIRATION_MS=86400000

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=YOUR_EMAIL
MAIL_PASSWORD=YOUR_EMAIL_APP_PASSWORD
```

> **Note:** `MAIL_PASSWORD` should be a Gmail **App Password** (requires 2-Step Verification enabled on the Google account), not your regular Gmail password.

### 4. Run the backend

```sh
cd node-backend
npm install
npm start
```

This automatically seeds the required roles and transaction types on first run. You'll need to manually add category rows for both `expense` and `income` types, and manually insert a user with the `ROLE_ADMIN` role if you want admin access.

### 5. Run the frontend

```sh
cd frontend
npm install
npm start
```

Visit [`http://localhost:3000/`](http://localhost:3000/) and create an account to get started.
