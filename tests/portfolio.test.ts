import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, emptyData, parseBackup, totals } from "../src/portfolio.ts";
import type { Asset, Market } from "../src/types.ts";
const asset: Asset = {
  id: "BCBA:AAPL",
  symbol: "AAPL",
  name: "Apple",
  exchange: "BCBA",
  country: "ar",
  currency: "ARS",
  kind: "cedear",
  sector: "Tecnología",
  underlying: "AAPL",
  tv: "BCBA:AAPL",
};
const market: Market = {
  usa: [{ symbol: "AAPL", price: 250, change: 2, volume: 1 }],
  cedears: [{ symbol: "AAPL", price: 20000, change: 1, volume: 1 }],
  ccl: 1000,
  fetchedAt: "",
  warnings: [],
};
test("Valora CEDEARs con su propio precio y convierte costo y valor al mismo CCL", () => {
  const result = totals(
    [{ asset, quantity: 10, cost: 15000, updatedAt: "" }],
    market,
    "USD",
  );
  assert.equal(result.value, 200);
  assert.equal(result.cost, 150);
  assert.equal(result.profit, 50);
  assert.equal(result.missing, 0);
});
test("No inventa conversiones ni trata cotizaciones ausentes como pérdidas", () => {
  assert.equal(convert(100, "EUR", "USD", 1000), null);
  assert.equal(convert(100, "ARS", "USD", null), null);
  const result = totals(
    [{ asset, quantity: 10, cost: 15000, updatedAt: "" }],
    null,
    "ARS",
  );
  assert.equal(result.missing, 1);
  assert.equal(result.profit, 0);
  assert.equal(result.percent, null);
});
test("Rechaza respaldos incompatibles, duplicados y cantidades inválidas", () => {
  assert.throws(() => parseBackup({ version: 2 }));
  const d = emptyData();
  assert.deepEqual(parseBackup(d), d);
  assert.throws(() => parseBackup({ ...d, watchlist: [asset, asset] }));
  assert.throws(() =>
    parseBackup({
      ...d,
      positions: [{ asset, quantity: -1, cost: 100, updatedAt: "" }],
    }),
  );
  assert.throws(() =>
    parseBackup({ ...d, watchlist: [{ ...asset, symbol: "<script>" }] }),
  );
});

test("TGNO4 se valora como acción argentina en pesos, separada del CEDEAR y ADR", async () => {
  const { argentinaSeeds } = await import("../src/argentina.ts");
  const tgn = argentinaSeeds.find((a) => a.symbol === "TGNO4")!;
  assert.ok(tgn.name.includes("Transportadora de Gas del Norte"));
  assert.equal(tgn.kind, "accion");
  assert.equal(tgn.underlying, "TGNO4.BA");
  assert.equal(tgn.tv, "BCBA:TGNO4");
  assert.ok(argentinaSeeds.length >= 70);
  assert.equal(
    new Set(argentinaSeeds.map((a) => a.id)).size,
    argentinaSeeds.length,
  );
  const result = totals(
    [{ asset: tgn, quantity: 2, cost: 2000, updatedAt: "" }],
    {
      ...market,
      argentina: [{ symbol: "TGNO4", price: 3000, change: 1, volume: 10 }],
    },
    "ARS",
  );
  assert.equal(result.value, 6000);
  assert.equal(result.profit, 2000);
  assert.equal(result.missing, 0);
});
