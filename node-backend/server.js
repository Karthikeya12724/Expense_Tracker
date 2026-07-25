require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { authenticate } = require('./middleware/auth');
const seedData = require('./utils/dataSeeder');

const authRoutes = require('./routes/auth');
const transactionTypeRoutes = require('./routes/transactionType');
const categoryRoutes = require('./routes/category');
const transactionRoutes = require('./routes/transaction');
const budgetRoutes = require('./routes/budget');
const savedTransactionRoutes = require('./routes/savedTransaction');
const reportRoutes = require('./routes/report');
const userRoutes = require('./routes/user');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  })
);
app.use(express.json());

// Attach req.user (if a valid JWT is present) before hitting any route
app.use(authenticate);

app.use('/mywallet/auth', authRoutes.router);
app.use('/mywallet/transactiontype', transactionTypeRoutes);
app.use('/mywallet/category', categoryRoutes);
app.use('/mywallet/transaction', transactionRoutes);
app.use('/mywallet/budget', budgetRoutes);
app.use('/mywallet/saved', savedTransactionRoutes);
app.use('/mywallet/report', reportRoutes);
app.use('/mywallet/user', userRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    status: 'FAILED',
    httpStatus: 'INTERNAL_SERVER_ERROR',
    response: 'Something went wrong!',
  });
});

const PORT = process.env.PORT || 8080;

seedData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Expense Tracker backend (Node/Express) running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to seed initial data. Check your DB connection settings in .env');
    console.error(err);
    process.exit(1);
  });
