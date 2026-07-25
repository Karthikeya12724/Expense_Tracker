const pool = require('../db');

async function seed() {
  // Roles
  const roles = ['ROLE_USER', 'ROLE_ADMIN'];
  for (const roleName of roles) {
    const [existing] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (existing.length === 0) {
      await pool.query('INSERT INTO roles (name) VALUES (?)', [roleName]);
      console.log(`Seeded role: ${roleName}`);
    }
  }

  // Transaction types
  const types = ['TYPE_EXPENSE', 'TYPE_INCOME'];
  for (const typeName of types) {
    const [existing] = await pool.query('SELECT transaction_type_id FROM transaction_type WHERE transaction_type_name = ?', [typeName]);
    if (existing.length === 0) {
      await pool.query('INSERT INTO transaction_type (transaction_type_name) VALUES (?)', [typeName]);
      console.log(`Seeded transaction type: ${typeName}`);
    }
  }
}

module.exports = seed;
