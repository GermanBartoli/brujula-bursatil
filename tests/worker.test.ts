import { test } from "node:test";
import assert from "node:assert/strict";
import worker, {
  cedearCatalog,
  marketaux,
  normalizeQuotes,
  parseAnalysis,
  sanitizeArticle,
  type Env,
} from "../worker/index.ts";
const env: Env = {
  ASSETS: { fetch: async () => new Response("app") },
  MARKETAUX_API_KEY: "secreto-prueba",
  MARKETAUX_API_KEY_BACKUP: "respaldo-prueba",
};
test("El catálogo no confunde especies D/C en dólares con CEDEARs en pesos", () => {
  const quotes = ["AAPL", "AAPLD", "AAPLC", "AMD"].map((symbol) => ({
    symbol,
    price: 1,
    change: 0,
    volume: 1,
  }));
  const result = cedearCatalog(quotes, [
    { arg_panel: "cedear", ticker_ar: "AMD", ticker_usa: "AMD" },
  ]);
  assert.deepEqual(
    result.map((a) => a.symbol),
    ["AAPL", "AMD"],
  );
  assert.ok(result.every((a) => a.currency === "ARS"));
});
test("Usa respaldo únicamente cuando se agota la cuota de la clave principal", async () => {
  const calls: string[] = [];
  const fake = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return calls.length === 1
      ? Response.json(
          { error: { code: "usage_limit_reached" } },
          { status: 429 },
        )
      : Response.json({ data: [] });
  };
  await marketaux(env, "news/all", {}, fake as typeof fetch);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("respaldo-prueba"));
});
test("No rota por credencial inválida ni filtra el error o la clave del proveedor", async () => {
  let calls = 0;
  const fake = async () => {
    calls++;
    return Response.json(
      { error: { message: "secreto-prueba", code: "invalid_api_token" } },
      { status: 401 },
    );
  };
  await assert.rejects(
    () => marketaux(env, "news/all", {}, fake as typeof fetch),
    (e) => e instanceof Error && !e.message.includes("secreto-prueba"),
  );
  assert.equal(calls, 1);
});
test("Valida respuestas y no transforma precios ausentes en ceros", () => {
  assert.deepEqual(
    normalizeQuotes([
      { symbol: "AAPL", c: 0 },
      { symbol: "NVDA", c: 100, pct_change: 2 },
    ]),
    [{ symbol: "NVDA", price: 100, change: 2, volume: null }],
  );
  assert.equal(
    sanitizeArticle({ uuid: "a", title: "x", url: "javascript:alert(1)" }),
    null,
  );
  assert.throws(() => parseAnalysis({ response: "sin datos" }));
  const a = parseAnalysis({
    response:
      '```json\n{"resumen":"Hechos","sentimiento":"positivo","relevancia":"alta","impacto":"Posible","justificacion":"Extracto"}\n```',
  });
  assert.equal(a.sentimiento, "positivo");
  assert.deepEqual(parseAnalysis({ response: a }), a);
  assert.deepEqual(
    parseAnalysis({ choices: [{ message: { content: JSON.stringify(a) } }] }),
    a,
  );
});
test("Rechaza símbolos inválidos, métodos incorrectos y análisis entre sitios", async () => {
  assert.equal(
    (
      await worker.fetch(
        new Request("https://test/api/news?symbols=%3Cscript%3E"),
        env,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://test/api/news", { method: "DELETE" }),
        env,
      )
    ).status,
    405,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://test/api/analyze", {
          method: "POST",
          headers: { Origin: "https://otro.test" },
          body: "{}",
        }),
        env,
      )
    ).status,
    403,
  );
});
