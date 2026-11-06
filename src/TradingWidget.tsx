import { useEffect, useRef, useState } from "react";
export default function TradingWidget({
  symbol,
  theme = "dark",
  kind = "chart",
}: {
  symbol: string;
  theme?: "dark" | "light";
  kind?: "chart" | "profile" | "calendar" | "financials" | "technical";
}) {
  const aliases: Record<string, string> = { "MEUD.PA": "EURONEXT:MEUD", "OTROS:MEUD.PA": "EURONEXT:MEUD", "EURONEXT:MEUD.PA": "EURONEXT:MEUD", "IB01.L": "LSE:IB01", "OTROS:IB01.L": "LSE:IB01" };
  symbol = aliases[symbol] || symbol;
  const ref = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const sync = () => setExpanded(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  async function toggleFullscreen() {
    if (expanded) {
      if (document.fullscreenElement === shell.current) await document.exitFullscreen();
      setExpanded(false);
    } else {
      setExpanded(true);
      try { await shell.current?.requestFullscreen(); }
      catch { /* Vista ampliada si el navegador no permite pantalla completa nativa. */ }
    }
  }
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.replaceChildren();
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.appendChild(widget);
    const script = document.createElement("script");
    const file =
      kind === "chart"
        ? "advanced-chart"
        : kind === "calendar"
          ? "events"
          : kind === "financials"
            ? "financials"
            : kind === "technical"
              ? "technical-analysis"
              : "symbol-profile";
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${file}.js`;
    script.async = true;
    const options =
      kind === "chart"
        ? {
            autosize: true,
            symbol,
            interval: "D",
            timezone: "America/Argentina/Buenos_Aires",
            theme,
            style: "1",
            locale: "es",
            allow_symbol_change: true,
            calendar: true,
            hide_side_toolbar: false,
            support_host: "https://www.tradingview.com",
          }
        : kind === "calendar"
          ? {
              width: "100%",
              height: "600",
              colorTheme: theme,
              isTransparent: false,
              locale: "es",
              importanceFilter: "0,1",
              countryFilter: "us,ar,eu,gb,de,fr,nl,jp,cn,hk,in",
            }
          : {
              width: "100%",
              height:
                kind === "financials" ? 550 : kind === "technical" ? 450 : 330,
              displayMode: "regular",
              interval: "1D",
              colorTheme: theme,
              isTransparent: false,
              symbol,
              locale: "es",
            };
    script.textContent = JSON.stringify(options);
    const timer = window.setTimeout(() => container.appendChild(script), 0);
    return () => {
      window.clearTimeout(timer);
      container.replaceChildren();
    };
  }, [symbol, kind, theme]);
  return (
    <div ref={shell} className={`widget-shell widget-${kind}${expanded ? " widget-expanded" : ""}`}>
      {kind === "chart" && (
        <div className="widget-toolbar">
          <button className="secondary compact" onClick={toggleFullscreen} aria-pressed={expanded}>
            {expanded ? "Salir de pantalla completa" : "Ver en pantalla completa"}
          </button>
        </div>
      )}
      <div className="tradingview-widget-container" ref={ref} />
      <a
        className="widget-credit"
        href={
          kind === "calendar"
            ? "https://www.tradingview.com/economic-calendar/"
            : `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(":", "-"))}/`
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {kind === "calendar" ? "Calendario" : "Gráficos y datos"} por
        TradingView ↗
      </a>
    </div>
  );
}
