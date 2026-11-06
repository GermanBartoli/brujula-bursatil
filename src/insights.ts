import type { Market, Position } from "./types";
import { positionValue } from "./portfolio.ts";

export function riskBreakdown(
  positions: Position[],
  market: Market | null,
  currency: string,
  includeCost = false,
) {
  const rows = positions.map((p) => {
    const current = positionValue(p, market, currency);
    const estimated = includeCost && current.value === null && current.cost !== null && current.cost > 0;
    return { ...p, value: estimated ? current.cost : current.value, estimated };
  });
  const valued = rows.filter((p) => p.value !== null);
  const total = valued.reduce((sum, p) => sum + p.value!, 0);
  const groups = ["bajo", "medio", "alto", "sin clasificar"].map((risk) => {
    const value = valued
      .filter((p) => (p.risk || "sin clasificar") === risk)
      .reduce((sum, p) => sum + p.value!, 0);
    return { risk, value, percent: total > 0 ? (value / total) * 100 : 0 };
  });
  return {
    total,
    groups,
    missing: rows.length - valued.length,
    rows: rows.map((p) => ({
      ...p,
      weight: total && p.value !== null ? (p.value / total) * 100 : null,
    })),
  };
}

// Sensibilidades introducidas por el usuario: no son coeficientes estimados del mercado.
export function scenario(
  value: number,
  rateBefore: number,
  rateAfter: number,
  inflationBefore: number,
  inflationAfter: number,
  rateSensitivity: number,
  inflationSensitivity: number,
) {
  const change =
    (rateAfter - rateBefore) * rateSensitivity +
    (inflationAfter - inflationBefore) * inflationSensitivity;
  if (
    ![
      value,
      rateBefore,
      rateAfter,
      inflationBefore,
      inflationAfter,
      rateSensitivity,
      inflationSensitivity,
      change,
    ].every(Number.isFinite) ||
    change < -100
  )
    return null;
  return {
    change,
    impact: (value * change) / 100,
    result: value * (1 + change / 100),
  };
}

export const indicators = [
  [
    "P/E",
    "Precio / beneficio. Un valor negativo no significa barato.",
    "0 < P/E ≤ 20",
    "ratio",
    0,
    20,
  ],
  [
    "P/B",
    "Precio / valor contable; depende del sector.",
    "0 < P/B ≤ 3",
    "ratio",
    0,
    3,
  ],
  [
    "EV/EBITDA",
    "Valor empresa / resultado operativo antes de amortizaciones.",
    "0 < EV/EBITDA ≤ 12",
    "ratio",
    0,
    12,
  ],
  [
    "Crecimiento de ingresos",
    "Variación interanual de ventas.",
    "5–15% orientativo",
    "%",
    5,
    15,
  ],
  [
    "Crecimiento de EPS",
    "Variación interanual del beneficio por acción.",
    "> 0% y consistente",
    "%",
    0,
    Infinity,
  ],
  [
    "Free Cash Flow",
    "Caja disponible: revisar varios ejercicios.",
    "Positivo; tendencia creciente",
    "tendencia",
  ],
  [
    "Margen operativo",
    "Resultado operativo / ventas.",
    "Estable o creciente",
    "tendencia",
  ],
  [
    "Efficiency ratio (bancos)",
    "Gastos operativos / ingresos; menor suele ser mejor.",
    "< 40% orientativo",
    "%",
    0,
    40,
  ],
  [
    "Margen bruto",
    "Beneficio bruto / ventas; no aplica a bancos.",
    "Estable o creciente",
    "tendencia",
  ],
  [
    "ROE",
    "Beneficio / patrimonio; revisar apalancamiento.",
    "≥ 12%",
    "%",
    12,
    Infinity,
  ],
  [
    "ROIC",
    "Retorno sobre capital invertido; comparar con costo de capital.",
    "≥ 10%; referencia ideal 15%",
    "%",
    10,
    Infinity,
  ],
  [
    "Deuda neta / EBITDA",
    "Apalancamiento; no aplica a bancos. Deuda neta negativa puede indicar caja neta.",
    "≤ 3 con EBITDA positivo",
    "ratio",
    -Infinity,
    3,
  ],
  [
    "Cobertura de intereses",
    "EBIT / intereses; no confundir con NIM.",
    "≥ 4",
    "ratio",
    4,
    Infinity,
  ],
  [
    "NIM (bancos)",
    "Margen de interés neto; comparar con bancos equivalentes.",
    "Según mercado y entidad; sin umbral universal",
    "contexto",
  ],
  [
    "Current ratio",
    "Activo corriente / pasivo corriente.",
    "≥ 1,5",
    "ratio",
    1.5,
    Infinity,
  ],
  ["Book Value per Share", "Patrimonio por acción.", "Creciente", "tendencia"],
  [
    "Dilución / recompras",
    "Evolución de las acciones en circulación.",
    "Estables o decrecientes",
    "tendencia",
  ],
  [
    "Precio / SMA200",
    "Precio por encima de la media de 200 sesiones.",
    "> 1",
    "ratio",
    1,
    Infinity,
  ],
  [
    "SMA50 / SMA200",
    "Media de 50 sesiones por encima de la de 200.",
    "> 1",
    "ratio",
    1,
    Infinity,
  ],
  [
    "RSI",
    "Oscilador técnico; sobreventa no garantiza un rebote.",
    "30–40 como referencia de tu tabla",
    "índice",
    30,
    40,
  ],
  [
    "Volumen",
    "Confirmación de participación en las subidas.",
    "Creciente en subidas",
    "tendencia",
  ],
] as const;

export function indicatorStatus(index: number, raw: string) {
  if (!raw.trim()) return "Sin dato";
  const row = indicators[index];
  if (row.length < 6) return "Revisar tendencia / contexto";
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) return "Dato inválido";
  const min = row[4]!,
    max = row[5]!;
  const strictMin = [0, 1, 2, 4, 17, 18].includes(index);
  return (strictMin ? value > min : value >= min) &&
    (index === 7 ? value < max : value <= max)
    ? "En referencia"
    : "Fuera de referencia";
}
