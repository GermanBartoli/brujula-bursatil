import type { Asset, LocalData, Market, Position, Quote } from "./types";
import { initialWatchlist } from "./catalog.ts";
export const currencies = [
  "USD",
  "ARS",
  "EUR",
  "GBP",
  "CNY",
  "HKD",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "BRL",
  "INR",
];
export const storageKey = "brujula-bursatil:v1";
export function emptyData(): LocalData {
  return {
    version: 1,
    watchlist: initialWatchlist,
    positions: [],
    currency: "USD",
    lastVisit: new Date(0).toISOString(),
    lists: ["Principal"],
    assignments: {},
  };
}
export function validAsset(value: unknown): value is Asset {
  if (!value || typeof value !== "object") return false;
  const a = value as Asset;
  return (
    [
      "id",
      "symbol",
      "name",
      "exchange",
      "country",
      "currency",
      "sector",
      "underlying",
      "tv",
    ].every(
      (k) =>
        typeof a[k as keyof Asset] === "string" &&
        String(a[k as keyof Asset]).length <= 180,
    ) &&
    ["accion", "cedear", "etf"].includes(a.kind) &&
    /^[A-Z]{3}$/.test(a.currency) &&
    /^[A-Z0-9._:/^=\-]{1,80}$/i.test(a.id) &&
    /^[A-Z0-9._^=\-]{1,30}$/i.test(a.symbol)
  );
}
export function parseBackup(value: unknown): LocalData {
  if (!value || typeof value !== "object")
    throw Error("El archivo no contiene un respaldo válido.");
  const d = value as LocalData;
  if (
    d.version !== 1 ||
    !Array.isArray(d.watchlist) ||
    !Array.isArray(d.positions) ||
    d.watchlist.length > 500 ||
    d.positions.length > 500 ||
    !d.watchlist.every(validAsset) ||
    !d.positions.every(
      (p) =>
        validAsset(p.asset) &&
        Number.isFinite(p.quantity) &&
        p.quantity > 0 &&
        Number.isFinite(p.cost) &&
        p.cost >= 0 &&
        typeof p.updatedAt === "string" &&
        (p.costCurrency === undefined || currencies.includes(p.costCurrency)) &&
        (p.risk === undefined || ["alto", "medio", "bajo"].includes(p.risk)) &&
        (p.manualPrice === undefined ||
          (Number.isFinite(p.manualPrice) && p.manualPrice > 0)) &&
        (p.manualPriceAt === undefined ||
          (typeof p.manualPriceAt === "string" &&
            !Number.isNaN(Date.parse(p.manualPriceAt)))),
    ) ||
    !currencies.includes(d.currency)
  )
    throw Error(
      "El respaldo tiene datos inválidos o una versión incompatible.",
    );
  if (
    new Set(d.watchlist.map((a) => a.id)).size !== d.watchlist.length ||
    new Set(d.positions.map((p) => p.asset.id)).size !== d.positions.length
  )
    throw Error("El respaldo contiene instrumentos duplicados.");
  const lists =
    Array.isArray(d.lists) &&
    d.lists.length <= 30 &&
    d.lists.every(
      (l) => typeof l === "string" && l.length > 0 && l.length <= 40,
    )
      ? [...new Set(["Principal", ...d.lists])]
      : ["Principal"];
  const assignments = Object.fromEntries(
    Object.entries(d.assignments || {}).filter(
      ([id, v]) => d.watchlist.some((a) => a.id === id) && lists.includes(v),
    ),
  );
  return {
    version: 1,
    watchlist: d.watchlist,
    positions: d.positions,
    currency: d.currency,
    lastVisit:
      typeof d.lastVisit === "string" && !Number.isNaN(Date.parse(d.lastVisit))
        ? d.lastVisit
        : new Date(0).toISOString(),
    lists,
    assignments,
  };
}
export function quoteFor(
  asset: Asset,
  market: Market | null,
): Quote | undefined {
  const global = market?.global?.[asset.id];
  if (global && global.currency === asset.currency) return global;
  return (
    asset.kind === "cedear"
      ? asset.currency === "ARS"
        ? market?.cedears
        : []
      : asset.country === "ar" && asset.currency === "ARS"
        ? market?.argentina
        : asset.country === "us" && asset.currency === "USD"
          ? market?.usa
          : []
  )?.find((q) => q.symbol === asset.symbol);
}
export function convert(
  value: number,
  from: string,
  to: string,
  ccl: number | null,
  fx: Record<string, number> = {},
): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  const rates = { ...fx, USD: 1, ARS: ccl } as Record<string, number | null>;
  const source = rates[from],
    target = rates[to];
  if (
    !source ||
    !target ||
    !Number.isFinite(source) ||
    !Number.isFinite(target) ||
    source <= 0 ||
    target <= 0
  )
    return null;
  return (value / source) * target;
}
export function positionQuote(
  p: Position,
  market: Market | null,
): Quote | undefined {
  return p.manualPrice !== undefined
    ? {
        symbol: p.asset.symbol,
        price: p.manualPrice,
        change: null,
        volume: null,
      }
    : quoteFor(p.asset, market);
}
export function positionValue(
  p: Position,
  market: Market | null,
  currency: string,
) {
  const q = positionQuote(p, market);
  const value = q
    ? convert(
        q.price * p.quantity,
        p.asset.currency,
        currency,
        market?.ccl ?? null,
        market?.fx,
      )
    : null;
  const cost = convert(
    p.cost * p.quantity,
    p.costCurrency || p.asset.currency,
    currency,
    market?.ccl ?? null,
    market?.fx,
  );
  return { value, cost };
}
export function totals(
  positions: Position[],
  market: Market | null,
  currency: string,
) {
  let value = 0,
    cost = 0,
    missing = 0;
  for (const p of positions) {
    const { value: v, cost: c } = positionValue(p, market, currency);
    if (v === null || c === null) {
      missing++;
      continue;
    }
    value += v;
    cost += c;
  }
  return {
    value,
    cost,
    profit: value - cost,
    percent: cost ? ((value - cost) / cost) * 100 : null,
    missing,
  };
}
