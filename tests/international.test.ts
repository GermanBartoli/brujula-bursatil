import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalog,
  newsSymbol,
  searchText,
  matchesSearch,
  parseListingQuery,
} from "../src/catalog.ts";
import {
  convert,
  emptyData,
  parseBackup,
  quoteFor,
  totals,
} from "../src/portfolio.ts";
import { indicatorStatus, riskBreakdown, scenario } from "../src/insights.ts";
import {
  normalizeFx,
  normalizeGlobal,
  providerSymbol,
  validProfile,
} from "../worker/instruments.ts";
import worker, { entityAsset } from "../worker/index.ts";
import type { Market, Position } from "../src/types.ts";
const etf = catalog.find((a) => a.id === "EURONEXT:VHYL")!;
const gbpEtf = catalog.find((a) => a.id === "LSE:VHYL")!;
const market: Market = {
  usa: [],
  cedears: [],
  ccl: 1000,
  fx: { EUR: 0.8, GBP: 0.5, CNY: 7 },
  fetchedAt: "",
  warnings: [],
  global: {
    [etf.id]: {
      symbol: "VHYL.AS",
      price: 80,
      currency: "EUR",
      asOf: "2026-11-02",
      change: null,
      volume: null,
    },
  },
};

test("Los códigos de NVIDIA distinguen Xetra, Frankfurt y Nasdaq", () => {
  for (const query of [
    "ETR:NVD",
    "XETR:NVD",
    "XETRA:NVD",
    "NVD:ETR",
    "nvd.de",
    '=GOOGLEFINANCE("ETR:NVD"; "price")',
  ]) {
    assert.equal(searchText(query), "xetr:nvd");
    const found = catalog.filter((a) => matchesSearch(a, query));
    assert.equal(found.length, 1);
    assert.equal(found[0].id, "XETR:NVD");
    assert.equal(found[0].currency, "EUR");
  }
  for (const query of ["FRA:NVD", "FWB:NVD", "XFRA:NVD", "NVD.F"])
    assert.equal(catalog.find((a) => matchesSearch(a, query))?.id, "FWB:NVD");
  assert.equal(
    catalog.find((a) => matchesSearch(a, "NASDAQ:NVDA"))?.currency,
    "USD",
  );
  assert.equal(newsSymbol(catalog.find((a) => a.id === "FWB:NVD")!), "NVD.F");
  assert.equal(providerSymbol("XETR:NVD"), "NVD.DE");
  assert.equal(providerSymbol("FWB:NVD"), "NVD.F");
  assert.equal(parseListingQuery("ETR:../secret"), null);
  assert.equal(parseListingQuery("MERCADO:NVD"), null);
});

test("La búsqueda por bolsa resuelve acciones fuera del catálogo sin recurrir al ticker USD", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const env = { ASSETS: { fetch: async () => new Response() } };
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({
      chart: {
        result: [
          {
            meta: {
              symbol: "SIE.DE",
              longName: "Siemens",
              instrumentType: "EQUITY",
              currency: "EUR",
              regularMarketPrice: 270,
              regularMarketTime: 1793637306,
            },
          },
        ],
      },
    });
  };
  try {
    const known = await worker.fetch(
      new Request("https://test/api/search?q=ETR%3ANVD"),
      env,
    );
    assert.equal(known.status, 200);
    assert.equal(((await known.json()) as any).data[0].id, "XETR:NVD");
    assert.equal(calls.length, 0);
    const response = await worker.fetch(
      new Request("https://test/api/search?q=ETR%3ASIE"),
      env,
    );
    assert.equal(response.status, 200);
    const asset = ((await response.json()) as any).data[0];
    assert.equal(asset.id, "XETR:SIE");
    assert.equal(asset.currency, "EUR");
    assert.ok(calls[0].includes("/SIE.DE?"));
    const invalid = await worker.fetch(
      new Request("https://test/api/search?q=ETR%3AINEXISTENTE"),
      env,
    );
    assert.equal(invalid.status, 404);
    const conflict = await worker.fetch(
      new Request("https://test/api/search?q=ETR%3ANVD&country=us"),
      env,
    );
    assert.deepEqual(((await conflict.json()) as any).data, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Convierte EUR, GBP, CNY y ARS vía USD sin sumar monedas originales", () => {
  assert.equal(convert(80, "EUR", "GBP", 1000, market.fx), 50);
  assert.equal(convert(700, "CNY", "ARS", 1000, market.fx), 100000);
  assert.equal(convert(80, "EUR", "ARS", null, market.fx), null);
  assert.equal(convert(80, "EUR", "USD", 1000, { EUR: -1 }), null);
  assert.equal(convert(Infinity, "EUR", "EUR", 1000), null);
  const positions: Position[] = [
    {
      asset: etf,
      quantity: 2,
      cost: 90,
      costCurrency: "USD",
      risk: "bajo",
      updatedAt: "",
    },
    {
      asset: gbpEtf,
      quantity: 1,
      cost: 40,
      manualPrice: 50,
      risk: "alto",
      updatedAt: "",
    },
  ];
  const result = totals(positions, market, "EUR");
  assert.equal(result.value, 240);
  assert.equal(result.cost, 208);
  assert.equal(result.profit, 32);
  const risk = riskBreakdown(positions, market, "USD");
  assert.equal(risk.total, 300);
  assert.ok(
    Math.abs(risk.groups.find((g) => g.risk === "alto")!.percent - 100 / 3) <
      1e-8,
  );
});

