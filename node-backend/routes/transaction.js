const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { success, failed } = require('../utils/apiResponse');

const router = express.Router();

function toTransactionResponseDto(row) {
  return {
    transactionId: row.transaction_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    transactionType: row.transaction_type_id,
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    userEmail: row.user_email,
  };
}

function groupTransactionsByDate(list) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const groups = {};
  for (const t of list) {
    let key;
    if (t.date === todayStr) key = 'Today';
    else if (t.date === yesterdayStr) key = 'Yesterday';
    else key = t.date;

    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return b.localeCompare(a);
  });

  const ordered = {};
  for (const k of sortedKeys) ordered[k] = groups[k];
  return ordered;
}

// GET /mywallet/transaction/getAll?pageNumber=&pageSize=&searchKey=
router.get('/getAll', requireRole('ROLE_ADMIN'), async (req, res) => {
  const pageNumber = parseInt(req.query.pageNumber) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const searchKey = req.query.searchKey || '';
  const like = `%${searchKey}%`;

  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM transaction t
       JOIN category c ON t.category_id = c.category_id
       JOIN users u ON t.user_id = u.id
       JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
       WHERE t.description LIKE ? OR c.category_name LIKE ? OR tt.transaction_type_name LIKE ? OR u.email LIKE ?`,
      [like, like, like, like]
    );
    const total = countRows[0].total;

    if (total === 0) {
      return success(res, 200, { data: [], totalNoOfPages: 0, totalNoOfRecords: 0 });
    }

    const [rows] = await pool.query(
      `SELECT t.transaction_id, t.description, t.amount, t.date,
              c.category_id, c.category_name, tt.transaction_type_id, u.email as user_email
       FROM transaction t
       JOIN category c ON t.category_id = c.category_id
       JOIN users u ON t.user_id = u.id
       JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
       WHERE t.description LIKE ? OR c.category_name LIKE ? OR tt.transaction_type_name LIKE ? OR u.email LIKE ?
       ORDER BY t.transaction_id DESC
       LIMIT ? OFFSET ?`,
      [like, like, like, like, pageSize, pageNumber * pageSize]
    );

    const list = rows.map(toTransactionResponseDto);
    return success(res, 200, {
      data: list,
      totalNoOfPages: Math.ceil(total / pageSize),
      totalNoOfRecords: total,
    });
  } catch (e) {
    return failed(res, 400, 'Failed to fetch All transactions: Try again later!');
  }
});

// POST /mywallet/transaction/new
router.post('/new', requireRole('ROLE_USER'), async (req, res) => {
  const { userEmail, categoryId, description, amount, date } = req.body;

  if (!description || description.length > 50) {
    return failed(res, 400, '[Description can have atmost 50 characters!]');
  }

  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (userRows.length === 0) {
      return failed(res, 404, `User not found with email ${userEmail}`);
    }
    const [catRows] = await pool.query('SELECT category_id FROM category WHERE category_id = ?', [categoryId]);
    if (catRows.length === 0) {
      return failed(res, 404, `Category not found with id${categoryId}`);
    }

    await pool.query(
      'INSERT INTO transaction (user_id, category_id, description, amount, date) VALUES (?, ?, ?, ?, ?)',
      [userRows[0].id, categoryId, description, amount, date]
    );

    return success(res, 201, 'Transaction has been successfully recorded!');
  } catch (e) {
    return failed(res, 400, 'Failed to record your new transaction, Try again later!');
  }
});

// GET /mywallet/transaction/getByUser
router.get('/getByUser', requireRole('ROLE_USER'), async (req, res) => {
  const { email, searchKey = '', sortField = 'date', transactionType = '' } = req.query;
  const pageNumber = parseInt(req.query.pageNumber) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const sortDirec = (req.query.sortDirec || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  // whitelist sortField to prevent SQL injection since it's interpolated
  const allowedSortFields = { date: 't.date', amount: 't.amount', description: 't.description' };
  const orderByCol = allowedSortFields[sortField] || 't.date';

  const like = `%${searchKey}%`;
  const typeLike = `%${transactionType}%`;

  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM transaction t
       JOIN category c ON t.category_id = c.category_id
       JOIN users u ON t.user_id = u.id
       JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
       WHERE u.email = ? AND tt.transaction_type_name LIKE ? AND (t.description LIKE ? OR c.category_name LIKE ?)`,
      [email, typeLike, like, like]
    );
    const total = countRows[0].total;

    if (total === 0) {
      return success(res, 200, { data: [], totalNoOfPages: 0, totalNoOfRecords: 0 });
    }

    const [rows] = await pool.query(
      `SELECT t.transaction_id, t.description, t.amount, t.date,
              c.category_id, c.category_name, tt.transaction_type_id, u.email as user_email
       FROM transaction t
       JOIN category c ON t.category_id = c.category_id
       JOIN users u ON t.user_id = u.id
       JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
       WHERE u.email = ? AND tt.transaction_type_name LIKE ? AND (t.description LIKE ? OR c.category_name LIKE ?)
       ORDER BY ${orderByCol} ${sortDirec}
       LIMIT ? OFFSET ?`,
      [email, typeLike, like, like, pageSize, pageNumber * pageSize]
    );

    const list = rows.map(toTransactionResponseDto);
    return success(res, 200, {
      data: groupTransactionsByDate(list),
      totalNoOfPages: Math.ceil(total / pageSize),
      totalNoOfRecords: total,
    });
  } catch (e) {
    return failed(res, 400, 'Failed to fetch your transactions! Try again later');
  }
});

