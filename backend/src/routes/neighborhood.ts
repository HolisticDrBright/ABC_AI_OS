import { Hono } from 'hono';
import { z } from 'zod';
import * as neighborhoodService from '../services/neighborhood-service.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const neighborhood = new Hono();
neighborhood.use('*', authMiddleware);

neighborhood.get('/:zipCode', async (c) => {
  const data = await neighborhoodService.getNeighborhoodData(c.req.param('zipCode'));
  return c.json(data);
});

neighborhood.get('/', async (c) => {
  const data = await neighborhoodService.getAllNeighborhoodData();
  return c.json(data);
});

neighborhood.post('/', async (c) => {
  const body = await c.req.json();
  const data = z.object({
    zipCode: z.string(),
    avgDaysOnMarket: z.number().optional(),
    medianSalePrice: z.number().optional(),
    offMarketTransactionsLast30d: z.number().optional(),
    listToSaleRatio: z.number().optional(),
  }).parse(body);

  const result = await neighborhoodService.upsertNeighborhoodData(data);
  return c.json(result);
});

neighborhood.post('/bulk', async (c) => {
  const body = await c.req.json();
  const records = z.array(z.object({
    zipCode: z.string(),
    avgDaysOnMarket: z.number().optional(),
    medianSalePrice: z.number().optional(),
    offMarketTransactionsLast30d: z.number().optional(),
    listToSaleRatio: z.number().optional(),
  })).parse(body.records);

  const result = await neighborhoodService.bulkSeedNeighborhoodData(records);
  return c.json(result);
});

export default neighborhood;
