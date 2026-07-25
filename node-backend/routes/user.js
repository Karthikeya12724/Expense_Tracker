const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { success, failed } = require('../utils/apiResponse');
require('dotenv').config();

const router = express.Router();

const uploadDir = process.env.PROFILE_UPLOAD_DIR || './uploads/user/profile';
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

function toUserResponseDto(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    enabled: !!row.enabled,
    expense: row.expense === null ? null : Number(row.expense),
    income: row.income === null ? null : Number(row.income),
    noOfTransactions: row.noOfTransactions,
  };
}

// GET /mywallet/user/getAll?pageNumber=&pageSize=&searchKey=
router.get('/getAll', requireRole('ROLE_ADMIN'), async (req, res) => {
  const pageNumber = parseInt(req.query.pageNumber) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const searchKey = req.query.searchKey || '';
  const like = `%${searchKey}%`;

  try {
    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', ['ROLE_USER']);
    if (roleRows.length === 0) {
      return failed(res, 404, 'Invalid role name: user');
    }
    const roleId = roleRows[0].id;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role_id = ? AND (u.username LIKE ? OR u.email LIKE ?)`,
      [roleId, like, like]
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT u.* FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role_id = ? AND (u.username LIKE ? OR u.email LIKE ?)
       LIMIT ? OFFSET ?`,
      [roleId, like, like, pageSize, pageNumber * pageSize]
    );

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const userResponseDtoList = [];
    for (const u of rows) {
      const [[expenseRow]] = await pool.query(
        `SELECT SUM(amount) as total FROM transaction t
         JOIN category c ON t.category_id = c.category_id
         WHERE t.user_id = ? AND c.transaction_type_id = 1 AND MONTH(t.date) = ? AND YEAR(t.date) = ?`,
        [u.id, month, year]
      );
      const [[incomeRow]] = await pool.query(
        `SELECT SUM(amount) as total FROM transaction t
         JOIN category c ON t.category_id = c.category_id
         WHERE t.user_id = ? AND c.transaction_type_id = 2 AND MONTH(t.date) = ? AND YEAR(t.date) = ?`,
        [u.id, month, year]
      );
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) as total FROM transaction WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?`,
        [u.id, month, year]
      );

      userResponseDtoList.push(
        toUserResponseDto({
          ...u,
          expense: expenseRow.total,
          income: incomeRow.total,
          noOfTransactions: countRow.total,
        })
      );
    }

    return success(res, 200, {
      data: userResponseDtoList,
      totalNoOfPages: Math.ceil(total / pageSize),
      totalNoOfRecords: total,
    });
  } catch (e) {
    return failed(res, 400, 'Failed to fetch All users: Try again later!');
  }
});

// DELETE /mywallet/user/disable?userId=...  (toggles enabled)
router.delete('/disable', requireRole('ROLE_ADMIN'), async (req, res) => {
  await toggleEnabled(req, res);
});

// PUT /mywallet/user/enable?userId=...  (also toggles enabled, matching Java's identical logic)
router.put('/enable', requireRole('ROLE_ADMIN'), async (req, res) => {
  await toggleEnabled(req, res);
});

async function toggleEnabled(req, res) {
  const userId = req.query.userId;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return failed(res, 404, `User not found with id ${userId}`);
    }
    const newEnabled = !rows[0].enabled;
    await pool.query('UPDATE users SET enabled = ? WHERE id = ?', [newEnabled, userId]);
    return success(res, 200, 'User has been updated successfully!');
  } catch (e) {
    return failed(res, 400, 'Failed to update user: Try again later!');
  }
}

// POST /mywallet/user/settings/changePassword
router.post('/settings/changePassword', requireRole('ROLE_USER', 'ROLE_ADMIN'), async (req, res) => {
  const { resetPasswordHandler } = require('./auth');
  await resetPasswordHandler(req, res);
});

// POST /mywallet/user/settings/profileImg  (multipart/form-data: email, file)
router.post('/settings/profileImg', requireRole('ROLE_USER', 'ROLE_ADMIN'), upload.single('file'), async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return failed(res, 404, `User not found with email ${email}`);
    }
    const user = rows[0];
    if (!req.file) {
      return failed(res, 400, 'Failed to update profile image: no file uploaded!');
    }

    const ext = path.extname(req.file.originalname);
    const newFileName = `${user.username}${ext}`;
    const targetPath = path.join(uploadDir, newFileName);

    fs.renameSync(req.file.path, targetPath);

    await pool.query('UPDATE users SET profile_img_url = ? WHERE id = ?', [targetPath, user.id]);

    return success(res, 201, 'Profile image successfully updated!');
  } catch (e) {
    return failed(res, 400, 'Failed to update profile image: Try again later!');
  }
});

// GET /mywallet/user/settings/profileImg?email=...
router.get('/settings/profileImg', requireRole('ROLE_USER', 'ROLE_ADMIN'), async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return failed(res, 404, `User not found with email ${email}`);
    }
    const user = rows[0];
    if (!user.profile_img_url) {
      return success(res, 200, null);
    }
    const imageBuffer = fs.readFileSync(user.profile_img_url);
    const base64Image = imageBuffer.toString('base64');
    return success(res, 200, base64Image);
  } catch (e) {
    return failed(res, 400, 'Failed to get profile image: Try again later!');
  }
});

// DELETE /mywallet/user/settings/profileImg?email=...
router.delete('/settings/profileImg', requireRole('ROLE_USER', 'ROLE_ADMIN'), async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return failed(res, 404, `User not found with email ${email}`);
    }
    const user = rows[0];
    if (user.profile_img_url && fs.existsSync(user.profile_img_url)) {
      fs.unlinkSync(user.profile_img_url);
      await pool.query('UPDATE users SET profile_img_url = NULL WHERE id = ?', [user.id]);
      return success(res, 200, 'Profile image removed successfully!');
    }
    return failed(res, 400, 'Failed to remove profile image: Try again later!');
  } catch (e) {
    return failed(res, 400, 'Failed to remove profile image: Try again later!');
  }
});

module.exports = router;
