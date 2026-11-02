import type { Asset } from "./types";
const entries = [
  ["NVDA", "NVIDIA", "NASDAQ", "us", "USD", "Tecnología", "#a9dc70"],
  ["AAPL", "Apple", "NASDAQ", "us", "USD", "Tecnología", "#d2d5d9"],
  ["MSFT", "Microsoft", "NASDAQ", "us", "USD", "Tecnología", "#79bdf2"],
  ["GOOGL", "Alphabet", "NASDAQ", "us", "USD", "Comunicación", "#ffbb67"],
  ["AMZN", "Amazon", "NASDAQ", "us", "USD", "Consumo", "#e6b066"],
  ["META", "Meta Platforms", "NASDAQ", "us", "USD", "Comunicación", "#74a7ff"],
  ["TSLA", "Tesla", "NASDAQ", "us", "USD", "Consumo", "#f48283"],
  ["MELI", "Mercado Libre", "NASDAQ", "us", "USD", "Consumo", "#eed45c"],
  ["KO", "Coca-Cola", "NYSE", "us", "USD", "Consumo", "#f27979"],
  ["JPM", "JPMorgan Chase", "NYSE", "us", "USD", "Finanzas", "#8eaeec"],
  ["V", "Visa", "NYSE", "us", "USD", "Finanzas", "#9d99f4"],
  ["XOM", "Exxon Mobil", "NYSE", "us", "USD", "Energía", "#e79b92"],
  [
    "TSM",
    "Taiwan Semiconductor (ADR)",
    "NYSE",
    "us",
    "USD",
    "Tecnología",
    "#c6bca6",
  ],
  ["ASML", "ASML Holding", "EURONEXT", "nl", "EUR", "Tecnología", "#84b9e4"],
  ["SAP", "SAP", "XETR", "de", "EUR", "Tecnología", "#7ca9dc"],
  ["7203", "Toyota Motor", "TSE", "jp", "JPY", "Consumo", "#dd9d9d"],
  ["0700", "Tencent", "HKEX", "hk", "HKD", "Comunicación", "#9db2f5"],
  ["HSBA", "HSBC Holdings", "LSE", "gb", "GBP", "Finanzas", "#e2a3a3"],
  ["NESN", "Nestlé", "SIX", "ch", "CHF", "Consumo", "#d3bc9f"],
  ["YPF", "YPF (ADR)", "NYSE", "us", "USD", "Energía", "#6aa9e5"],
];
export const catalog: Asset[] = entries.map(
  ([symbol, name, exchange, country, currency, sector, color]) => ({
    id: `${exchange}:${symbol}`,
    symbol,
    name,
    exchange,
    country,
    currency,
    sector,
    color,
    kind: "accion",
    underlying: symbol,
    tv: `${exchange}:${symbol}`,
  }),
);
export const cedearSeeds: Asset[] = catalog
  .filter((a) => a.country === "us" && a.symbol !== "YPF")
  .map((a) => ({
    ...a,
    id: `BCBA:${a.symbol}`,
    exchange: "BCBA",
    currency: "ARS",
    country: "ar",
    kind: "cedear",
    tv: `BCBA:${a.symbol}`,
  }));
export const initialWatchlist = [catalog[0], catalog[1], cedearSeeds[7]];
export function currencyFor(country: string): string {
  return (
    (
      {
        us: "USD",
        ar: "ARS",
        gb: "GBP",
        jp: "JPY",
        hk: "HKD",
        ch: "CHF",
        ca: "CAD",
        au: "AUD",
        de: "EUR",
        fr: "EUR",
        nl: "EUR",
        es: "EUR",
        it: "EUR",
        br: "BRL",
        in: "INR",
        cn: "CNY",
      } as Record<string, string>
    )[country] || "XXX"
  );
}
