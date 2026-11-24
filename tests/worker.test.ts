import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, {
  iaConCupo,
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
          title: "Noticia común de $AAPL y $NVDA",
          url: `https://medio.test/comun-${page}`,
          entities: [{ symbol }],
          published_at: "2026-11-02",
        },
        {
          uuid: `${symbol}-${page}`,
          title: "$" + symbol,
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
    const beforeBoth = calls.length;
    await worker.fetch(
      new Request("https://test/api/news?symbols=AAPL&language=en,es"),
      env,
    );
    assert.equal(calls.length, beforeBoth + 1);
    assert.ok(calls.at(-1)?.endsWith(":en,es:"));
    await worker.fetch(
      new Request("https://test/api/news?symbols=AAPL&language=en,es"),
      env,
    );
    assert.equal(calls.length, beforeBoth + 1);
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

test("Mercado y catálogo conservan las fuentes válidas si fallan los CEDEARs o la caché", async (t) => {
  const origen = "https://brujula-prueba.example";
  const peticionesCache: string[] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: {
      match: async (r: Request) => {
        peticionesCache.push(r.url);
        return new Response("contenido incompleto");
      },
      put: async () => { throw new Error("Caché no disponible"); },
    } },
  });
  t.mock.method(globalThis, "fetch", async (entrada: URL | string) => {
    const ruta = new URL(entrada).pathname;
    if (ruta.endsWith("/usa_stocks")) return Response.json([null, { symbol: "AAPL", c: 42 }]);
    if (ruta.endsWith("/arg_cedears")) return Response.json({ error: "datos no disponibles" });
    if (ruta.endsWith("/arg_stocks")) return Response.json([]);
    if (ruta.endsWith("/contadoconliqui")) return Response.json({ venta: 1234 });
    if (ruta.endsWith("/rates")) return Response.json([null, { base:"USD", quote:"EUR", rate:0.9, date:"2026-11-20" }]);
    throw Error("Fuente inesperada");
  });
  const mercado = await worker.fetch(new Request(origen + "/api/market"), env);
  assert.equal(mercado.status, 200);
  const datos = await mercado.json() as { usa: Array<{symbol:string}>, cedears: unknown[], warnings: string[], ccl:number, fx:Record<string,number> };
  assert.deepEqual(datos.usa.map(q => q.symbol), ["AAPL"]);
  assert.equal(datos.ccl, 1234);
  assert.equal(datos.fx.EUR, 0.9);
  assert.deepEqual(datos.cedears, []);
  assert.deepEqual(datos.warnings, ["Cotizaciones de CEDEARs no disponibles."]);
  const catalogo = await worker.fetch(new Request(origen + "/api/catalog"), env);
  assert.equal(catalogo.status, 200);
  const listado = await catalogo.json() as { data: Array<{kind:string}> };
  assert.ok(listado.data.some(a => a.kind === "cedear"));
  assert.ok(peticionesCache.length >= 2 && peticionesCache.every(u => new URL(u).origin === origen));
});

test("el cupo global cuenta llamadas reales por minuto y día UTC", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_cuota_ia.sql", import.meta.url), "utf8"));
  const binding = { prepare: (sql: string) => ({ first: async () => db.prepare(sql).get() }) };
  let llamadas = 0;
  const ia = iaConCupo({ ...env, CUOTA_IA: binding as unknown as D1Database,
    AI: { run: async () => ++llamadas } });
  const resultados = await Promise.allSettled(Array.from({ length: 12 }, () => ia.run("prueba", {})));
  assert.equal(resultados.filter(r => r.status === "fulfilled").length, 10);
  db.exec("UPDATE cuota_ia SET minuto=minuto-1, llamadas_dia=99");
  await ia.run("prueba", {});
  await assert.rejects(ia.run("prueba", {}), { status: 429 });
  db.exec("UPDATE cuota_ia SET minuto=minuto-1, dia=dia-1");
  await ia.run("prueba", {});
  assert.equal(llamadas, 12);
});
