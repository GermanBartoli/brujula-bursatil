import { test, expect } from "@playwright/test";
import { catalog } from "../src/catalog";

test("ETF activa contexto, permite elegir sector y conserva fuentes personalizadas", async ({ page }) => {
  await page.route("https://s3.tradingview.com/**", r => r.abort());
  const requests: URL[] = [];
  await page.route("**/api/**", async r => {
    const u = new URL(r.request().url());
    if (u.pathname === "/api/news") requests.push(u);
    await r.fulfill({ json: u.pathname === "/api/catalog" ? { data: catalog } : u.pathname === "/api/market" ? { usa: [], cedears: [], ccl: null, warnings: [], fetchedAt: "" } : { data: [], warnings: [] } });
  });
  await page.goto("/noticias");
  await page.getByRole("button", { name: "Agregar acción", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar instrumento" }).fill("IB01");
  await page.getByRole("button", { name: "Seguir IB01 LSE", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByLabel("Noticias de", { exact: true }).selectOption("LSE:IB01");
  await expect(page.getByLabel("Tipo de noticias")).toHaveValue("sector");
  await expect(page.getByLabel("Sector de noticias")).toHaveValue("Bonos del Tesoro");
  await expect.poll(() => requests.at(-1)?.searchParams.get("sector")).toBe("Bonos del Tesoro");
  await page.getByLabel("Sector de noticias").selectOption("Salud");
  await expect.poll(() => requests.at(-1)?.searchParams.get("sector")).toBe("Salud");
  await page.getByText("Administrar fuentes personalizadas", { exact: true }).click();
  await page.getByRole("textbox", { name: "Dominios de noticias" }).fill("reuters.com, cnbc.com");
  await page.getByRole("button", { name: "Guardar fuentes" }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get("domains")).toBe("reuters.com,cnbc.com");
  await page.reload();
  await page.getByText("Administrar fuentes personalizadas", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Dominios de noticias" })).toHaveValue("reuters.com,cnbc.com");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
