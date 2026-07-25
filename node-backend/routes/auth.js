const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { success, failed } = require('../utils/apiResponse');
const mail = require('../utils/mail');
require('dotenv').config();

const router = express.Router();

function generateVerificationCode() {
  return String(Math.floor(Math.random() * 1000000));
}

function calculateCodeExpiryTime() {
  return new Date(Date.now() + Number(process.env.VERIFICATION_CODE_EXPIRATION_MS || 600000));
}

async function getRoleIdByName(roleName) {
  const [rows] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
  if (rows.length === 0) return null;
  return rows[0].id;
}

// POST /mywallet/auth/signup
router.post('/signup', async (req, res) => {
  const { userName, email, password, roles } = req.body;

  if (!userName || userName.length < 3 || userName.length > 20) {
    return failed(res, 400, '[Username must have atleast 3 characters!]');
  }
  if (!email) {
    return failed(res, 400, '[Email is required!]');
  }
  if (!password || password.length < 8 || password.length > 20) {
    return failed(res, 400, '[Password must have atleast 8 characters!]');
  }

  try {
    const [existingUsername] = await pool.query('SELECT id FROM users WHERE username = ?', [userName]);
    if (existingUsername.length > 0) {
      return failed(res, 409, 'Registration Failed: username is already taken!');
    }
    const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return failed(res, 409, 'Registration Failed: email is already taken!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiryTime = calculateCodeExpiryTime();

    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, verification_code, verification_code_expiry_time, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userName, email, hashedPassword, verificationCode, verificationCodeExpiryTime, false]
    );

    const roleNames = roles && roles.length > 0 ? roles : ['user'];
    for (const r of roleNames) {
      const eRole = r === 'admin' ? 'ROLE_ADMIN' : 'ROLE_USER';
      const roleId = await getRoleIdByName(eRole);
      if (roleId) {
        await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, roleId]);
      }
    }

    try {
      await mail.sendUserRegistrationVerificationEmail({ username: userName, email, verification_code: verificationCode });
    } catch (mailErr) {
      console.error('Registration failed:', mailErr.message);
      return failed(res, 400, 'Registration failed: Something went wrong!');
    }

    return success(res, 201, 'Verification email has been successfully sent!');
  } catch (e) {
    console.error('Registration failed:', e.message);
    return failed(res, 400, 'Registration failed: Something went wrong!');
  }
});

// GET /mywallet/auth/signup/verify?code=...
router.get('/signup/verify', async (req, res) => {
  const { code } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE verification_code = ?', [code]);
    const user = rows[0];

    if (!user || user.enabled) {
      return failed(res, 400, 'Verification failed: invalid verification code!');
    }

    if (Date.now() > new Date(user.verification_code_expiry_time).getTime()) {
      return failed(res, 400, 'Verification failed: expired verification code!');
    }

    await pool.query(
      'UPDATE users SET verification_code = NULL, verification_code_expiry_time = NULL, enabled = ? WHERE id = ?',
      [true, user.id]
    );

    return success(res, 202, 'Verification successful: User account has been successfully created!');
  } catch (e) {
    return failed(res, 400, 'Verification failed: Something went wrong!');
  }
});

// GET /mywallet/auth/signup/resend?email=...
router.get('/signup/resend', async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return failed(res, 404, `User not found with email ${email}`);
    }
    const user = rows[0];
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiryTime = calculateCodeExpiryTime();

    await pool.query(
      'UPDATE users SET verification_code = ?, verification_code_expiry_time = ?, enabled = ? WHERE id = ?',
      [verificationCode, verificationCodeExpiryTime, false, user.id]
    );

    await mail.sendUserRegistrationVerificationEmail({ username: user.username, email: user.email, verification_code: verificationCode });

    return success(res, 200, 'Verification email has been resent successfully!');
  } catch (e) {
    return failed(res, 400, 'Registration failed: Something went wrong!');
  }
});

// POST /mywallet/auth/signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Bad credentials' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Bad credentials' });
    }

    const [roleRows] = await pool.query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?`,
      [user.id]
    );
    const roles = roleRows.map((r) => r.name);

    const token = jwt.sign({ sub: user.email }, process.env.JWT_SECRET, {
      expiresIn: Math.floor(Number(process.env.JWT_EXPIRATION_MS || 86400000) / 1000),
    });

    return res.json({
      token,
      type: 'Bearer',
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
    });
  } catch (e) {
    return res.status(401).json({ message: 'Bad credentials' });
  }
});

// GET /mywallet/auth/forgotPassword/verifyEmail?email=...
router.get('/forgotPassword/verifyEmail', async (req, res) => {
  await sendForgotPasswordCode(req, res);
});

// GET /mywallet/auth/forgotPassword/resendEmail?email=...
router.get('/forgotPassword/resendEmail', async (req, res) => {
  await sendForgotPasswordCode(req, res);
});

async function sendForgotPasswordCode(req, res) {
  const { email } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return failed(res, 404, `Verification failed: User not found with email ${email}!`);
    }
    const user = rows[0];
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiryTime = calculateCodeExpiryTime();

    await pool.query('UPDATE users SET verification_code = ?, verification_code_expiry_time = ? WHERE id = ?', [
      verificationCode,
      verificationCodeExpiryTime,
      user.id,
    ]);

    await mail.sendForgotPasswordVerificationEmail({ username: user.username, email: user.email, verification_code: verificationCode });

    return success(res, 202, 'Verification successful: Email sent successfully!');
  } catch (e) {
    return failed(res, 400, 'Verification failed: Something went wrong!');
  }
}

// GET /mywallet/auth/forgotPassword/verifyCode?code=...
router.get('/forgotPassword/verifyCode', async (req, res) => {
  const { code } = req.query;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE verification_code = ?', [code]);
    const user = rows[0];
    if (!user) {
      return failed(res, 400, 'Verification failed: invalid verification code!');
    }
    if (Date.now() > new Date(user.verification_code_expiry_time).getTime()) {
      return failed(res, 400, 'Verification failed: expired verification code!');
    }

    await pool.query('UPDATE users SET verification_code = NULL, verification_code_expiry_time = NULL WHERE id = ?', [user.id]);

    return success(res, 202, 'Verification successful: User account has been verified!');
  } catch (e) {
    return failed(res, 400, 'Verification failed: Something went wrong!' + e.message);
  }
});

// POST /mywallet/auth/forgotPassword/resetPassword
router.post('/forgotPassword/resetPassword', async (req, res) => {
  await resetPasswordHandler(req, res);
});

async function resetPasswordHandler(req, res) {
  const { email, currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8 || newPassword.length > 20) {
    return failed(res, 400, '[New password must have atleast 8 characters!]');
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return failed(res, 404, `User not found with email ${email}`);
    }
    const user = rows[0];

    if (currentPassword) {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return failed(res, 400, 'Reset password not successful: current password is incorrect!!');
      }
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);

    return success(res, 201, 'Reset successful: Password has been successfully reset!');
  } catch (e) {
    return failed(res, 400, 'Failed to reset your password: Try again later!');
  }
}

module.exports = { router, resetPasswordHandler };
