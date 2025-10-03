// backend/db.js

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234567', // ✅ Change this to your real PostgreSQL password
  database: process.env.DB_NAME || 'luct_reporting',
  port: process.env.DB_PORT || 5432, // PostgreSQL default port
});

// Test the database connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database.');
    client.release(); // release client back to pool
  } catch (err) {
    console.error(' Database connection error:', err.message);
  }
})();

module.exports = pool;
