import type { Quote } from "../src/types";

export function providerSymbol(id: string): string | null {
  const parts = id.split(":");
  if (parts.length !== 2 || !/^[A-Z0-9.^_-]{1,24}$/.test(parts[1])) return null;
  const [exchange, symbol] = parts;
  const suffix: Record<string, string> = {
    NASDAQ: "",
    NYSE: "",
    AMEX: "",
    XETR: ".DE",
    FWB: ".F",
    LSE: ".L",
    HKEX: ".HK",
    TSE: ".T",
    SSE: ".SS",
    SZSE: ".SZ",
    SIX: ".SW",
    TSX: ".TO",
    ASX: ".AX",
  };
  // Euronext identifica varias bolsas: solo instrumentos con plaza conocida.
  if (exchange === "EURONEXT") {
    if (/\.(AS|PA|BR|LS)$/.test(symbol)) return symbol;
    return ["ASML", "VHYL", "VWRL"].includes(symbol) ? symbol + ".AS" : null;
  }
  // Los respaldos antiguos guardaban la plaza dentro del ticker bajo OTROS.
  if (exchange === "OTROS" && /\.(PA|AS|BR|LS|L|DE|F|HK|T|SS|SZ|SW|TO|AX)$/.test(symbol)) return symbol;
  if (!(exchange in suffix)) return null;
  const ticker = exchange === "HKEX" ? symbol.padStart(4, "0") : symbol;
  return suffix[exchange] && ticker.endsWith(suffix[exchange])
    ? ticker
    : ticker + suffix[exchange];
}

export function normalizeGlobal(
  raw: any,
  expectedSymbol: string,
): (Quote & { currency: string; asOf: string }) | null {
  const meta = raw?.chart?.result?.[0]?.meta;
  if (
    !meta ||
    meta.symbol?.toUpperCase() !== expectedSymbol.toUpperCase() ||
    !Number.isFinite(meta.regularMarketPrice) ||
    meta.regularMarketPrice <= 0 ||
    !Number.isFinite(meta.regularMarketTime) ||
    typeof meta.currency !== "string"
  )
    return null;
  // Londres puede informar peniques: 100 GBp = 1 GBP.
  const pence = meta.currency === "GBp" || meta.currency === "GBX";
  const price = meta.regularMarketPrice / (pence ? 100 : 1);
  const closes =
    raw?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(
      (n: unknown) => Number.isFinite(n),
    ) || [];
  const previous = meta.previousClose || closes.at(-2);
  const change = Number.isFinite(meta.regularMarketChangePercent)
    ? meta.regularMarketChangePercent
    : Number.isFinite(previous) && previous > 0
      ? (meta.regularMarketPrice / previous - 1) * 100
      : null;
  return {
    symbol: expectedSymbol,
    price,
    currency: pence ? "GBP" : meta.currency.toUpperCase(),
    asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
    change,
    volume: Number.isFinite(meta.regularMarketVolume)
      ? meta.regularMarketVolume
      : null,
  };
}

export function normalizeFx(raw: unknown) {
  const rates: Record<string, number> = { USD: 1 };
  const dates: string[] = [];
  if (!Array.isArray(raw)) return { rates, date: "" };
  for (const row of raw) {
    if (
      row.base === "USD" &&
      /^[A-Z]{3}$/.test(row.quote) &&
      row.quote !== "ARS" &&
      Number.isFinite(row.rate) &&
      row.rate > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    ) {
      rates[row.quote] = row.rate;
      dates.push(row.date);
    }
  }
  return { rates, date: dates.sort()[0] || "" };
}

export function validProfile(input: any): boolean {
  return (
    Array.isArray(input?.positions) &&
    input.positions.length > 0 &&
    input.positions.length <= 100 &&
    input.positions.every(
      (p: any) =>
        typeof p.symbol === "string" &&
        /^[A-Z0-9.^=_-]{1,30}$/i.test(p.symbol) &&
        typeof p.exchange === "string" &&
        /^[A-Z0-9_-]{1,30}$/i.test(p.exchange) &&
        typeof p.sector === "string" &&
        p.sector.length <= 100 &&
        typeof p.currency === "string" &&
        /^[A-Z]{3}$/.test(p.currency) &&
        ["bajo", "medio", "alto", "sin clasificar"].includes(p.risk) &&
        Number.isFinite(p.weight) &&
        p.weight >= 0 &&
        p.weight <= 100,
    ) &&
    Math.abs(
      input.positions.reduce((sum: number, p: any) => sum + p.weight, 0) - 100,
    ) < 0.1
  );
}
