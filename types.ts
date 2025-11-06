export interface Coin {
    symbol: string;
    price: number;
    high24h: number;
    low24h: number;
    priceChangePercent: number;
}

// This is the payload from the Binance Futures WebSocket ticker stream
export interface BinanceTickerPayload {
    s: string; // Symbol
    c: string; // Last price
    P: string; // Price change percent
    h: string; // High price
    l: string; // Low price
}

export interface TechnicalIndicators {
  ema: {
    value: number;
    period: number;
    interpretation: string;
  };
  rsi: {
    value: number;
    period: number;
    interpretation: string;
  };
  macd: {
    macd_line: number;
    signal_line: number;
    histogram: number;
    interpretation: string;
  };
  volume: {
    interpretation: string;
  }
}

export interface GeminiAnalysis {
    signal: Signal;
    entry_point: number;
    exit_point: number;
    reasoning: string;
    confidence_score: number;
    technical_indicators?: TechnicalIndicators;
}

export enum Signal {
    BUY = 'BUY',
    SELL = 'SELL',
    HOLD = 'HOLD',
    NONE = 'NONE'
}

export interface PriceAlerts {
  [symbol: string]: {
    high?: number;
    low?: number;
    notifyOnNewHigh?: boolean;
    notifyOnNewLow?: boolean;
    persistHigh?: boolean;
    persistLow?: boolean;
  };
}