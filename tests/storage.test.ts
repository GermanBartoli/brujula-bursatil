import test from "node:test";
import assert from "node:assert/strict";
import { emptyData, parseBackup, storageKey } from "../src/portfolio.ts";
import { savePortfolio } from "../src/portfolioStorage.ts";

function environment() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  let queue = Promise.resolve();
  const locks = {
    request: (_name: string, callback: () => unknown) => {
      const result = queue.then(callback);
      queue = result.then(() => {}, () => {});
      return result;
    },
  } as unknown as LockManager;
  return { storage, locks };
}

test("Dos pestañas conservan cambios simultáneos sobre el guardado más reciente", async () => {
  const { storage, locks } = environment();
  const original = emptyData();
  await savePortfolio(storage, locks, original);
  await Promise.all([
    savePortfolio(storage, locks, d => ({ ...d, currency: "ARS" })),
    savePortfolio(storage, locks, d => ({ ...d, watchlist: d.watchlist.slice(1) })),
  ]);
  const saved = parseBackup(JSON.parse(storage.getItem(storageKey)!));
  assert.equal(saved.currency, "ARS");
  assert.deepEqual(saved.watchlist, original.watchlist.slice(1));
});

test("El límite de 500 conserva el guardado y permite editar o quitar elementos", async () => {
  const { storage, locks } = environment();
  const data = emptyData();
  const asset = data.watchlist[0];
  data.watchlist = Array.from({ length: 500 }, (_, i) => ({ ...asset, id: "PRUEBA" + i, symbol: "P" + i }));
  data.positions = data.watchlist.map(asset => ({ asset, quantity: 1, cost: 1, updatedAt: new Date().toISOString() }));
  await savePortfolio(storage, locks, data);
  const before = storage.getItem(storageKey);
  for (const field of ["watchlist", "positions"] as const) {
    await assert.rejects(savePortfolio(storage, locks, d => ({ ...d, [field]: [...d[field], d[field][0]] })), /500/);
    assert.equal(storage.getItem(storageKey), before);
  }
  const edited = await savePortfolio(storage, locks, d => ({ ...d, positions: d.positions.map((p, i) => i === 0 ? { ...p, quantity: 2 } : p) }));
  assert.equal(edited.positions[0].quantity, 2);
  assert.equal(edited.positions.length, 500);
  await savePortfolio(storage, locks, d => ({ ...d, watchlist: d.watchlist.slice(1) }));
  const restored = await savePortfolio(storage, locks, d => ({ ...d, watchlist: [...d.watchlist, asset] }));
  assert.equal(restored.watchlist.length, 500);
  assert.doesNotThrow(() => parseBackup(JSON.parse(storage.getItem(storageKey)!)));
});

test("Un guardado dañado se conserva hasta una importación explícita y los fallos de almacenamiento no confirman éxito", async () => {
  const { storage, locks } = environment();
  storage.setItem(storageKey, "dañado");
  await assert.rejects(savePortfolio(storage, locks, d => d));
  assert.equal(storage.getItem(storageKey), "dañado");
  await savePortfolio(storage, locks, emptyData());
  assert.doesNotThrow(() => parseBackup(JSON.parse(storage.getItem(storageKey)!)));
  await assert.rejects(savePortfolio(storage, undefined, d => d), /navegador/);
  await assert.rejects(savePortfolio({ ...storage, setItem: () => { throw Error("Cuota agotada"); } }, locks, d => d), /Cuota/);
});
