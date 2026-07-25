const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /mywallet/transactiontype/all
router.get('/all', requireRole('ROLE_USER'), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM transaction_type');
  res.json(
    rows.map((r) => ({
      transactionTypeId: r.transaction_type_id,
      transactionTypeName: r.transaction_type_name,
    }))
  );
});

module.exports = router;
