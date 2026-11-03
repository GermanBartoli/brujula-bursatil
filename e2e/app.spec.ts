import { test, expect } from "@playwright/test";
import { catalog, cedearSeeds } from "../src/catalog";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/market"
        ? {
            usa: [
              { symbol: "NVDA", price: 150, change: 2, volume: 100 },
              { symbol: "AAPL", price: 200, change: -1, volume: 200 },
            ],
            cedears: [],
            ccl: 1000,
            fetchedAt: new Date().toISOString(),
            warnings: [],
          }
        : path === "/api/news"
          ? { data: [], fetchedAt: "", source: "Marketaux" }
          : path === "/api/catalog"
            ? { data: [...catalog, ...cedearSeeds] }
            : { data: [], hasMore: false };
    await route.fulfill({ json: body });
  });
  await page.route("https://s3.tradingview.com/**", (route) => route.abort());
  await page.goto("/");
});
test("Registra una posición, persiste al recargar y exporta respaldo", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Agregar acción", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar", exact: true })
    .first()
    .click();
  await page.getByLabel("Cantidad de títulos").fill("10");
  await page.getByLabel(/Precio promedio/).fill("100");
  await page.getByRole("button", { name: "Guardar posición" }).click();
  await expect(page.getByRole("status")).toContainText("Posición guardada");
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("brujula-bursatil:v1")!),
  );
  expect(saved.positions[0].quantity).toBe(10);
  if (await page.getByRole("button", { name: "Abrir menú" }).isVisible())
    await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Preferencias y respaldo" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar respaldo" }).click();
  expect((await download).suggestedFilename()).toMatch(/brujula-respaldo/);
});
test("La pantalla no desborda horizontalmente y el buscador es accesible por teclado", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Tu próximo horizonte." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Agregar acción", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("Importa un respaldo con confirmación y conserva los datos ante un archivo inválido", async ({
  page,
}) => {
  if (await page.getByRole("button", { name: "Abrir menú" }).isVisible())
    await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Preferencias y respaldo" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalido.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.getByRole("status")).toContainText("incompatible");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brujula-bursatil:v1")!).watchlist
          .length,
    ),
  ).toBe(3);
  const backup = {
    version: 1,
    watchlist: [catalog[0]],
    positions: [],
    currency: "ARS",
    lastVisit: "2026-01-01T00:00:00Z",
    lists: ["Principal"],
    assignments: {},
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "respaldo.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brujula-bursatil:v1")!).watchlist
          .length,
    ),
  ).toBe(3);
  await page.getByRole("button", { name: "Reemplazar e importar" }).click();
  await expect(page.getByRole("status")).toContainText("Respaldo importado");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brujula-bursatil:v1")!).watchlist
          .length,
    ),
  ).toBe(1);
});

test("Las secciones conservan su URL al recargar y al navegar atrás y adelante", async ({ page }) => {
  await page.goto("/analisis");
  await expect(page.getByRole("button", { name: "Buscar otro ticker" })).toBeVisible();
  if (await page.getByRole("button", { name: "Abrir menú" }).isVisible())
    await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Mi cartera", exact: true }).click();
  await expect(page).toHaveURL(/\/cartera$/);
  await page.reload();
  await expect(page).toHaveURL(/\/cartera$/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Buscar otro ticker" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/cartera$/);
});

test("Permite analizar otro ticker sin registrar una posición", async ({ page }) => {
  await page.goto("/analisis");
  await page.getByRole("button", { name: "Buscar otro ticker" }).click();
  await page.getByRole("textbox", { name: "Buscar instrumento" }).fill("AAPL");
  await page.locator(".search-result").filter({ hasText: "Apple" }).first().getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Apple · AAPL", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/analisis$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("brujula-bursatil:v1")!).positions)).toHaveLength(0);
  await expect.poll(() => page.locator('.widget-financials script').textContent()).toContain('NASDAQ:AAPL');
  await expect.poll(() => page.locator('.widget-technical script').textContent()).toContain('NASDAQ:AAPL');
});
