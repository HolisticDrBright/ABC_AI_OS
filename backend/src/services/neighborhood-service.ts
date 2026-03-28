import { db } from '../lib/db.js';
import { writeAuditLog } from '../lib/audit.js';
import { emitEvent } from '../lib/event-bus.js';

export async function upsertNeighborhoodData(data: {
  zipCode: string;
  dataSource?: string;
  avgDaysOnMarket?: number;
  medianSalePrice?: number;
  offMarketTransactionsLast30d?: number;
  listToSaleRatio?: number;
}) {
  const record = await db.neighborhoodIntelligence.create({
    data: {
      zipCode: data.zipCode,
      dataSource: data.dataSource || 'manual',
      avgDaysOnMarket: data.avgDaysOnMarket,
      medianSalePrice: data.medianSalePrice,
      offMarketTransactionsLast30d: data.offMarketTransactionsLast30d,
      listToSaleRatio: data.listToSaleRatio,
      fetchedAt: new Date(),
    },
  });

  await emitEvent('neighborhood.data_refreshed', { zipCode: data.zipCode });

  return record;
}

export async function getNeighborhoodData(zipCode: string) {
  return db.neighborhoodIntelligence.findFirst({
    where: { zipCode },
    orderBy: { fetchedAt: 'desc' },
  });
}

export async function bulkSeedNeighborhoodData(records: Array<{
  zipCode: string;
  avgDaysOnMarket?: number;
  medianSalePrice?: number;
  offMarketTransactionsLast30d?: number;
  listToSaleRatio?: number;
}>) {
  const results = [];
  for (const record of records) {
    const r = await upsertNeighborhoodData({ ...record, dataSource: 'seed' });
    results.push(r);
  }
  return results;
}

export async function getAllNeighborhoodData(limit = 100) {
  return db.neighborhoodIntelligence.findMany({
    orderBy: { fetchedAt: 'desc' },
    take: limit,
    distinct: ['zipCode'],
  });
}
