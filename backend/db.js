// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

let pool;

// If DATABASE_URL is provided (Render), use it
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // required by Render
    },
  });
} else {
  // Local development using .env variables
  pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: false,
  });
}

// Test the database connection
(async () => {
  try {
    const client = await pool.connect();
    console.log(' Connected to PostgreSQL database.');
    client.release();
  } catch (err) {
    console.error(' Database connection error:', err.message);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  end: () => pool.end(),
};
