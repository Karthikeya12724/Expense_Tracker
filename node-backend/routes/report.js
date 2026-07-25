const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { success, failed } = require('../utils/apiResponse');

const router = express.Router();

// GET /mywallet/report/getTotalIncomeOrExpense?userId=&transactionTypeId=&month=&year=
router.get('/getTotalIncomeOrExpense', requireRole('ROLE_USER'), async (req, res) => {
  const { userId, transactionTypeId, month, year } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT SUM(amount) as total FROM transaction t
       JOIN users u ON t.user_id = u.id
       JOIN category c ON t.category_id = c.category_id
       JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
       WHERE u.id = ? AND tt.transaction_type_id = ? AND MONTH(t.date) = ? AND YEAR(t.date) = ?`,
      [userId, transactionTypeId, month, year]
    );
    const total = rows[0].total === null ? null : Number(rows[0].total);
    return success(res, 200, total);
  } catch (e) {
    return failed(res, 400, 'Failed to fetch report: Try again later!');
  }
});

// GET /mywallet/report/getTotalNoOfTransactions?userId=&month=&year=
router.get('/getTotalNoOfTransactions', requireRole('ROLE_USER'), async (req, res) => {
  const { userId, month, year } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as total FROM transaction t
       JOIN users u ON t.user_id = u.id
       WHERE u.id = ? AND MONTH(t.date) = ? AND YEAR(t.date) = ?`,
      [userId, month, year]
    );
    return success(res, 200, rows[0].total);
  } catch (e) {
    return failed(res, 400, 'Failed to fetch report: Try again later!');
  }
});

// GET /mywallet/report/getTotalByCategory?email=&categoryId=&month=&year=
router.get('/getTotalByCategory', requireRole('ROLE_USER'), async (req, res) => {
  const { email, categoryId, month, year } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT SUM(amount) as total FROM transaction t
       JOIN users u ON t.user_id = u.id
       JOIN category c ON t.category_id = c.category_id
       WHERE u.email = ? AND c.category_id = ? AND MONTH(t.date) = ? AND YEAR(t.date) = ?`,
      [email, categoryId, month, year]
    );
    const total = rows[0].total === null ? null : Number(rows[0].total);
    return success(res, 200, total);
  } catch (e) {
    return failed(res, 400, 'Failed to fetch report: Try again later!');
  }
});

// GET /mywallet/report/getMonthlySummaryByUser?email=...
router.get('/getMonthlySummaryByUser', requireRole('ROLE_USER'), async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT
          MONTH(t.date) as month,
          SUM(CASE WHEN tt.transaction_type_id = 1 THEN t.amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN tt.transaction_type_id = 2 THEN t.amount ELSE 0 END) as total_income
       FROM transaction t
       JOIN users u ON t.user_id = u.id
       JOIN category c ON t.category_id = c.category_id
       JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
       WHERE u.email = ? AND t.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH)
       GROUP BY YEAR(t.date), MONTH(t.date)`,
      [email]
    );
    const result = rows.map((r) => ({
      month: r.month,
      total_expense: Number(r.total_expense),
      total_income: Number(r.total_income),
    }));
    return success(res, 200, result);
  } catch (e) {
    return failed(res, 400, 'Failed to fetch report: Try again later!');
  }
});

module.exports = router;
