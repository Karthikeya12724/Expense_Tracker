<h1 align="center">💰 Expense Tracker</h1>

<p align="center">
  <img alt="Static Badge" src="https://img.shields.io/badge/Spring%20Boot-darkgreen?style=for-the-badge">
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

- **Backend:** Spring Boot, Spring Security, JWT
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

### 3. Configure the backend

Copy `backend/src/main/resources/application.properties.example` to `application.properties` in the same folder, then fill in your own values:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/expense_tracker
spring.datasource.username=YOUR_MYSQL_USERNAME
spring.datasource.password=YOUR_MYSQL_PASSWORD

spring.mail.username=YOUR_EMAIL
spring.mail.password=YOUR_EMAIL_APP_PASSWORD
```

> **Note:** Java 21 is required. If you have a newer JDK installed, set `JAVA_HOME` to a JDK 21 installation before running the backend, since some dependencies (Lombok) aren't yet compatible with newer JDKs.

### 4. Run the backend

```sh
cd backend
./mvnw spring-boot:run
```

This automatically creates the required tables and seeds transaction types. You'll need to manually add category rows for both `expense` and `income` types, and manually insert a user with the `admin` role if you want admin access.

### 5. Run the frontend

```sh
cd frontend
npm install
npm start
```

Visit [`http://localhost:3000/`](http://localhost:3000/) and create an account to get started.
