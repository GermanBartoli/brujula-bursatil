import { catalog, newsSymbol } from "../src/catalog.ts";
import { contextFor, directMention, treasuryContext } from "../src/news.ts";
import type { Article } from "../src/types";

const topics: Record<string, string> = {
  Tecnología: 'technology stocks semiconductor earnings',
  Consumo: 'consumer stocks retail earnings',
  Finanzas: 'bank stocks financial earnings',
  Energía: 'energy stocks oil prices',
  Comunicación: 'telecom media stocks',
  Salud: 'healthcare pharmaceutical stocks',
  Industria: 'industrial stocks manufacturing',
  Materiales: 'materials stocks mining',
  Inmobiliario: 'real estate REIT interest rates',
  Servicios: 'utilities stocks electricity',
  "Bonos del Tesoro": 'Treasury "interest rates"',
  "Europa diversificada": 'Europe stocks ECB inflation',
  "Fondos diversificados": 'stocks (inflation OR "interest rates" OR dividends OR regulation)',
};
const clean = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
export function fallbackQuery(symbols: string[], sector: string, domains: string[]) {
  const names = symbols.map(symbol => {
    const asset = catalog.find(a => newsSymbol(a) === symbol || a.symbol === symbol);
    if (asset?.kind === "etf") return "(" + topics[contextFor(asset)] + ")";
    const name = asset?.name.split(" · ")[0] || symbol;
    return '"' + name.replace(/["()]/g, " ") + '"';
  });
  const topic = sector ? topics[sector] : names.length ? "(" + names.join(" OR ") + ")" : topics["Fondos diversificados"];
  return `${topic} ${domains.length ? "(" + domains.map(d => "site:" + d).join(" OR ") + ")" : ""} when:30d`;
}
export async function parseNewsFeed(xml: string, symbols: string[], sector: string, domains: string[]): Promise<Article[]> {
  const articles: Article[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const tag = (name: string) => clean(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || "");
    const title = tag("title"), url = tag("link"), date = tag("pubDate");
    const source = tag("source");
    const sourceUrl = item.match(/<source\s+url="([^"]+)"/)?.[1] || "";
    let host: string;
    try { host = new URL(sourceUrl).hostname; const u = new URL(url); if (u.protocol !== "https:" || u.hostname !== "news.google.com") continue; } catch { continue; }
    if (!title || !Number.isFinite(Date.parse(date)) || (domains.length && !domains.some(d => host === d || host.endsWith("." + d)))) continue;
    const bonds = sector === "Bonos del Tesoro" || symbols.some(s => /^IB01(?:\.L)?$/.test(s));
    if (bonds && !treasuryContext({ title })) continue;
    const matched = symbols.filter(symbol => {
      const asset = catalog.find(a => newsSymbol(a) === symbol || a.symbol === symbol);
      return asset?.kind !== "etf" && directMention({ title, entities: [{ symbol, name: asset?.name.split(" · ")[0] || "" }] }, symbol);
    });
    const hasEtf = symbols.some(symbol => catalog.some(a => a.kind === "etf" && (newsSymbol(a) === symbol || a.symbol === symbol)));
    if (!sector && symbols.length && !hasEtf && !matched.length) continue;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
    articles.push({ uuid: "rss-" + Array.from(new Uint8Array(hash)).map(n => n.toString(16).padStart(2,"0")).join(""), title: title.slice(0,500), description: "Fuente alternativa RSS: solo se dispone del titular; abrí la fuente para leer el contenido completo.", url, image_url: null, published_at: new Date(date).toISOString(), source: source + " · Google News RSS", entities: matched.map(symbol => ({ symbol })) });
  }
  return [...new Map(articles.map(a => [a.url, a])).values()].sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,60);
}
export async function fallbackNews(symbols: string[], sector: string, domains: string[], language: string, country: string) {
  const languages = language === "en,es" ? ["en", "es"] : [language];
  const groups = await Promise.all(languages.map(async lang => {
    const region = /^[a-z]{2}$/.test(country) ? country.toUpperCase() : lang === "es" ? "AR" : "US";
    const url = new URL("https://news.google.com/rss/search");
    url.search = new URLSearchParams({ q: fallbackQuery(symbols, sector, domains), hl: `${lang}-${region}`, gl: region, ceid: `${region}:${lang}` }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "manual", headers: { "User-Agent": "BrujulaBursatil/0.5", Accept: "application/rss+xml, application/xml" } });
    if (!response.ok) throw Error("La fuente alternativa no respondió.");
    const text = await response.text();
    if (text.length > 2000000) throw Error("Respuesta demasiado grande.");
    return parseNewsFeed(text, symbols, sector, domains);
  }));
  return [...new Map(groups.flat().map(a => [a.url,a])).values()].sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at));
}
