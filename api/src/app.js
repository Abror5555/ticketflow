const express = require('express');
const cors = require('cors');
const config = require('./config');
const { pool } = require('./db/pool');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');
const ticketsRoutes = require('./modules/tickets/tickets.routes');
const agentsRoutes = require('./modules/agents/agents.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/agents', agentsRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
