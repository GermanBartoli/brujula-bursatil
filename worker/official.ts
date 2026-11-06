import type { Article } from "../src/types";
export const officialFeeds: Record<string, string> = {
  NVDA: "https://nvidianews.nvidia.com/cats/press_release.xml",
  NVD: "https://nvidianews.nvidia.com/cats/press_release.xml",
  IBKR: "https://investors.interactivebrokers.com/en/general/about/press-releases-nav.php",
};
function plain(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
export async function parseOfficial(text: string, key: string): Promise<Article[]> {
  const rows: { title: string; description: string; url: string; date: string }[] = [];
  if (key === "IBKR") {
    const pattern = /<span class="month">([^<]+)<\/span>[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
    for (const match of text.matchAll(pattern)) {
      const file = match[2].match(/getFile\('([a-zA-Z0-9_.-]+\.pdf)'\)/)?.[1];
      const href = match[2].match(/(?:href|data-url)="([^"]+)"/)?.[1];
      const url = file ? "https://www.interactivebrokers.com/mkt/getFileNew.php?file=" + encodeURIComponent(file) : href && href !== "#" ? new URL(href, officialFeeds.IBKR).href : "";
      rows.push({ title: plain(match[2]), description: plain(match[3]), url, date: match[1].trim() + " 00:00:00 GMT" });
    }
  } else {
    const tag = (item: string, name: string) => plain(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || "");
    for (const match of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      rows.push({ title: tag(match[1], "title"), description: tag(match[1], "description"), url: tag(match[1], "link"), date: tag(match[1], "pubDate") });
    }
  }
  const valid = rows.filter(r => {
    try { const u = new URL(r.url); return u.protocol === "https:" && (key === "IBKR" ? /(^|\.)interactivebrokers\.(com|co\.jp)$/.test(u.hostname) : /(^|\.)nvidia\.com$/.test(u.hostname)) && r.title && Number.isFinite(Date.parse(r.date)); } catch { return false; }
  }).sort((a,b) => Date.parse(b.date)-Date.parse(a.date)).slice(0, 60);
  return Promise.all(valid.map(async r => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(r.url));
    const uuid = "official-" + Array.from(new Uint8Array(hash)).map(n => n.toString(16).padStart(2,"0")).join("");
    return { uuid, title: r.title.slice(0,500), description: r.description.slice(0,3000), url: r.url, image_url: null, published_at: new Date(r.date).toISOString(), source: key === "IBKR" ? "Interactive Brokers · comunicado oficial" : "NVIDIA · comunicado oficial", entities: [{ symbol: key === "NVD" ? "NVD.DE" : key }] };
  }));
}
export async function fetchOfficial(key: string): Promise<Article[]> {
  const response = await fetch(officialFeeds[key], { signal: AbortSignal.timeout(12000), redirect: "manual", headers: { "User-Agent": "BrujulaBursatil/0.5 (+https://brujula-bursatil.pages.dev)", Accept: "application/rss+xml, application/xml, text/html" } });
  if (!response.ok) throw Error("La fuente oficial respondió HTTP " + response.status);
  const reader = response.body?.getReader();
  if (!reader) throw Error("Respuesta vacía.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2000000) throw Error("Respuesta demasiado grande."); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const articles = await parseOfficial(new TextDecoder().decode(bytes), key);
  if (!articles.length) throw Error("No se encontraron publicaciones verificables.");
  return articles;
}
