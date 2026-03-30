import { Hono } from 'hono';
import * as propstreamService from '../services/propstream-import-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const propstream = new Hono();
propstream.use('*', authMiddleware);

propstream.post('/import-csv', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();

  if (!body.csvData || typeof body.csvData !== 'string') {
    return c.json({ error: { message: 'csvData field required (raw CSV string)' } }, 400);
  }

  const rows = propstreamService.parsePropStreamCSV(body.csvData);
  if (rows.length === 0) {
    return c.json({ error: { message: 'No data rows found in CSV' } }, 400);
  }

  const results = await propstreamService.importPropStreamData(
    user.organizationId,
    rows,
    user.id,
  );

  return c.json({
    total: rows.length,
    imported: results.filter((r) => r.action === 'imported').length,
    errors: results.filter((r) => r.action === 'error').length,
    results,
  });
});

propstream.get('/column-guide', async (c) => {
  return c.text(propstreamService.getColumnMappingGuide());
});

export default propstream;
