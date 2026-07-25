const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { success, failed } = require('../utils/apiResponse');

const router = express.Router();

// POST /mywallet/budget/create
router.post('/create', requireRole('ROLE_USER'), async (req, res) => {
  const { userId, amount } = req.body;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return failed(res, 404, `User not found with id ${userId}`);
    }

    const [existing] = await pool.query('SELECT * FROM budget WHERE user_id = ? AND month = ? AND year = ?', [
      userId,
      month,
      year,
    ]);

    if (existing.length === 0) {
      await pool.query('INSERT INTO budget (user_id, amount, month, year) VALUES (?, ?, ?, ?)', [userId, amount, month, year]);
    } else {
      await pool.query('UPDATE budget SET amount = ? WHERE budget_id = ?', [amount, existing[0].budget_id]);
    }

    return success(res, 201, 'Budget created successfully!');
  } catch (e) {
    return failed(res, 400, 'Failed to create budget: Try again later!');
  }
});

// GET /mywallet/budget/get?userId=&month=&year=
router.get('/get', requireRole('ROLE_USER'), async (req, res) => {
  const { userId, month, year } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM budget WHERE user_id = ? AND month = ? AND year = ?', [userId, month, year]);
    const amount = rows.length === 0 ? 0 : Number(rows[0].amount);
    return success(res, 200, amount);
  } catch (e) {
    return failed(res, 400, 'Failed to create budget: Try again later!');
  }
});

module.exports = router;