test("Separa VHYL por bolsa, valida moneda y reconoce GOOGLEFINANCE", () => {
  assert.equal(
    searchText('=GOOGLEFINANCE("AMS:VHYL"; "price")'),
    "euronext:vhyl",
  );
  assert.equal(searchText('=GOOGLEFINANCE("IBKR"; "price")'), "ibkr");
  assert.equal(providerSymbol(etf.id), "VHYL.AS");
  assert.equal(providerSymbol(gbpEtf.id), "VHYL.L");
  assert.equal(providerSymbol("XETR:SAP.DE"), "SAP.DE");
  assert.equal(providerSymbol("OTROS:VHYL"), null);
  assert.equal(providerSymbol("NASDAQ:../secret"), null);
  assert.equal(newsSymbol(etf), "VHYL.AS");
  assert.equal(newsSymbol(gbpEtf), "VHYL.L");
  assert.equal(quoteFor(gbpEtf, market), undefined);
  assert.equal(quoteFor({ ...etf, currency: "USD" }, market), undefined);
  assert.equal(
    quoteFor(
      { ...etf, kind: "cedear", currency: "USD" },
      {
        ...market,
        cedears: [{ symbol: "VHYL", price: 1000, change: 0, volume: 1 }],
      },
    ),
    undefined,
  );
});

test("Normaliza peniques británicos y rechaza precios de otro instrumento", () => {
  const raw = {
    chart: {
      result: [
        {
          meta: {
            symbol: "VHYL.L",
            currency: "GBp",
            regularMarketPrice: 7200,
            regularMarketTime: 1793637306,
            previousClose: 7000,
          },
        },
      ],
    },
  };
  const quote = normalizeGlobal(raw, "VHYL.L")!;
  assert.equal(quote.currency, "GBP");
  assert.equal(quote.price, 72);
  assert.equal(normalizeGlobal(raw, "VHYL.AS"), null);
  assert.deepEqual(
    normalizeFx([
      { base: "USD", quote: "ARS", rate: 10, date: "2026-11-02" },
      { base: "USD", quote: "EUR", rate: 0.8, date: "2026-11-02" },
      { base: "USD", quote: "GBP", rate: -1, date: "2026-11-02" },
    ]).rates,
    { USD: 1, EUR: 0.8 },
  );
});

test("Respaldo conserva multimoneda y riesgo, rechaza extensiones inválidas", () => {
  const backup = {
    ...emptyData(),
    currency: "EUR",
    positions: [
      {
        asset: etf,
        quantity: 2,
        cost: 70,
        costCurrency: "GBP",
        risk: "bajo",
        manualPrice: 80,
        manualPriceAt: "2026-11-02",
        updatedAt: "2026-11-02",
      },
    ],
  };
  assert.deepEqual(parseBackup(backup), backup);
  for (const field of [
    { risk: "inventado" },
    { manualPrice: -1 },
    { costCurrency: "ZZZ" },
    { manualPriceAt: "ayer" },
  ])
    assert.throws(() =>
      parseBackup({
        ...backup,
        positions: [{ ...backup.positions[0], ...field }],
      }),
    );
});

test("Riesgo excluye faltantes y muestra las posiciones sin clasificar", () => {
  const report = riskBreakdown(
    [
      { asset: etf, quantity: 1, cost: 50, updatedAt: "" },
      { asset: gbpEtf, quantity: 1, cost: 50, updatedAt: "" },
    ],
    market,
    "USD",
  );
  assert.equal(report.missing, 1);
  assert.equal(
    report.groups.find((g) => g.risk === "sin clasificar")!.percent,
    100,
  );
});

test("Escenario usa puntos porcentuales explícitos y no admite pérdida mayor al 100%", () => {
  assert.deepEqual(scenario(1000, 5, 4.5, 3, 2.5, -4, -2), {
    change: 3,
    impact: 30,
    result: 1030,
  });
  assert.equal(scenario(1000, 0, 100, 0, 0, -2, 0), null);
  assert.equal(indicatorStatus(0, "-3"), "Fuera de referencia");
  assert.equal(indicatorStatus(0, ""), "Sin dato");
  assert.equal(indicatorStatus(9, "12"), "En referencia");
  assert.equal(indicatorStatus(13, "3"), "Revisar tendencia / contexto");
});

