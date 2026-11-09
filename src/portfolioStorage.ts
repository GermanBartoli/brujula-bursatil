import { emptyData, parseBackup, storageKey } from "./portfolio.ts";
import type { LocalData } from "./types";

export type DataChange = LocalData | ((current: LocalData) => LocalData);
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
type ExclusiveLock = Pick<LockManager, "request">;

// Leer, modificar y guardar bajo el mismo bloqueo evita sobrescrituras entre pestañas.
export async function savePortfolio(
  storage: StorageAccess,
  locks: ExclusiveLock | undefined,
  change: DataChange,
): Promise<LocalData> {
  if (!locks)
    throw Error("Este navegador no permite guardar de forma segura entre pestañas. Usá una versión actual de Chrome, Edge o Firefox.");
  return locks.request(storageKey, () => {
    let next: LocalData;
    if (typeof change === "function") {
      const saved = storage.getItem(storageKey);
      next = change(saved ? parseBackup(JSON.parse(saved)) : emptyData());
    } else {
      // La importación confirmada también permite recuperar un guardado dañado.
      next = change;
    }
    if (next.watchlist.length > 500 || next.positions.length > 500)
      throw Error("Podés guardar hasta 500 instrumentos en seguimiento y 500 posiciones. Quitá uno antes de agregar otro.");
    if (next.lists.length > 30)
      throw Error("Podés crear hasta 30 listas.");
    const data = parseBackup({ ...next, lastVisit: new Date().toISOString() });
    storage.setItem(storageKey, JSON.stringify(data));
    return data;
  });
}
