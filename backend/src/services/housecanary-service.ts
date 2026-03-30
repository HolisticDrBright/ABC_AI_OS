/**
 * HouseCanary — Property valuation and market forecasts.
 * STUB: Implement when enterprise credentials obtained.
 * Feature flag: PREDICTIVE_SCORING_PROVIDER=housecanary
 */

export interface HCValuation {
  estimated_value: number;
  confidence: number;
  value_range_low: number;
  value_range_high: number;
}

export interface HCForecast {
  zip: string;
  forecast_12m_change_pct: number;
  market_health_index: number;
  inventory_months: number;
}

export interface HouseCanaryService {
  getPropertyValuation(address: string): Promise<HCValuation>;
  getMarketForecast(zip: string): Promise<HCForecast>;
}

// TODO: Implement when credentials obtained — enterprise pricing required
export class HouseCanaryServiceStub implements HouseCanaryService {
  async getPropertyValuation(_address: string): Promise<HCValuation> {
    throw new Error('HouseCanary not configured — enterprise credentials required');
  }

  async getMarketForecast(_zip: string): Promise<HCForecast> {
    throw new Error('HouseCanary not configured — enterprise credentials required');
  }
}

export const houseCanaryService = new HouseCanaryServiceStub();