test("Valida la distribución enviada a IA y no permite pesos inventados", () => {
  const position = {
    symbol: "VHYL",
    exchange: "EURONEXT",
    currency: "EUR",
    sector: "Fondos",
    risk: "medio",
    weight: 100,
  };
  assert.equal(validProfile({ positions: [position] }), true);
  assert.equal(
    validProfile({ positions: [{ ...position, weight: 101 }] }),
    false,
  );
  assert.equal(
    validProfile({ positions: [{ ...position, weight: 70 }] }),
    false,
  );
  assert.equal(validProfile({ positions: [] }), false);
});

test("La entidad remota conserva la bolsa y reutiliza el ETF conocido", () => {
  assert.equal(
    entityAsset({
      symbol: "VHYL.AS",
      name: "Vanguard",
      country: "nl",
      exchange: "XAMS",
      type: "etf",
    })?.id,
    "EURONEXT:VHYL",
  );
  assert.equal(
    entityAsset({
      symbol: "EJEMPLO.L",
      name: "Fondo",
      country: "gb",
      exchange: "XLON",
      type: "etf",
    })?.currency,
    "XXX",
  );
  assert.equal(
    entityAsset({
      symbol: "EJEMPLO.L",
      name: "Fondo",
      country: "gb",
      exchange: "XLON",
      type: "etf",
      currency: "USD",
    })?.currency,
    "USD",
  );
});

test("Noticias de Asia envían países concretos y la IA recibe solo pesos", async () => {
  const originalFetch = globalThis.fetch;
  let countries = "",
    aiInput = "";
  const env = {
    ASSETS: { fetch: async () => new Response() },
    MARKETAUX_API_KEY: "prueba",
    AI: {
      run: async (_model: string, input: unknown) => {
        aiInput = JSON.stringify(input);
        return { response: "Perfil de cartera de prueba." };
      },
    },
  };
  globalThis.fetch = async (input) => {
    countries = new URL(String(input)).searchParams.get("countries") || "";
    return Response.json({ data: [], meta: { found: 0 } });
  };
  try {
    const news = await worker.fetch(
      new Request("https://test/api/news?country=asia"),
      env,
    );
    assert.equal(news.status, 200);
    assert.equal(countries, "cn,hk,jp,in");
    const body = {
      positions: [
        {
          symbol: "VHYL",
          exchange: "EURONEXT",
          currency: "EUR",
          sector: "Fondos",
          risk: "medio",
          weight: 100,
          cost: 123456,
          quantity: 98765,
        },
      ],
    };
    const response = await worker.fetch(
      new Request("https://test/api/portfolio-analysis", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.ok(!aiInput.includes("123456"));
    assert.ok(!aiInput.includes("98765"));
    assert.equal(
      (
        await worker.fetch(
          new Request("https://test/api/portfolio-analysis", {
            method: "POST",
            headers: { Origin: "https://otro" },
            body: JSON.stringify(body),
          }),
          env,
        )
      ).status,
      403,
    );
    assert.equal(
      (await worker.fetch(new Request("https://test/api/quotes?ids="), env))
        .status,
      400,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NVIDIA conserva sus plazas y convierte ambos importes antes de restar", () => {
  for (const id of ["FWB:NVD", "XETR:NVD"]) {
    const asset = catalog.find(a => a.id === id)!;
    const p = { asset, quantity: 2, cost: 193.90, updatedAt: "" };
    const m = { ...market, global: { [id]: { symbol: providerSymbol(id)!, price: 184, currency: "EUR", asOf: "", change: null, volume: null } } };
    const usd = totals([p], m, "USD");
    assert.equal(usd.value, 460);
    assert.ok(Math.abs(usd.cost - 484.75) < 1e-8);
    assert.ok(Math.abs(usd.profit + 24.75) < 1e-8);
    assert.equal(totals([p], { ...m, fx: {} }, "USD").missing, 1);
    assert.equal(quoteFor(asset, { ...m, global: { [id]: { ...m.global[id], currency: "USD" } } }), undefined);
  }
});
test("ISIN y CUSIP ofrecen plazas; FIGI compuesto conserva la estadounidense", () => {
  for (const q of ["US67066G1040", "CUSIP:67066G104", "ISIN US67066G1040"])
    assert.deepEqual(catalog.filter(a => matchesSearch(a,q)).map(a => a.id).sort(), ["FWB:NVD", "NASDAQ:NVDA", "XETR:NVD"]);
  assert.deepEqual(catalog.filter(a => matchesSearch(a,"BBG000BBJQV0")).map(a => a.id), ["NASDAQ:NVDA"]);
});
