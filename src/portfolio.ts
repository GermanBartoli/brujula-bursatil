import type { Asset, LocalData, Market, Position, Quote } from "./types";
import { initialWatchlist } from "./catalog.ts";
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
    ["accion", "cedear"].includes(a.kind) &&
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
        typeof p.updatedAt === "string",
    ) ||
    !["ARS", "USD"].includes(d.currency)
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
  return (
    asset.kind === "cedear"
      ? market?.cedears
      : asset.country === "ar" && asset.currency === "ARS"
        ? market?.argentina
        : asset.country === "us"
          ? market?.usa
          : []
  )?.find((q) => q.symbol === asset.symbol);
}
export function convert(
  value: number,
  from: string,
  to: string,
  ccl: number | null,
): number | null {
  if (from === to) return value;
  if (!ccl || ccl <= 0) return null;
  if (from === "ARS" && to === "USD") return value / ccl;
  if (from === "USD" && to === "ARS") return value * ccl;
  return null;
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
    const q = quoteFor(p.asset, market);
    const v = q
      ? convert(
          q.price * p.quantity,
          p.asset.currency,
          currency,
          market?.ccl ?? null,
        )
      : null;
    const c = convert(
      p.cost * p.quantity,
      p.asset.currency,
      currency,
      market?.ccl ?? null,
    );
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
