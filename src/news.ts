import type { Asset } from "./types";

export const sectorFilters: Record<string, Record<string, string>> = {
  Tecnología: { industries: "Technology" },
  Consumo: { industries: "Consumer Cyclical,Consumer Defensive" },
  Finanzas: { industries: "Financial Services" },
  Energía: { industries: "Energy" },
  Comunicación: { industries: "Communication Services" },
  Salud: { industries: "Healthcare" },
  Industria: { industries: "Industrials" },
  Materiales: { industries: "Basic Materials" },
  Inmobiliario: { industries: "Real Estate" },
  Servicios: { industries: "Utilities" },
  "Bonos del Tesoro": { search: '"Treasury" | "Federal Reserve" | "interest rates" | "bonos del Tesoro" | "tasas de interés"' },
  "Europa diversificada": { search: '(Europe | European | eurozone | Europa | BCE | ECB) + (stocks | inflation | rates | regulation | acciones | inflación | tasas)' },
  "Fondos diversificados": { search: '"stock market" | "interest rates" | inflation | dividends | regulation | "mercado bursátil" | inflación | dividendos' },
};
export function contextFor(asset: Asset): string {
  if (/^IB01(?:\.L)?$/.test(asset.symbol) || /treasury|government bond/i.test(asset.name)) return "Bonos del Tesoro";
  if (/^MEUD(?:\.PA)?$/.test(asset.symbol)) return "Europa diversificada";
  if (asset.kind === "etf" && /^QQQ(?:\.|$)/.test(asset.symbol)) return "Tecnología";
  return sectorFilters[asset.sector] ? asset.sector : "Fondos diversificados";
}
export function parseDomains(value: string): string[] {
  const domains = [...new Set(value.toLowerCase().split(/[\s,]+/).filter(Boolean))];
  if (domains.length > 8 || domains.some(d => d.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(d))) throw Error("Ingresá hasta 8 dominios, sin rutas ni https://.");
  return domains;
}
export function directMention(article: any, symbol: string): boolean {
  const text = `${article.title || ""} ${article.description || ""} ${article.snippet || ""}`.toLowerCase();
  const entity = article.entities?.find((e: any) => e.symbol?.toUpperCase() === symbol.toUpperCase());
  if (!entity) return false;
  const name = String(entity.name || "").replace(/,?\s+(inc\.?|corp\.?|corporation|plc|ltd\.?|group|holdings?)(\s.*)?$/i, "").trim().toLowerCase();
  if (name.length >= 3 && new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(text)) return true;
  const ticker = symbol.split('.')[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:\\$|NASDAQ[:\\s]+|NYSE[:\\s]+|\\()${ticker}(?=[^A-Z0-9]|$)`, "i").test(text);
}
export const officialSources: Record<string, { name: string; url: string; domain: string }> = {
  NVDA: { name: "NVIDIA · inversores", url: "https://investor.nvidia.com/", domain: "nvidia.com" },
  NVD: { name: "NVIDIA · inversores", url: "https://investor.nvidia.com/", domain: "nvidia.com" },
  IBKR: { name: "Interactive Brokers · inversores", url: "https://investors.interactivebrokers.com/", domain: "interactivebrokers.com" },
  AAPL: { name: "Apple · inversores", url: "https://investor.apple.com/", domain: "apple.com" },
  MSFT: { name: "Microsoft · inversores", url: "https://www.microsoft.com/en-us/Investor/", domain: "microsoft.com" },
  MEUD: { name: "Amundi · documentación del fondo", url: "https://www.amundietf.de/de/professionell/products/equity/amundi-core-stoxx-europe-600-ucits-etf-acc/lu0908500753", domain: "amundietf.de" },
  IB01: { name: "iShares · ficha del fondo", url: "https://www.ishares.com/uk/individual/en/literature/fact-sheet/ib01-ishares-treasury-bond-0-1yr-ucits-etf-fund-fact-sheet-en-gb.pdf", domain: "ishares.com" },
  VHYL: { name: "Vanguard · información para inversores", url: "https://www.ie.vanguard/products", domain: "vanguard.co.uk" },
};
