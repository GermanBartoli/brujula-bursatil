export type Asset = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  kind: "accion" | "cedear" | "etf";
  sector: string;
  underlying: string;
  tv: string;
  color?: string;
};
export type Position = {
  asset: Asset;
  quantity: number;
  cost: number;
  costCurrency?: string;
  risk?: "alto" | "medio" | "bajo";
  manualPrice?: number;
  manualPriceAt?: string;
  updatedAt: string;
};
export type LocalData = {
  version: 1;
  watchlist: Asset[];
  positions: Position[];
  currency: string;
  lastVisit: string;
  lists: string[];
  assignments: Record<string, string>;
};
export type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  volume: number | null;
};
export type Market = {
  fx?: Record<string, number>;
  fxDate?: string;
  global?: Record<string, Quote & { currency: string; asOf: string }>;
  usa: Quote[];
  cedears: Quote[];
  argentina?: Quote[];
  ccl: number | null;
  fetchedAt: string;
  warnings: string[];
};
export type Article = {
  uuid: string;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  source: string;
  published_at: string;
  entities: { symbol: string; sentiment_score?: number }[];
};
export type News = {
  data: Article[];
  fetchedAt: string;
  source: string;
  hasMore?: boolean;
  warnings?: string[];
};
export type Analysis = {
  resumen: string;
  sentimiento: string;
  relevancia: string;
  impacto: string;
  justificacion: string;
};
