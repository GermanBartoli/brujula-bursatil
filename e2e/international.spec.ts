import { test, expect, type Page } from "@playwright/test";
import { catalog } from "../src/catalog";

async function go(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Abrir menú" }).isVisible())
    await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.route("https://s3.tradingview.com/**", (r) => r.abort());
  await page.route("**/api/**", async (r) => {
    const url = new URL(r.request().url());
    const body =
      url.pathname === "/api/market"
        ? {
            usa: [],
            cedears: [],
            ccl: 1000,
            fx: { EUR: 0.8, GBP: 0.5, CNY: 7 },
            fxDate: "2026-11-02",
            fetchedAt: "2026-11-02",
            warnings: [],
          }
        : url.pathname === "/api/catalog"
          ? { data: catalog }
          : url.pathname === "/api/news"
            ? { data: [], warnings: [] }
            : url.pathname === "/api/quotes"
              ? {
                  data: (url.searchParams.get("ids") || "")
                    .split(",")
                    .map((id) => ({
                      id,
                      quote: {
                        price: 80,
                        symbol: "VHYL.AS",
                        currency: "EUR",
                        asOf: "2026-11-02",
                        change: 0,
                        volume: 1,
                      },
                    })),
                  warnings: [],
                }
              : url.pathname === "/api/inflation"
                ? {
                    data: [
                      { year: 2025, value: 2 },
                      { year: 2024, value: 3 },
                    ],
                  }
                : url.pathname === "/api/portfolio-analysis"
                  ? {
                      analysis:
                        "Cartera concentrada en VHYL. Revisar exposición interna del ETF.",
                    }
                  : { data: [], hasMore: false };
    await r.fulfill({ json: body });
  });
  await page.goto("/");
});

test("Encuentra y registra NVIDIA alemana en EUR usando códigos de mercado", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Agregar acción", exact: true })
    .click();
  for (const code of [
    "ETR:NVD",
    "NVD.DE",
    "XETRA:NVD",
    "NVD:ETR",
    "FRA:NVD",
    "NVD.F",
  ]) {
    await page.getByLabel("Buscar instrumento").fill(code);
    await expect(page.locator(".search-result")).toHaveCount(1);
    await expect(page.locator(".search-result")).toContainText("EUR");
    await expect(page.locator(".search-result")).toContainText(
      code.includes("FRA") || code.endsWith(".F") ? "Frankfurt" : "Xetra",
    );
  }
  await page
    .getByLabel("Buscar instrumento")
    .fill('=GOOGLEFINANCE("ETR:NVD"; "price")');
  const requested = page.waitForRequest(
    (r) =>
      r.url().includes("/api/search?") &&
      new URL(r.url()).searchParams.get("q")?.includes("ETR:NVD") === true,
  );
  await requested;
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(
    page.getByLabel("Moneda de cotización"),
  ).toHaveValue("EUR");
  await expect(page.getByLabel("Moneda del precio de compra")).toHaveValue(
    "EUR",
  );
  await page.getByLabel("Cantidad de títulos").fill("2");
  await page.getByLabel(/Precio promedio/).fill("180");
  await page.getByRole("button", { name: "Guardar posición" }).click();
  await page.reload();
  const position = await page.evaluate(
    () => JSON.parse(localStorage.getItem("brujula-bursatil:v1")!).positions[0],
  );
  expect(position.asset.id).toBe("XETR:NVD");
  expect(position.asset.currency).toBe("EUR");
});

test("Busca AMS:VHYL, registra en otra moneda, convierte y clasifica el riesgo", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Agregar acción", exact: true })
    .click();
  await page
    .getByLabel("Buscar instrumento")
    .fill('=GOOGLEFINANCE("AMS:VHYL"; "price")');
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.getByLabel("Cantidad de títulos").fill("2");
  await page.getByLabel("Moneda del precio de compra").selectOption("USD");
  await page.getByLabel(/Precio promedio/).fill("90");
  await page.getByLabel("Mi clasificación de riesgo").selectOption("bajo");
  await page.getByRole("button", { name: "Guardar posición" }).click();
  await page.getByLabel("Moneda final de la cartera").selectOption("GBP");
  await go(page, "Mi cartera");
  await expect(page.locator(".metric").first()).toContainText("100,00");
  await expect(page.locator(".metric").nth(1)).toContainText("10,00");
  await go(page, "Riesgo y perfil");
  await expect(page.locator(".risk-bajo")).toContainText("100.0%");
  await page.getByRole("button", { name: "Analizar perfil con IA" }).click();
  await expect(page.locator(".portfolio-analysis")).toContainText(
    "Cartera concentrada",
  );
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brujula-bursatil:v1")!).positions[0]
          .costCurrency,
    ),
  ).toBe("USD");
});

test("Filtra ETFs por país y bolsa y noticias por Asia", async ({ page }) => {
  await go(page, "Explorar mercados");
  await page
    .getByLabel("Tipo de instrumento", { exact: true })
    .selectOption("etf");
  await page.getByLabel("País", { exact: true }).selectOption("nl");
  await page.getByLabel("Bolsa", { exact: true }).selectOption("EURONEXT");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText("VHYL");
  await expect(page.locator("tbody")).not.toContainText("LSE");
  await go(page, "Noticias e IA");
  const request = page.waitForRequest(
    (r) => r.url().includes("/api/news?") && r.url().includes("country=asia"),
  );
  await page.getByLabel("Mercado de las noticias").selectOption("asia");
  await request;
});

test("Evalúa fundamentos y navega las nuevas secciones sin desbordes", async ({
  page,
}) => {
  await go(page, "Análisis financiero");
  await page.getByLabel("Valor de P/E", { exact: true }).fill("18");
  await expect(
    page
      .getByRole("row")
      .filter({ has: page.getByLabel("Valor de P/E", { exact: true }) }),
  ).toContainText("En referencia");
  await page.getByRole("button", { name: "Buscar otro ticker" }).click();
  await page.getByLabel("Buscar instrumento").fill("IBKR");
  await page.locator(".search-result .asset-cell").first().click();
  await expect(
    page.getByRole("heading", { name: /Interactive Brokers Group/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Valor de P/E", { exact: true })).toHaveValue(
    "",
  );
  for (const section of [
    "Análisis financiero",
    "Riesgo y perfil",
    "Herramientas y divisas",
    "Calendario",
  ]) {
    await go(page, section);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator(".inflation-history")).toContainText("2025");
  await page.getByLabel("Tasa anterior (%)", { exact: true }).fill("5");
  await page
    .getByLabel("Tasa nueva / escenario (%)", { exact: true })
    .fill("4.5");
  await page
    .getByRole("button", { name: "Usar estos dos años en el escenario" })
    .click();
  await page.getByLabel("Sensibilidad a tasas", { exact: false }).fill("-4");
  await page
    .getByLabel("Sensibilidad a inflación", { exact: false })
    .fill("-2");
  await expect(page.locator(".analysis")).toContainText("4.00%");
  await expect(page.getByText("Variación de tasa:")).toContainText(
    "-50 puntos básicos",
  );
});
