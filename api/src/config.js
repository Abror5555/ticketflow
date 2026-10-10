require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 4001,
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5434/ticketflow',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
};

module.exports = config;
