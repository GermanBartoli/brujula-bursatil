import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/catalog.ts";
import { providerSymbol } from "../worker/instruments.ts";
import { contextFor, directMention, parseDomains } from "../src/news.ts";
import { riskBreakdown } from "../src/insights.ts";
import { totals } from "../src/portfolio.ts";
import { parseOfficial } from "../worker/official.ts";
import { summarizeNews } from "../worker/summary.ts";
import worker from "../worker/index.ts";
const env = { ASSETS: { fetch: async () => new Response() }, MARKETAUX_API_KEY: "prueba" };

test("Los tickers antiguos recuperan cotización sin cambiar moneda ni inventar bolsas", async () => {
  assert.equal(providerSymbol("OTROS:MEUD.PA"), "MEUD.PA");
  assert.equal(providerSymbol("OTROS:IB01.L"), "IB01.L");
  assert.equal(providerSymbol("OTROS:IB01"), null);
  assert.equal(providerSymbol("OTROS:../../IB01.L"), null);
  const old = globalThis.fetch;
  globalThis.fetch = async input => {
    const symbol = new URL(String(input)).pathname.split("/").at(-1);
    return Response.json({ chart: { result: [{ meta: { symbol, currency: symbol === "MEUD.PA" ? "EUR" : "USD", regularMarketPrice: 100, regularMarketTime: 1794000000 } }] } });
  };
  try {
    const r = await worker.fetch(new Request("https://test/api/quotes?ids=OTROS:MEUD.PA,OTROS:IB01.L"), env);
    assert.equal(r.status, 200);
    const data: any = await r.json();
    assert.equal(data.data.length, 2);
    assert.deepEqual(data.data.map((q: any) => q.quote.currency), ["EUR", "USD"]);
  } finally { globalThis.fetch = old; }
});

test("Riesgo incluye costo estimado sin inventar rendimiento ni conversiones", () => {
  const asset = catalog.find(a => a.symbol === "IB01")!;
  const positions = [{ asset, quantity: 2, cost: 100, risk: "bajo" as const, updatedAt: "" }];
  const report = riskBreakdown(positions, null, "USD", true);
  assert.equal(report.rows[0].weight, 100);
  assert.equal(report.rows[0].estimated, true);
  assert.equal(report.total, 200);
  assert.equal(riskBreakdown(positions, null, "EUR", true).missing, 1);
  assert.equal(riskBreakdown(positions, null, "USD", false).missing, 1);
  assert.equal(totals(positions, null, "USD").missing, 1);
});

test("Las menciones directas exigen evidencia textual y evitan tickers ambiguos", () => {
  const a = { title: "Apple announces results", entities: [{ symbol: "AAPL", name: "Apple Inc." }] };
  assert.equal(directMention(a, "AAPL"), true);
  assert.equal(directMention({ ...a, title: "Technology sector rises" }, "AAPL"), false);
  assert.equal(directMention({ ...a, title: "Pineapple demand rises" }, "AAPL"), false);
  assert.equal(directMention({ title: "Go to the market", entities: [{ symbol: "GO", name: "Grocery Outlet" }] }, "GO"), false);
  assert.equal(directMention({ ...a, title: "$AAPL announces results" }, "AAPL"), true);
  assert.equal(directMention({ ...a, entities: [] }, "AAPL"), false);
});

test("ETF usa clase de activo y sectores sin consultar su ticker en noticias", async () => {
  assert.equal(contextFor(catalog.find(a => a.symbol === "IB01")!), "Bonos del Tesoro");
  assert.equal(contextFor(catalog.find(a => a.symbol === "MEUD.PA")!), "Europa diversificada");
  const original = globalThis.fetch;
  const calls: URL[] = [];
  globalThis.fetch = async input => { calls.push(new URL(String(input))); return Response.json({ data: [], meta: {} }); };
  try {
    for (const symbol of ["IB01.L", "MEUD.PA", "VHYL.AS"]) {
      assert.equal((await worker.fetch(new Request("https://test/api/news?symbols=" + symbol), env)).status, 200);
    }
    assert.ok(calls.every(u => !u.searchParams.has("symbols") && u.searchParams.has("search")));
    assert.ok(calls[0].searchParams.get("search")?.includes("Treasury"));
    assert.equal((await worker.fetch(new Request("https://test/api/news?mode=sector&sector=Inventado"), env)).status, 400);
    assert.equal((await worker.fetch(new Request("https://test/api/news?domains=localhost/path"), env)).status, 400);
  } finally { globalThis.fetch = original; }
});

test("Fuentes personalizadas validan dominios y no aceptan URLs arbitrarias", () => {
  assert.deepEqual(parseDomains("Reuters.com, reuters.com cnbc.com"), ["reuters.com", "cnbc.com"]);
  for (const value of ["https://localhost", "127.0.0.1", "dominio.com/ruta", "user:pass@dominio.com"]) assert.throws(() => parseDomains(value));
});

test("Comunicados oficiales conservan fecha, fuente y enlace verificados", async () => {
  const rss = '<rss><item><title><![CDATA[NVIDIA results]]></title><description>Revenue &amp; outlook</description><link>https://nvidianews.nvidia.com/news/results</link><pubDate>Fri, 06 Nov 2026 12:00:00 GMT</pubDate></item><item><title>Falso</title><link>https://malicioso.test</link><pubDate>Fri, 06 Nov 2026 12:00:00 GMT</pubDate></item></rss>';
  const result = await parseOfficial(rss, "NVDA");
  assert.equal(result.length, 1);
  assert.equal(result[0].description, "Revenue & outlook");
  assert.equal(result[0].published_at, "2026-11-06T12:00:00.000Z");
  assert.match(result[0].uuid, /^official-[a-f0-9]{64}$/);
  const ibkr = await parseOfficial('<span class="month">November 2, 2026</span><h3><a onclick="getFile(\'metrics.pdf\')" href="#">IBKR metrics</a></h3><p>Resultados</p>', "IBKR");
  assert.equal(ibkr.length, 1);
  assert.equal(ibkr[0].url, "https://www.interactivebrokers.com/mkt/getFileNew.php?file=metrics.pdf");
  let payload = "";
  const summary = await summarizeNews({ ids: [result[0].uuid], sector: "Tecnología" }, { run: async (_m, p) => { payload = JSON.stringify(p); return { response: "Hechos [1]" }; } }, async () => result[0]);
  assert.equal(summary.sources[0].url, result[0].url);
  assert.ok(payload.includes("Revenue & outlook"));
  assert.ok(payload.includes("No inventes"));
});

test("El resumen rechaza entradas inválidas y solicitudes de otro origen", async () => {
  for (const body of ["null", "{}", '{"ids":["../ruta"],"sector":"Salud"}']) {
    const r = await worker.fetch(new Request("https://test/api/news-summary", { method: "POST", body }), env);
    assert.equal(r.status, 400);
  }
  const r = await worker.fetch(new Request("https://test/api/news-summary", { method: "POST", headers: { Origin: "https://otro.test" }, body: "{}" }), env);
  assert.equal(r.status, 403);
});
