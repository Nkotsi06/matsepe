// backend/db.js

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST,       // e.g. db-1234.us-east-1.render.com
  user: process.env.DB_USER,       // your DB username
  password: process.env.DB_PASSWORD, // your DB password
  database: process.env.DB_NAME,   // your DB name
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false } // required for most cloud providers
});

// Test the database connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database.');
    client.release();
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
})();

module.exports = pool;
