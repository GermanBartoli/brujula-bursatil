import { test } from "node:test";
import assert from "node:assert/strict";
import worker, {
  cedearCatalog,
  entityAsset,
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
test("Prioriza respaldo y usa la clave principal al agotarse su cuota", async () => {
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
  assert.ok(calls[0].includes("respaldo-prueba"));
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

test("La tercera clave recibe la consulta cuando se agota el respaldo", async () => {
  const keys: string[] = [];
  const fake = async (input: RequestInfo | URL) => {
    keys.push(new URL(String(input)).searchParams.get("api_token")!);
    return keys.length < 3
      ? Response.json(
          { error: { code: "usage_limit_reached" } },
          { status: 429 },
        )
      : Response.json({ data: [] });
  };
  await marketaux(
    { ...env, MARKETAUX_API_KEY_THIRD: "tercera-prueba" },
    "news/all",
    {},
    fake as typeof fetch,
  );
  assert.deepEqual(keys, [
    "respaldo-prueba",
    "tercera-prueba",
    "secreto-prueba",
  ]);
});

test("Noticias por empresa: caché compartida, paginación, deduplicación y errores parciales", async () => {
  const originalFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const saved = new Map<string, Response>();
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        match: async (r: Request) => saved.get(r.url)?.clone(),
        put: async (r: Request, response: Response) => {
          saved.set(r.url, response.clone());
        },
      },
    },
  });
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const symbol = url.searchParams.get("symbols")!;
    const page = url.searchParams.get("page");
    calls.push(
      `${symbol}:${page}:${url.searchParams.get("language")}:${url.searchParams.get("countries") || ""}`,
    );
    if (symbol === "FAIL")
      return Response.json(
        { error: { code: "invalid_api_token" } },
        { status: 401 },
      );
    return Response.json({
      meta: { found: 6, limit: 3 },
      data: [
        {
          uuid: `comun-${page}`,
          title: "Noticia común",
          url: `https://medio.test/comun-${page}`,
          entities: [{ symbol }],
          published_at: "2026-11-02",
        },
        {
          uuid: `${symbol}-${page}`,
          title: symbol,
          url: `https://medio.test/${symbol}-${page}`,
          entities: [{ symbol }],
          published_at: "2026-11-02",
        },
      ],
    });
  };
  const get = async (symbols: string, page = 1) => {
    const response = await worker.fetch(
      new Request(`https://test/api/news?symbols=${symbols}&page=${page}`),
      env,
    );
    assert.equal(response.status, 200);
    return response.json() as Promise<any>;
  };
  try {
    const [first, concurrent] = await Promise.all([
      get("AAPL,NVDA"),
      get("NVDA,AAPL"),
    ]);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.endsWith(":en:")));
    assert.equal(first.data.length, 3);
    assert.equal(concurrent.data.length, 3);
    assert.equal(first.data[0].entities.length, 2);
    assert.equal(first.hasMore, true);
    await get("AAPL");
    assert.equal(calls.length, 2);
    const second = await get("AAPL", 2);
    assert.equal(calls.length, 3);
    assert.equal(second.hasMore, false);
    assert.ok(second.data.every((a: any) => a.uuid.endsWith("-2")));
    const partial = await get("AAPL,FAIL");
    assert.equal(partial.data.length, 2);
    assert.equal(partial.warnings.length, 1);
    const beforeFilters = calls.length;
    await worker.fetch(
      new Request("https://test/api/news?symbols=AAPL&language=es&country=ar"),
      env,
    );
    assert.equal(calls.length, beforeFilters + 1);
    assert.ok(calls.at(-1)?.endsWith(":es:ar"));
    await worker.fetch(
      new Request("https://test/api/news?symbols=AAPL&language=es&country=ar"),
      env,
    );
    assert.equal(calls.length, beforeFilters + 1);
    assert.equal(
      (
        await worker.fetch(
          new Request("https://test/api/news?language=fr"),
          env,
        )
      ).status,
      400,
    );
    assert.equal(
      (await worker.fetch(new Request("https://test/api/news?country=xx"), env))
        .status,
      400,
    );
    assert.ok(!partial.warnings[0].includes("secreto-prueba"));
    assert.equal(
      (
        await worker.fetch(
          new Request("https://test/api/news?symbols=AAPL&page=0"),
          env,
        )
      ).status,
      400,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (descriptor) Object.defineProperty(globalThis, "caches", descriptor);
    else Reflect.deleteProperty(globalThis, "caches");
  }
});

test("La búsqueda remota argentina coincide con el instrumento local", () => {
  const asset = entityAsset({
    symbol: "TGNO4.BA",
    name: "Transportadora de Gas del Norte",
    country: "ar",
    exchange: null,
  });
  assert.equal(asset?.id, "BCBA:TGNO4");
  assert.equal(asset?.currency, "ARS");
});
