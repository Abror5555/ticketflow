const { Pool, types } = require('pg');
const config = require('../config');

// NUMERIC (e.g. average resolution hours) as numbers instead of strings.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

const pool = new Pool({ connectionString: config.databaseUrl });

/** Run a function inside one transaction; everything is rolled back on error. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
