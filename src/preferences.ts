import type { Asset } from "./types";
import { validAsset } from "./portfolio.ts";

export type Theme = "oscuro" | "suave" | "claro";
export type NewsFilter = { id: string; name: string; assets: Asset[] };
export type Preferences = { theme: Theme; filters: NewsFilter[] };
export const preferencesKey = "brujula:preferencias:v1";
export function parsePreferences(value: unknown): Preferences {
  const data = value as Partial<Preferences> | null;
  return {
    theme:
      data && ["oscuro", "suave", "claro"].includes(data.theme || "")
        ? data.theme!
        : "oscuro",
    filters: Array.isArray(data?.filters)
      ? data.filters
          .filter(
            (f) =>
              f &&
              typeof f.id === "string" &&
              /^filtro:[a-z0-9-]+$/.test(f.id) &&
              typeof f.name === "string" &&
              f.name.trim().length > 0 &&
              f.name.length <= 40 &&
              Array.isArray(f.assets) &&
              f.assets.length > 0 &&
              f.assets.length <= 500 &&
              f.assets.every(validAsset),
          )
          .slice(0, 30)
          .filter((f, i, all) => all.findIndex((x) => x.id === f.id) === i)
      : [],
  };
}
export function loadPreferences(): Preferences {
  try {
    return parsePreferences(
      JSON.parse(localStorage.getItem(preferencesKey) || "null"),
    );
  } catch {
    return parsePreferences(null);
  }
}