// GET /mywallet/transaction/getById?id=...
router.get('/getById', requireRole('ROLE_USER'), async (req, res) => {
  const id = req.query.id;
  const [rows] = await pool.query(
    `SELECT t.transaction_id, t.description, t.amount, t.date,
            c.category_id, c.category_name, tt.transaction_type_id, u.email as user_email
     FROM transaction t
     JOIN category c ON t.category_id = c.category_id
     JOIN users u ON t.user_id = u.id
     JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id
     WHERE t.transaction_id = ?`,
    [id]
  );
  if (rows.length === 0) {
    return failed(res, 404, `Transaction not found with id : ${id}`);
  }
  return success(res, 200, toTransactionResponseDto(rows[0]));
});

// PUT /mywallet/transaction/update?transactionId=...
router.put('/update', requireRole('ROLE_USER'), async (req, res) => {
  const transactionId = req.query.transactionId;
  const { userEmail, categoryId, description, amount, date } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM transaction WHERE transaction_id = ?', [transactionId]);
    if (existing.length === 0) {
      return failed(res, 404, `Transaction not found with id : ${transactionId}`);
    }
    const [userRows] = await pool.query('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (userRows.length === 0) {
      return failed(res, 404, `User not found with email ${userEmail}`);
    }
    const [catRows] = await pool.query('SELECT category_id FROM category WHERE category_id = ?', [categoryId]);
    if (catRows.length === 0) {
      return failed(res, 404, `Category not found with id${categoryId}`);
    }

    await pool.query(
      'UPDATE transaction SET user_id = ?, category_id = ?, description = ?, amount = ?, date = ? WHERE transaction_id = ?',
      [userRows[0].id, categoryId, description, amount, date, transactionId]
    );

    return success(res, 200, 'Transaction has been successfully updated!');
  } catch (e) {
    return failed(res, 400, 'Failed to update your transactions! Try again later');
  }
});

// DELETE /mywallet/transaction/delete?transactionId=...
router.delete('/delete', requireRole('ROLE_USER'), async (req, res) => {
  const transactionId = req.query.transactionId;
  try {
    const [existing] = await pool.query('SELECT transaction_id FROM transaction WHERE transaction_id = ?', [transactionId]);
    if (existing.length === 0) {
      return failed(res, 404, `Transaction not found with id : ${transactionId}`);
    }
    await pool.query('DELETE FROM transaction WHERE transaction_id = ?', [transactionId]);
    return success(res, 200, 'Transaction has been successfully deleted!');
  } catch (e) {
    return failed(res, 400, 'Failed to delete your transactions! Try again later');
  }
});

module.exports = router;
