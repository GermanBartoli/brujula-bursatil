import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreferences } from "../src/preferences.ts";
import { catalog } from "../src/catalog.ts";

test("Conserva tema y filtros de dos acciones sin depender del seguimiento", () => {
  const data = {
    theme: "claro",
    filters: [
      {
        id: "filtro:prueba",
        name: "Mis dos acciones",
        assets: [catalog[0], catalog[1]],
      },
    ],
  };
  assert.deepEqual(parsePreferences(JSON.parse(JSON.stringify(data))), data);
});

test("Descarta preferencias corruptas y filtros sin instrumentos válidos", () => {
  assert.deepEqual(parsePreferences(null), { theme: "oscuro", filters: [] });
  assert.deepEqual(
    parsePreferences({
      theme: "desconocido",
      filters: [
        null,
        { id: "filtro:vacio", name: "Vacío", assets: [] },
        { id: "filtro:invalido", name: "Inválido", assets: [{}] },
      ],
    }),
    { theme: "oscuro", filters: [] },
  );
});
