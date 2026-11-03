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
catalog.push(
  ...(
    [
      [
        "VHYL",
        "Vanguard FTSE All-World High Dividend Yield UCITS ETF",
        "EURONEXT",
        "nl",
        "EUR",
        "etf",
      ],
      [
        "VWRL",
        "Vanguard FTSE All-World UCITS ETF",
        "EURONEXT",
        "nl",
        "EUR",
        "etf",
      ],
      [
        "VWCE",
        "Vanguard FTSE All-World UCITS ETF acumulación",
        "XETR",
        "de",
        "EUR",
        "etf",
      ],
      [
        "VHYL",
        "Vanguard High Dividend Yield · Londres",
        "LSE",
        "gb",
        "GBP",
        "etf",
      ],
      [
        "VHYD",
        "Vanguard High Dividend Yield · Londres USD",
        "LSE",
        "gb",
        "USD",
        "etf",
      ],
      ["SPY", "SPDR S&P 500 ETF", "AMEX", "us", "USD", "etf"],
      ["QQQ", "Invesco QQQ Trust", "NASDAQ", "us", "USD", "etf"],
      ["IBKR", "Interactive Brokers Group", "NASDAQ", "us", "USD", "accion"],
      ["NVD", "NVIDIA · Xetra", "XETR", "de", "EUR", "accion"],
      ["NVD", "NVIDIA · Frankfurt", "FWB", "de", "EUR", "accion"],
      ["ASML", "ASML Holding · ADR", "NASDAQ", "us", "USD", "accion"],
      ["BABA", "Alibaba · ADR", "NYSE", "us", "USD", "accion"],
      ["9988", "Alibaba · Hong Kong", "HKEX", "hk", "HKD", "accion"],
      ["600519", "Kweichow Moutai", "SSE", "cn", "CNY", "accion"],
      ["000001", "Ping An Bank", "SZSE", "cn", "CNY", "accion"],
    ] as const
  ).map(([symbol, name, exchange, country, currency, kind]) => ({
    id: exchange + ":" + symbol,
    symbol,
    name,
    exchange,
    country,
    currency,
    kind,
    sector:
      kind === "etf"
        ? "Fondos diversificados"
        : symbol === "IBKR" || symbol === "000001"
          ? "Finanzas"
          : "Otros",
    underlying: symbol,
    tv: exchange + ":" + symbol,
  })),
);
export const countries = [
  "us",
  "ar",
  "nl",
  "de",
  "fr",
  "gb",
  "cn",
  "hk",
  "jp",
  "in",
  "ch",
  "ca",
  "au",
  "br",
  "es",
  "it",
];
export const asianCountries = ["cn", "hk", "jp", "in"];
export function matchesCountry(country: string, filter: string) {
  return (
    !filter ||
    filter === "todos" ||
    (filter === "asia" ? asianCountries.includes(country) : country === filter)
  );
}
const listingMarkets = [
  {
    exchange: "XETR",
    country: "de",
    suffix: ".DE",
    aliases: ["ETR", "XETR", "XETRA"],
  },
  {
    exchange: "FWB",
    country: "de",
    suffix: ".F",
    aliases: ["FRA", "FWB", "XFRA"],
  },
  {
    exchange: "EURONEXT",
    country: "nl",
    suffix: ".AS",
    aliases: ["AMS", "XAMS", "EURONEXT"],
  },
  {
    exchange: "EURONEXT",
    country: "fr",
    suffix: ".PA",
    aliases: ["EPA", "XPAR"],
  },
  {
    exchange: "LSE",
    country: "gb",
    suffix: ".L",
    aliases: ["LON", "LSE", "XLON"],
  },
  {
    exchange: "NASDAQ",
    country: "us",
    suffix: "",
    aliases: ["NASDAQ", "XNAS"],
  },
  { exchange: "NYSE", country: "us", suffix: "", aliases: ["NYSE", "XNYS"] },
  {
    exchange: "HKEX",
    country: "hk",
    suffix: ".HK",
    aliases: ["HKG", "HKEX", "XHKG"],
  },
  {
    exchange: "TSE",
    country: "jp",
    suffix: ".T",
    aliases: ["TYO", "TSE", "XTKS"],
  },
];
function queryCode(query: string) {
  return query
    .trim()
    .replace(/^=GOOGLEFINANCE\(\s*["']([^"']+)["'].*$/i, "$1")
    .trim()
    .toUpperCase();
}
export function parseListingQuery(query: string) {
  const code = queryCode(query);
  const parts = code.split(":");
  let market = listingMarkets.find((m) => m.aliases.includes(parts[0]));
  let symbol = parts[1];
  if (parts.length === 2 && !market) {
    market = listingMarkets.find((m) => m.aliases.includes(parts[1]));
    symbol = parts[0];
  }
  if (parts.length === 1) {
    market = listingMarkets.find((m) => m.suffix && code.endsWith(m.suffix));
    symbol = market ? code.slice(0, -market.suffix.length) : "";
  }
  if (
    parts.length > 2 ||
    !market ||
    !symbol ||
    !/^[A-Z0-9_^.-]{1,24}$/.test(symbol)
  )
    return null;
  if (market.suffix && symbol.endsWith(market.suffix))
    symbol = symbol.slice(0, -market.suffix.length);
  if (!symbol) return null;
  return {
    exchange: market.exchange,
    country: market.country,
    suffix: market.suffix,
    symbol,
  };
}
export function searchText(query: string) {
  const listing = parseListingQuery(query);
  return listing
    ? `${listing.exchange}:${listing.symbol}`.toLowerCase()
    : queryCode(query).toLowerCase();
}
export function matchesSearch(asset: Asset, query: string) {
  const listing = parseListingQuery(query);
  if (listing)
    return (
      asset.exchange === listing.exchange &&
      asset.country === listing.country &&
      [listing.symbol, listing.symbol + listing.suffix].includes(
        asset.symbol.toUpperCase(),
      )
    );
  const identifier = queryCode(query).replace(/^(ISIN|CUSIP|FIGI)[:\s]+/, "");
  if (["US67066G1040", "67066G104"].includes(identifier))
    return ["NASDAQ:NVDA", "XETR:NVD", "FWB:NVD"].includes(asset.id);
  if (identifier === "BBG000BBJQV0") return asset.id === "NASDAQ:NVDA";
  return `${asset.name} ${asset.symbol} ${asset.exchange} ${asset.id}`
    .toLowerCase()
    .includes(searchText(query));
}
export function newsSymbol(asset: Asset): string {
  if (
    asset.kind === "cedear" ||
    asset.country === "us" ||
    asset.country === "ar" ||
    asset.underlying.includes(".")
  )
    return asset.underlying;
  const suffix: Record<string, string> = {
    nl: ".AS",
    de: ".DE",
    gb: ".L",
    hk: ".HK",
    jp: ".T",
    ch: ".SW",
    fr: ".PA",
    ca: ".TO",
    au: ".AX",
  };
  const ending =
    asset.exchange === "FWB"
      ? ".F"
      : asset.exchange === "SSE"
        ? ".SS"
        : asset.exchange === "SZSE"
          ? ".SZ"
          : suffix[asset.country];
  return asset.underlying + (ending || "");
}
export const cedearSeeds: Asset[] = catalog
  .filter(
    (a) => a.country === "us" && a.kind === "accion" && a.symbol !== "YPF",
  )
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
