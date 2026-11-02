import { useEffect, useRef, useState } from "react";
import type { Asset, Market, Position } from "./types";
import TradingWidget from "./TradingWidget";
import {
  indicators,
  indicatorStatus,
  riskBreakdown,
  scenario,
} from "./insights";
import { currencies, positionValue } from "./portfolio";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
const link = (url: string, label: string) => (
  <a className="secondary" href={url} target="_blank" rel="noopener noreferrer">
    {label} ↗
  </a>
);

export function Research({
  asset,
  theme,
  onSearch,
}: {
  asset: Asset;
  theme: "light" | "dark";
  onSearch: () => void;
}) {
  const key = `brujula:evaluacion:v1:${asset.id}`;
  const [storageError, setStorageError] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      return Object.fromEntries(
        Object.entries(raw).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
    } catch {
      return {};
    }
  });
  function update(id: string, value: string) {
    const next = { ...values, [id]: value, fecha: new Date().toISOString() };
    setValues(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "No se pudo guardar la evaluación. Exportala antes de salir.",
      );
    }
  }
  function exportSheet() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ instrumento: asset.id, ...values }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluacion-${asset.symbol}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="workspace-stack">
      <section className="panel workspace-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {asset.kind === "etf" ? "ETF" : "INSTRUMENTO"} · {asset.exchange}{" "}
              · {asset.currency}
            </span>
            <h2>
              {asset.name} · {asset.symbol}
            </h2>
          </div>
          <button className="secondary" onClick={onSearch}>
            Buscar otro ticker
          </button>
        </div>
        <p>
          Los datos siguientes se consultan automáticamente para esta
          cotización. Su disponibilidad depende de TradingView; si no tiene
          cobertura, usá el enlace a la fuente. Las cifras del widget no se
          copian automáticamente a tu evaluación.
        </p>
        <div className="button-row">
          {link(
            `https://www.tradingview.com/symbols/${asset.tv.replace(":", "-")}/financials-overview/`,
            "Estados financieros",
          )}
          {link(
            `https://www.google.com/finance/quote/${encodeURIComponent(asset.symbol + ":" + (asset.country === "nl" ? "AMS" : asset.exchange))}`,
            "Google Finance",
          )}
        </div>
      </section>
      <div className="research-grid">
        <section className="panel">
          <h2 className="workspace-title">Datos fundamentales</h2>
          <TradingWidget symbol={asset.tv} theme={theme} kind="financials" />
        </section>
        <section className="panel">
          <h2 className="workspace-title">Señales técnicas</h2>
          <TradingWidget symbol={asset.tv} theme={theme} kind="technical" />
        </section>
      </div>
      <section className="panel workspace-panel">
        <div className="section-head">
          <h2>Mi evaluación del instrumento</h2>
          <button className="secondary" onClick={exportSheet}>
            Exportar evaluación
          </button>
        </div>
        <p>
          Referencias de tu tabla, no reglas de compra. Compará sector, período
          y calidad del negocio.{" "}
          {asset.kind === "etf"
            ? "En ETFs, revisá además índice, TER, réplica, domicilio y distribución: los ratios de una empresa no evalúan por sí solos el fondo."
            : "Los bancos requieren métricas específicas."}
        </p>
        <div className="field-grid">
          <label>
            Fuente y período de los datos
            <input
              value={values.fuente || ""}
              onChange={(e) => update("fuente", e.target.value)}
              placeholder="Ej. balance anual 2025, informe del emisor"
              maxLength={300}
            />
          </label>
          <label>
            Notas del análisis
            <input
              value={values.notas || ""}
              onChange={(e) => update("notas", e.target.value)}
              maxLength={1000}
              placeholder="Ventajas, riesgos y puntos pendientes"
            />
          </label>
        </div>
        {storageError && <p role="alert">{storageError}</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Qué mirar</th>
                <th>Referencia orientativa</th>
                <th>Valor / observación manual</th>
                <th>Evaluación</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((row, i) => (
                <tr key={row[0]}>
                  <td>
                    <strong>{row[0]}</strong>
                    <small>
                      {i < 3
                        ? "Valoración"
                        : i < 17
                          ? "Negocio y solvencia"
                          : "Técnicos"}
                    </small>
                  </td>
                  <td className="indicator-description">{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>
                    <input
                      aria-label={`Valor de ${row[0]}`}
                      value={values[String(i)] || ""}
                      maxLength={150}
                      onChange={(e) => update(String(i), e.target.value)}
                      placeholder={row[3]}
                    />
                  </td>
                  <td>{indicatorStatus(i, values[String(i)] || "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          Guardado local independiente por bolsa y ticker.{" "}
          {values.fecha
            ? `Última edición: ${new Date(values.fecha).toLocaleString("es-AR")}.`
            : "Todavía no hay datos manuales."}{" "}
          La evaluación se exporta por separado del respaldo de cartera. NIM no
          tiene un umbral universal del 10%.
        </p>
      </section>
    </div>
  );
}

export function RiskPanel({
  positions,
  market,
  currency,
}: {
  positions: Position[];
  market: Market | null;
  currency: string;
}) {
  const report = riskBreakdown(positions, market, currency);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signature = JSON.stringify(
    report.rows.map((p) => [p.asset.id, p.risk, p.weight]),
  );
  const currentSignature = useRef(signature);
  currentSignature.current = signature;
  useEffect(() => {
    setAnalysis("");
    setError("");
  }, [signature]);
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portfolio-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: report.rows
            .filter((p) => p.weight !== null)
            .map((p) => ({
              symbol: p.asset.symbol,
              exchange: p.asset.exchange,
              sector: p.asset.sector,
              currency: p.asset.currency,
              risk: p.risk || "sin clasificar",
              weight: Number(p.weight!.toFixed(4)),
            })),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        analysis: string;
      };
      if (!response.ok) throw Error(result.error || "No se pudo analizar.");
      if (currentSignature.current === signature) setAnalysis(result.analysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const max = Math.max(0, ...report.rows.map((p) => p.weight || 0));
  return (
    <div className="workspace-stack">
      <section className="panel workspace-panel">
        <h2>Riesgo según tu clasificación</h2>
        <p>
          Los porcentajes se ponderan por valor actual convertido a {currency},
          no por cantidad de acciones. Editá cada posición para asignar riesgo
          bajo, medio o alto.
        </p>
        <div className="risk-grid">
          {report.groups.map((g) => (
            <div className={`risk-card risk-${g.risk}`} key={g.risk}>
              <span>{g.risk}</span>
              <strong>{g.percent.toFixed(1)}%</strong>
              <progress
                max="100"
                value={g.percent}
                aria-label={`Porcentaje de riesgo ${g.risk}`}
              />
              <small>{money(g.value, currency)}</small>
            </div>
          ))}
        </div>
        <p className="footnote">
          Base valuada: {money(report.total, currency)} · {report.missing}{" "}
          posiciones sin precio o conversión excluidas. Las posiciones sin
          clasificación se muestran por separado. Los porcentajes de riesgo no
          son probabilidades de pérdida.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Instrumento</th>
                <th>Moneda</th>
                <th>Riesgo</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((p) => (
                <tr key={p.asset.id}>
                  <td>{p.asset.id}</td>
                  <td>{p.asset.currency}</td>
                  <td>{p.risk || "sin clasificar"}</td>
                  <td>
                    {p.weight === null
                      ? "Sin valorar"
                      : `${p.weight.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!positions.length && (
          <p>Registrá posiciones en Mi cartera para ver su distribución.</p>
        )}
      </section>
      <section className="panel workspace-panel">
        <span className="eyebrow">CONCENTRACIÓN Y DIVERSIFICACIÓN</span>
        <h2>Perfil del portfolio</h2>
        <p>
          La mayor posición representa {max.toFixed(1)}% del valor cubierto.{" "}
          {max > 30
            ? "Hay concentración en un solo instrumento; revisá también las participaciones internas de tus ETFs."
            : "La cantidad de instrumentos no garantiza diversificación: pueden compartir empresas y sectores."}
        </p>
        <p>
          La IA interpreta tus instrumentos, pesos y etiquetas. No determina tu
          tolerancia personal al riesgo ni conoce tus objetivos o plazo. Se
          envían símbolos, bolsas, sectores, monedas y porcentajes; no
          cantidades ni importes.
        </p>
        <button
          className="primary"
          disabled={busy || !report.total || report.rows.length > 100}
          onClick={analyze}
        >
          {busy ? "Analizando…" : "Analizar perfil con IA"}
        </button>
        {report.rows.length > 100 && (
          <p>El análisis admite hasta 100 posiciones.</p>
        )}
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        {analysis && (
          <div className="analysis portfolio-analysis">{analysis}</div>
        )}
      </section>
    </div>
  );
}

export function MacroPanel({
  positions,
  market,
  currency,
}: {
  positions: Position[];
  market: Market | null;
  currency: string;
}) {
  const [region, setRegion] = useState("USD");
  const [event, setEvent] = useState("");
  const [rateBefore, setRateBefore] = useState(""),
    [rateAfter, setRateAfter] = useState("");
  const [inflationBefore, setInflationBefore] = useState(""),
    [inflationAfter, setInflationAfter] = useState("");
  const [rateSensitivity, setRateSensitivity] = useState(""),
    [inflationSensitivity, setInflationSensitivity] = useState("");
  const [scope, setScope] = useState("moneda");
  const [inflation, setInflation] = useState<{ year: number; value: number }[]>(
    [],
  );
  const [inflationStatus, setInflationStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setInflation([]);
    setInflationStatus("Consultando serie anual…");
    fetch("/api/inflation?currency=" + region, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          data?: { year: number; value: number }[];
          error?: string;
        };
        if (!response.ok) throw Error(result.error || "Serie no disponible.");
        if (!controller.signal.aborted) {
          setInflation(result.data || []);
          setInflationStatus(
            result.data?.length
              ? ""
              : "No hay observaciones disponibles para esta región.",
          );
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setInflationStatus(e.message);
      });
    return () => controller.abort();
  }, [region]);
  const exposed = positions.filter(
    (p) => scope === "todas" || p.asset.currency === region,
  );
  const values = exposed.map((p) => ({
    p,
    value: positionValue(p, market, currency).value,
  }));
  const base = values.reduce((sum, p) => sum + (p.value || 0), 0);
  const valid = [
    rateBefore,
    rateAfter,
    inflationBefore,
    inflationAfter,
    rateSensitivity,
    inflationSensitivity,
  ].every((v) => v.trim() && Number.isFinite(Number(v)));
  const result = valid
    ? scenario(
        base,
        +rateBefore,
        +rateAfter,
        +inflationBefore,
        +inflationAfter,
        +rateSensitivity,
        +inflationSensitivity,
      )
    : null;
  return (
    <section className="panel workspace-panel">
      <span className="eyebrow">CALENDARIO + TU CARTERA</span>
      <h2>Inflación, tasas y escenarios</h2>
      <p>
        Elegí una reunión o publicación del calendario y copiá sus datos para
        compararlos. El calendario es externo: este simulador no extrae eventos
        ni resultados del widget.
      </p>
      <div className="field-grid">
        <label>
          Evento o reunión
          <input
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            placeholder="Ej. decisión BCE o publicación IPC"
          />
        </label>
        <label>
          Área monetaria
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Posiciones a considerar
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="moneda">Cotizadas en esa moneda</option>
            <option value="todas">Toda mi cartera</option>
          </select>
        </label>
      </div>
      <div className="inflation-history">
        <h3>Inflación anual observada · {region}</h3>
        <p className="footnote">
          Banco Mundial / FMI · precios al consumidor, variación anual.
          Publicación con rezago; no es el último IPC mensual ni una previsión.
          En EUR se consulta la zona euro.
        </p>
        {inflationStatus && <p role="status">{inflationStatus}</p>}
        {!!inflation.length && (
          <div className="inflation-bars">
            {[...inflation].reverse().map((row) => (
              <div key={row.year}>
                <span>{row.year}</span>
                <div className="inflation-track">
                  <span
                    style={{
                      width: `${Math.max(1, (Math.abs(row.value) / Math.max(1, ...inflation.map((r) => Math.abs(r.value)))) * 100)}%`,
                      background: row.value < 0 ? "#81a8dc" : undefined,
                    }}
                  />
                </div>
                <strong>{row.value.toFixed(2)}%</strong>
              </div>
            ))}
          </div>
        )}
        {inflation.length >= 2 && (
          <p>
            Entre {inflation[1].year} y {inflation[0].year}:{" "}
            {(inflation[0].value - inflation[1].value).toFixed(2)} puntos
            porcentuales.{" "}
            <button
              className="text-btn"
              onClick={() => {
                setInflationBefore(inflation[1].value.toFixed(2));
                setInflationAfter(inflation[0].value.toFixed(2));
              }}
            >
              Usar estos dos años en el escenario
            </button>
          </p>
        )}
        {link(
          "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
          "Fuente y metodología de inflación",
        )}
      </div>
      <p>
        Relación inicial por moneda:{" "}
        {exposed.map((p) => p.asset.id).join(", ") ||
          "Sin posiciones coincidentes"}
        . La moneda de cotización no representa toda la exposición económica:
        una empresa o ETF puede operar en muchos países.
      </p>
      <div className="field-grid">
        {[
          ["Tasa anterior (%)", rateBefore, setRateBefore],
          ["Tasa nueva / escenario (%)", rateAfter, setRateAfter],
          ["Inflación anterior (%)", inflationBefore, setInflationBefore],
          [
            "Inflación nueva / escenario (%)",
            inflationAfter,
            setInflationAfter,
          ],
          [
            "Sensibilidad a tasas (% precio por +1 punto porcentual)",
            rateSensitivity,
            setRateSensitivity,
          ],
          [
            "Sensibilidad a inflación (% precio por +1 punto porcentual)",
            inflationSensitivity,
            setInflationSensitivity,
          ],
        ].map(([label, value, setter]) => (
          <label key={label as string}>
            {label as string}
            <input
              type="number"
              step="any"
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              placeholder="Ingresá tu supuesto"
            />
          </label>
        ))}
      </div>
      <p className="footnote">
        Compará inflación del mismo país, periodicidad e índice. Sensibilidad
        negativa significa que una suba del indicador reduce el precio supuesto;
        positiva, que lo aumenta. No hay coeficientes predeterminados ni
        estimados por IA.
      </p>
      {rateBefore !== "" && rateAfter !== "" && (
        <p>
          Variación de tasa: {(+rateAfter - +rateBefore).toFixed(2)} puntos
          porcentuales ({((+rateAfter - +rateBefore) * 100).toFixed(0)} puntos
          básicos).
        </p>
      )}
      {inflationBefore !== "" && inflationAfter !== "" && (
        <p>
          Variación de inflación:{" "}
          {(+inflationAfter - +inflationBefore).toFixed(2)} puntos porcentuales.{" "}
          {+inflationAfter < +inflationBefore
            ? "Una inflación menor puede aliviar costos, pero también reflejar menor demanda."
            : "Una inflación mayor puede presionar costos, tasas y márgenes."}
        </p>
      )}
      <details>
        <summary>Cómo podría afectar a mis acciones</summary>
        <p>
          Una suba de tasas puede encarecer la financiación y reducir
          valoraciones; una baja puede aliviar estos efectos, aunque una
          recesión puede contrarrestarlos. En bancos, el margen depende de la
          velocidad de ajuste de préstamos y depósitos. En consumo importan
          salarios y demanda; en empresas endeudadas, el costo y vencimiento de
          la deuda.
        </p>
        <ul>
          {exposed.map((p) => (
            <li key={p.asset.id}>
              {p.asset.id} · {p.asset.sector}:{" "}
              {p.asset.kind === "etf"
                ? "revisar composición, países y duración si tiene bonos."
                : p.asset.sector === "Finanzas"
                  ? "revisar margen de intereses, morosidad y financiación."
                  : "revisar deuda, poder de fijación de precios, ventas y exposición cambiaria."}
            </li>
          ))}
        </ul>
        {link(
          "https://www.federalreserve.gov/monetarypolicy/monetary-policy-what-are-its-goals-how-does-it-work.htm",
          "Mecanismos de transmisión · Fed",
        )}
      </details>
      {result ? (
        <div className="analysis">
          <h3>{event || "Escenario hipotético"}</h3>
          <p>
            Base cubierta: {money(base, currency)} · cambio supuesto:{" "}
            {result.change.toFixed(2)}%
          </p>
          <p>
            Impacto: {money(result.impact, currency)} · valor final hipotético:{" "}
            {money(result.result, currency)}
          </p>
          <p>
            Δprecio % = Δtasa × sensibilidad a tasas + Δinflación × sensibilidad
            a inflación.
          </p>
        </div>
      ) : (
        <p className="muted">
          Completá los seis supuestos para calcular. No se admiten escenarios de
          pérdida superior al 100%.
        </p>
      )}
      <p className="footnote">
        {values.filter((p) => p.value === null).length} posiciones excluidas por
        falta de precio/cambio. Cálculo lineal con divisas constantes, sin
        comisiones ni dividendos. Es una simulación bajo tus supuestos, no una
        predicción.
      </p>
    </section>
  );
}

export function Resources({ market }: { market: Market | null }) {
  return (
    <div className="workspace-stack">
      <section className="panel workspace-panel">
        <h2>Divisas de referencia</h2>
        <p>
          Unidades de cada moneda por 1 USD. Las conversiones cruzadas pasan por
          USD; ARS utiliza CCL, no dólar oficial.
        </p>
        <div className="risk-grid">
          {currencies.map((c) => (
            <div className="risk-card" key={c}>
              <span>{c}</span>
              <strong>
                {(c === "USD"
                  ? 1
                  : c === "ARS"
                    ? market?.ccl
                    : market?.fx?.[c]
                )?.toLocaleString("es-AR", { maximumFractionDigits: 4 }) ||
                  "Sin dato"}
              </strong>
            </div>
          ))}
        </div>
        <p className="footnote">
          Divisas: Frankfurter · fecha de referencia{" "}
          {market?.fxDate || "no disponible"}. CCL: DolarAPI · consulta{" "}
          {market?.fetchedAt
            ? new Date(market.fetchedAt).toLocaleString("es-AR")
            : "pendiente"}
          . Referencias indicativas, no precio de ejecución.
        </p>
      </section>
      <div className="research-grid">
        {[
          [
            "Gráficos y mercados",
            [
              ["https://www.tradingview.com/", "TradingView"],
              ["https://www.google.com/finance/", "Google Finance"],
              ["https://www.euronext.com/", "Euronext · Ámsterdam"],
              ["https://www.boerse-frankfurt.de/en", "Bolsa de Frankfurt"],
            ],
          ],
          [
            "Dólar y monedas",
            [
              ["https://dolarhoy.com/", "Dólar Hoy"],
              ["https://dolarapi.com/", "DolarAPI"],
              ["https://frankfurter.dev/", "Frankfurter · fuente de cambios"],
            ],
          ],
          [
            "ETFs y fundamentos",
            [
              ["https://www.justetf.com/", "justETF"],
              ["https://www.morningstar.com/", "Morningstar"],
              ["https://www.sec.gov/edgar/search/", "Balances · SEC EDGAR"],
            ],
          ],
          [
            "Economía y calendario",
            [
              [
                "https://www.tradingview.com/economic-calendar/",
                "Calendario económico",
              ],
              ["https://www.ecb.europa.eu/", "Banco Central Europeo"],
              ["https://www.federalreserve.gov/", "Reserva Federal"],
              ["https://www.indec.gob.ar/", "INDEC · inflación argentina"],
            ],
          ],
        ].map(([title, links]) => (
          <section className="panel workspace-panel" key={title as string}>
            <h2>{title as string}</h2>
            <div className="resource-links">
              {(links as string[][]).map(([url, name]) => (
                <span key={url}>{link(url, name)}</span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
