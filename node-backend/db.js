const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // keep DATE columns as 'YYYY-MM-DD' strings, matching Java LocalDate serialization
  typeCast: function (field, next) {
    // Hibernate maps Java `boolean` fields (e.g. `enabled`) to BIT(1) in MySQL.
    // mysql2 returns BIT columns as Buffers by default — convert to real booleans instead.
    if (field.type === 'BIT' && field.length === 1) {
      const bytes = field.buffer();
      return bytes === null ? null : bytes[0] === 1;
    }
    return next();
  },
});

module.exports = pool;
