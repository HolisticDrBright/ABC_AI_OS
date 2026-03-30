/**
 * Likely.AI — Predictive sell scoring.
 * STUB: Implement when credentials obtained from sales@likely.ai
 * Feature flag: PREDICTIVE_SCORING_PROVIDER=likelyai
 */

export interface LikelySellScore {
  likely_to_sell_score: number;
  confidence: number;
  timeframe_months: number;
}

export interface LikelyAIService {
  getPredictionScore(address: string): Promise<LikelySellScore>;
}

// TODO: Implement when credentials obtained from sales@likely.ai
export class LikelyAIServiceStub implements LikelyAIService {
  async getPredictionScore(_address: string): Promise<LikelySellScore> {
    throw new Error('Likely.AI not configured — set PREDICTIVE_SCORING_PROVIDER=likelyai and provide credentials');
  }
}

export const likelyAIService = new LikelyAIServiceStub();
