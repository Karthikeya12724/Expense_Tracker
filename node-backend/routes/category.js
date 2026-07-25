const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { success, failed } = require('../utils/apiResponse');

const router = express.Router();

function toCategoryDto(row) {
  return {
    categoryId: row.category_id,
    categoryName: row.category_name,
    enabled: !!row.enabled,
    transactionType: {
      transactionTypeId: row.transaction_type_id,
      transactionTypeName: row.transaction_type_name,
    },
  };
}

// GET /mywallet/category/getAll
router.get('/getAll', requireRole('ROLE_USER', 'ROLE_ADMIN'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, tt.transaction_type_name FROM category c
     JOIN transaction_type tt ON c.transaction_type_id = tt.transaction_type_id`
  );
  return success(res, 200, rows.map(toCategoryDto));
});

// POST /mywallet/category/new
router.post('/new', requireRole('ROLE_ADMIN'), async (req, res) => {
  const { categoryName, transactionTypeId } = req.body;
  if (!categoryName || categoryName.length > 30) {
    return failed(res, 400, '[Category name cannot have more than 30 characters!]');
  }

  try {
    const [typeRows] = await pool.query('SELECT * FROM transaction_type WHERE transaction_type_id = ?', [transactionTypeId]);
    if (typeRows.length === 0) {
      return failed(res, 404, `Transaction type not found with id ${transactionTypeId}`);
    }

    const [existing] = await pool.query(
      'SELECT category_id FROM category WHERE category_name = ? AND transaction_type_id = ?',
      [categoryName, transactionTypeId]
    );
    if (existing.length > 0) {
      return failed(res, 409, 'Category already exists!');
    }

    await pool.query('INSERT INTO category (category_name, transaction_type_id, enabled) VALUES (?, ?, ?)', [
      categoryName,
      transactionTypeId,
      true,
    ]);

    return success(res, 201, 'Category has been successfully added!');
  } catch (e) {
    return failed(res, 400, 'Failed to add new category: Try again later!');
  }
});

// PUT /mywallet/category/update?categoryId=...
router.put('/update', requireRole('ROLE_ADMIN'), async (req, res) => {
  const categoryId = req.query.categoryId;
  const { categoryName, transactionTypeId } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM category WHERE category_id = ?', [categoryId]);
    if (existing.length === 0) {
      return failed(res, 404, `Category not found with id${categoryId}`);
    }
    const [typeRows] = await pool.query('SELECT * FROM transaction_type WHERE transaction_type_id = ?', [transactionTypeId]);
    if (typeRows.length === 0) {
      return failed(res, 404, `Transaction type not found with id ${transactionTypeId}`);
    }

    await pool.query('UPDATE category SET category_name = ?, transaction_type_id = ? WHERE category_id = ?', [
      categoryName,
      transactionTypeId,
      categoryId,
    ]);

    return success(res, 201, 'Category has been successfully updated!');
  } catch (e) {
    return failed(res, 400, 'Failed to update category: Try again later!');
  }
});

// DELETE /mywallet/category/delete?categoryId=...  (toggles enabled/disabled, matching Java behavior)
router.delete('/delete', requireRole('ROLE_ADMIN'), async (req, res) => {
  const categoryId = req.query.categoryId;
  try {
    const [existing] = await pool.query('SELECT * FROM category WHERE category_id = ?', [categoryId]);
    if (existing.length === 0) {
      return failed(res, 404, `Category not found with id${categoryId}`);
    }
    const newEnabled = !existing[0].enabled;
    await pool.query('UPDATE category SET enabled = ? WHERE category_id = ?', [newEnabled, categoryId]);
    return success(res, 200, 'Category has been updated successfully!');
  } catch (e) {
    return failed(res, 400, 'Failed to update category: Try again later!');
  }
});

module.exports = router;
