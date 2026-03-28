import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './lib/config.js';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import campaignRoutes from './routes/campaigns.js';
import messageRoutes from './routes/messages.js';
import dashboardRoutes from './routes/dashboard.js';

const app = new Hono();

// Global middleware
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use('*', logger());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/leads', leadRoutes);
app.route('/api/campaigns', campaignRoutes);
app.route('/api/messages', messageRoutes);
app.route('/api/dashboard', dashboardRoutes);

// Error handler
app.onError(errorHandler);

// 404
app.notFound((c) => c.json({ error: { message: 'Not found', code: 'NOT_FOUND' } }, 404));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[ABC AI OS] Backend running on http://localhost:${info.port}`);
});

export default app;
