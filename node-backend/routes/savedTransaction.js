const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { success, failed } = require('../utils/apiResponse');

const router = express.Router();

function addInterval(dateStr, frequency) {
  const d = new Date(dateStr);
  if (frequency === 'DAILY') d.setDate(d.getDate() + 1);
  else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

function getDueInformation(upcomingDate, frequency) {
  if (!upcomingDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(upcomingDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due on Today';
  if (diffDays === 1) return 'Due on Tomorrow';
  if (diffDays === 2) return 'Due on a day after tomorrow';
  if (diffDays === -1) return '1 day overdue';

  if (frequency === 'MONTHLY' && diffDays < 0) {
    const months = Math.floor(-diffDays / 30);
    return `${months} Months over due`;
  }
  if (diffDays < 0) {
    return `${-diffDays} days overdue`;
  }
  return `Due on ${upcomingDate}`;
}

async function toSavedTransactionResponseDto(row) {
  const [catRows] = await pool.query('SELECT category_name FROM category WHERE category_id = ?', [row.category_id]);
  return {
    planId: row.plan_id,
    transactionType: row.transaction_type_id,
    categoryName: catRows.length > 0 ? catRows[0].category_name : null,
    amount: Number(row.amount),
    description: row.description,
    frequency: row.frequency,
    dueInformation: getDueInformation(row.upcoming_date, row.frequency),
  };
}

// POST /mywallet/saved/create
router.post('/create', requireRole('ROLE_USER'), async (req, res) => {
  const { userId, categoryId, amount, description, frequency, upcomingDate } = req.body;
  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return failed(res, 404, `User not found with id: ${userId}`);
    }
    const [catRows] = await pool.query('SELECT transaction_type_id FROM category WHERE category_id = ?', [categoryId]);
    if (catRows.length === 0) {
      return failed(res, 404, `Category not found with id${categoryId}`);
    }

    await pool.query(
      `INSERT INTO saved_transaction (user_id, transaction_type_id, category_id, amount, description, frequency, upcoming_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, catRows[0].transaction_type_id, categoryId, amount, description, frequency, upcomingDate]
    );

    return success(res, 201, 'Transaction has been successfully created!');
  } catch (e) {
    return failed(res, 400, 'Failed to create transaction. Try again later');
  }
});

// GET /mywallet/saved/add?id=...  (records an actual transaction from a saved/recurring one)
router.get('/add', requireRole('ROLE_USER'), async (req, res) => {
  const id = req.query.id;
  try {
    const [rows] = await pool.query('SELECT * FROM saved_transaction WHERE plan_id = ?', [id]);
    if (rows.length === 0) {
      return failed(res, 404, `Transaction not found with id: ${id}`);
    }
    const plan = rows[0];

    await pool.query(
      'INSERT INTO transaction (user_id, category_id, description, amount, date) VALUES (?, ?, ?, ?, ?)',
      [plan.user_id, plan.category_id, plan.description, plan.amount, plan.upcoming_date]
    );

    const nextDate = addInterval(plan.upcoming_date, plan.frequency);
    await pool.query('UPDATE saved_transaction SET upcoming_date = ? WHERE plan_id = ?', [nextDate, id]);

    return success(res, 201, 'Transaction has been successfully saved!');
  } catch (e) {
    return failed(res, 400, 'Failed to add transaction. Try again later');
  }
});

// PUT /mywallet/saved/?id=...
router.put('/', requireRole('ROLE_USER'), async (req, res) => {
  const id = req.query.id;
  const { categoryId, amount, description, frequency, upcomingDate } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM saved_transaction WHERE plan_id = ?', [id]);
    if (rows.length === 0) {
      return failed(res, 404, `Transaction not found with id: ${id}`);
    }
    const [catRows] = await pool.query('SELECT transaction_type_id FROM category WHERE category_id = ?', [categoryId]);
    if (catRows.length === 0) {
      return failed(res, 404, `Category not found with id${categoryId}`);
    }

    await pool.query(
      `UPDATE saved_transaction SET transaction_type_id = ?, amount = ?, description = ?, frequency = ?, upcoming_date = ?, category_id = ?
       WHERE plan_id = ?`,
      [catRows[0].transaction_type_id, amount, description, frequency, upcomingDate, categoryId, id]
    );

    return success(res, 200, 'Transaction has been successfully edited!');
  } catch (e) {
    return failed(res, 400, 'Failed to edit transaction. Try again later');
  }
});

// DELETE /mywallet/saved/?id=...
router.delete('/', requireRole('ROLE_USER'), async (req, res) => {
  const id = req.query.id;
  try {
    const [rows] = await pool.query('SELECT plan_id FROM saved_transaction WHERE plan_id = ?', [id]);
    if (rows.length === 0) {
      return failed(res, 404, `Transaction not found with id: ${id}`);
    }
    await pool.query('DELETE FROM saved_transaction WHERE plan_id = ?', [id]);
    return success(res, 200, 'Transaction deleted successfully!');
  } catch (e) {
    return failed(res, 400, 'Failed to delete transaction. Try again later.');
  }
});

// GET /mywallet/saved/user?id=...
router.get('/user', requireRole('ROLE_USER'), async (req, res) => {
  const userId = req.query.id;
  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return failed(res, 404, `User not found with id: ${userId}`);
    }
    const [rows] = await pool.query('SELECT * FROM saved_transaction WHERE user_id = ? ORDER BY upcoming_date ASC', [userId]);
    const response = await Promise.all(rows.map(toSavedTransactionResponseDto));
    return success(res, 200, response);
  } catch (e) {
    return failed(res, 400, 'Failed to fetch transactions. Try again later');
  }
});

// GET /mywallet/saved/month?id=...
router.get('/month', requireRole('ROLE_USER'), async (req, res) => {
  const userId = req.query.id;
  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return failed(res, 404, `User not found with id: ${userId}`);
    }
    const [rows] = await pool.query('SELECT * FROM saved_transaction WHERE user_id = ? ORDER BY upcoming_date ASC', [userId]);
    const currentMonth = new Date().getMonth() + 1;
    const filtered = rows.filter((r) => r.upcoming_date && new Date(r.upcoming_date).getMonth() + 1 === currentMonth);
    const response = await Promise.all(filtered.map(toSavedTransactionResponseDto));
    return success(res, 200, response);
  } catch (e) {
    return failed(res, 400, 'Failed to fetch transactions. Try again later');
  }
});

// GET /mywallet/saved/?id=...  (get one saved transaction by id, raw entity like Java does)
router.get('/', requireRole('ROLE_USER'), async (req, res) => {
  const id = req.query.id;
  try {
    const [rows] = await pool.query('SELECT * FROM saved_transaction WHERE plan_id = ?', [id]);
    if (rows.length === 0) {
      return failed(res, 404, `Transaction not found with id: ${id}`);
    }
    const row = rows[0];
    return success(res, 200, {
      planId: row.plan_id,
      userId: row.user_id,
      transactionTypeId: row.transaction_type_id,
      categoryId: row.category_id,
      amount: Number(row.amount),
      description: row.description,
      frequency: row.frequency,
      upcomingDate: row.upcoming_date,
    });
  } catch (e) {
    return failed(res, 400, 'Failed to fetch transaction. Try again later.');
  }
});

// GET /mywallet/saved/skip?id=...
router.get('/skip', async (req, res) => {
  const id = req.query.id;
  try {
    const [rows] = await pool.query('SELECT * FROM saved_transaction WHERE plan_id = ?', [id]);
    if (rows.length === 0) {
      return failed(res, 404, `Transaction not found with id: ${id}`);
    }
    const plan = rows[0];
    const nextDate = addInterval(plan.upcoming_date, plan.frequency);
    await pool.query('UPDATE saved_transaction SET upcoming_date = ? WHERE plan_id = ?', [nextDate, id]);
    return success(res, 201, 'Transaction has been successfully skipped for period!');
  } catch (e) {
    return failed(res, 400, 'Failed to add transaction. Try again later');
  }
});

module.exports = router;
