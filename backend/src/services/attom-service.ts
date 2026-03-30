/**
 * ATTOM Data API — Property data enrichment service.
 * STUB: Implement when API credentials are obtained.
 * Feature flag: PROPSTREAM_API_READY (future direct API support)
 */

export interface PropertyData {
  address: string;
  estimatedValue: number | null;
  equityEstimate: number | null;
  mortgageBalance: number | null;
  yearsOwned: number | null;
  ownershipType: string | null;
  occupancyStatus: string | null;
  taxDelinquent: boolean;
  preForeclosure: boolean;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
}

export interface PropertyDataService {
  enrichByAddress(address: string): Promise<PropertyData>;
  enrichBatch(addresses: string[]): Promise<PropertyData[]>;
  getNeighborhoodStats(zip: string): Promise<NeighborhoodStats>;
}

interface NeighborhoodStats {
  avgDaysOnMarket: number | null;
  medianSalePrice: number | null;
  offMarketTransactionsLast30d: number | null;
  listToSaleRatio: number | null;
}

// TODO: Implement when ATTOM API credentials obtained
// ATTOM API Base: https://api.gateway.attomdata.com/propertyapi/v1.0.0
// Auth: Bearer token via apikey header
export class AttomService implements PropertyDataService {
  async enrichByAddress(_address: string): Promise<PropertyData> {
    throw new Error('ATTOM API not configured — use PropStream CSV import instead');
  }

  async enrichBatch(_addresses: string[]): Promise<PropertyData[]> {
    throw new Error('ATTOM API not configured — use PropStream CSV import instead');
  }

  async getNeighborhoodStats(_zip: string): Promise<NeighborhoodStats> {
    throw new Error('ATTOM API not configured — seed neighborhood_intelligence manually');
  }
}

export const attomService = new AttomService();
