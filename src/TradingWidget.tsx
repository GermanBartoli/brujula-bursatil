import { useEffect, useRef } from "react";
export default function TradingWidget({
  symbol,
  kind = "chart",
}: {
  symbol: string;
  kind?: "chart" | "profile" | "calendar";
}) {
  const ref = useRef<HTMLDivElement>(null);
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
            theme: "dark",
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
              colorTheme: "dark",
              isTransparent: true,
              locale: "es",
              importanceFilter: "0,1",
              countryFilter: "us,ar,eu,jp,cn",
            }
          : {
              width: "100%",
              height: 330,
              colorTheme: "dark",
              isTransparent: true,
              symbol,
              locale: "es",
            };
    script.textContent = JSON.stringify(options);
    container.appendChild(script);
    return () => container.replaceChildren();
  }, [symbol, kind]);
  return (
    <div className={`widget-shell ${kind}`}>
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
