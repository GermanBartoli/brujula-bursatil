import { Research, RiskPanel, MacroPanel, Resources } from "./Workspace";
import { currencies, positionValue } from "./portfolio";
import {
  countries,
  matchesCountry,
  matchesSearch,
  newsSymbol,
} from "./catalog";
import {
  loadPreferences,
  preferencesKey,
  type Theme,
  type NewsFilter,
} from "./preferences";
import { argentinaSeeds } from "./argentina";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import TradingWidget from "./TradingWidget";
import { catalog, cedearSeeds } from "./catalog";
import {
  convert,
  emptyData,
  parseBackup,
  quoteFor,
  storageKey,
  totals,
} from "./portfolio";
import type {
  Analysis,
  Article,
  Asset,
  LocalData,
  Market,
  News,
  Position,
} from "./types";

type Page =
  | "inicio"
  | "mercados"
  | "noticias"
  | "cartera"
  | "calendario"
  | "ajustes"
  | "analisis"
  | "riesgo"
  | "recursos";
const navigation = [
  { id: "inicio", label: "Mi panorama", icon: LayoutDashboard },
  { id: "mercados", label: "Explorar mercados", icon: Globe2 },
  { id: "noticias", label: "Noticias e IA", icon: BookOpen },
  { id: "cartera", label: "Mi cartera", icon: Wallet },
  { id: "analisis", label: "Análisis financiero", icon: ChartNoAxesCombined },
  { id: "riesgo", label: "Riesgo y perfil", icon: ShieldCheck },
  { id: "recursos", label: "Herramientas y divisas", icon: ExternalLink },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
] as const;
const format = (n: number | null | undefined, currency = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n);
const pct = (n: number | null | undefined) =>
  n == null ? "Sin variación" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const countryName = (c: string) =>
  (
    ({
      us: "Estados Unidos",
      ar: "Argentina",
      nl: "Países Bajos",
      de: "Alemania",
      jp: "Japón",
      hk: "Hong Kong",
      gb: "Reino Unido",
      ch: "Suiza",
      ca: "Canadá",
      fr: "Francia",
      br: "Brasil",
      cn: "China",
      in: "India",
      au: "Australia",
      es: "España",
      it: "Italia",
    }) as Record<string, string>
  )[c] || c.toUpperCase();
const time = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? "Fecha no disponible"
    : d.toLocaleString("es-AR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const newsRequests = new Map<string, Promise<unknown>>();
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const cacheable = path.startsWith("news?") && !options;
  const key = "brujula:noticias:v2:" + path;
  if (cacheable) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved && saved.until > Date.now()) return saved.data;
      if (saved) sessionStorage.removeItem(key);
    } catch {
      /* La consulta funciona también sin almacenamiento local. */
    }
    const pending = newsRequests.get(key);
    if (pending) return pending as Promise<T>;
  }
  const task = (async () => {
    const r = await fetch("/api/" + path, options);
    const data = (await r.json()) as T & {
      error?: string;
      warnings?: string[];
    };
    if (!r.ok)
      throw Error(data.error || "No pudimos conectar con el servicio.");
    if (cacheable && !data.warnings?.length) {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ until: Date.now() + 1800000, data }),
        );
      } catch {
        /* Una cuota local agotada no impide mostrar noticias. */
      }
    }
    return data;
  })();
  if (cacheable) newsRequests.set(key, task);
  try {
    return await task;
  } finally {
    if (cacheable) newsRequests.delete(key);
  }
}

function load() {
  try {
    const saved = localStorage.getItem(storageKey);
    return {
      data: saved ? parseBackup(JSON.parse(saved)) : emptyData(),
      error: "",
    };
  } catch {
    return {
      data: emptyData(),
      error:
        "No se pudo leer tu guardado local. Conservamos el archivo original; exportá o importá un respaldo antes de guardar cambios.",
    };
  }
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const startedOutside = useRef(false);
  function outside(x: number, y: number) {
    const box = ref.current?.getBoundingClientRect();
    return (
      !!box && (x < box.left || x > box.right || y < box.top || y > box.bottom)
    );
  }
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onPointerDown={(e) => {
        startedOutside.current = outside(e.clientX, e.clientY);
      }}
      onPointerCancel={() => {
        startedOutside.current = false;
      }}
      onClick={(e) => {
        if (
          startedOutside.current &&
          e.target === ref.current &&
          outside(e.clientX, e.clientY)
        )
          onClose();
        startedOutside.current = false;
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Badge({ asset }: { asset: Asset }) {
  return (
    <span
      className="company-mark"
      style={{
        color: asset.color || "#a6bbd3",
        background: `${asset.color || "#a6bbd3"}15`,
      }}
    >
      {asset.symbol.slice(0, 2)}
    </span>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Compass size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function NewsCard({
  article,
  symbol,
  onNotice,
  onMore,
}: {
  article: Article;
  symbol: string;
  onNotice: (s: string) => void;
  onMore: () => void;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null),
    [busy, setBusy] = useState(false);
  const sentiment = article.entities.find(
    (e) => e.symbol === symbol,
  )?.sentiment_score;
  async function analyze() {
    setBusy(true);
    try {
      setAnalysis(
        await api<Analysis>("analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid: article.uuid, symbol }),
        }),
      );
    } catch (e) {
      onNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="news-card">
      <div className="news-meta">
        <span className="source-dot" />
        {article.source}
        <span className="news-date">{time(article.published_at)}</span>
      </div>
      <h3>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
          <ArrowUpRight size={16} />
        </a>
      </h3>
      <p>
        {article.description ||
          "Leé la noticia completa en su fuente original."}
      </p>
      <div className="news-bottom">
        <span
          className={`sentiment ${sentiment === undefined ? "muted" : sentiment > 0 ? "positive" : sentiment < 0 ? "negative" : "muted"}`}
        >
          {sentiment === undefined
            ? "Sin clasificación"
            : sentiment > 0
              ? "Tono positivo"
              : sentiment < 0
                ? "Tono negativo"
                : "Tono neutral"}
        </span>
        <button className="ai-btn" onClick={analyze} disabled={busy || !symbol}>
          {busy ? (
            <LoaderCircle className="spin" size={14} />
          ) : (
            <Sparkles size={14} />
          )}{" "}
          {analysis ? "Volver a analizar" : "Analizar con IA"}
        </button>
      </div>
      <button className="text-btn" disabled={!symbol} onClick={onMore}>
        Más noticias de {symbol.replace(/\.BA$/, "")} <ArrowUpRight size={16} />
      </button>
      {analysis && (
        <div className="analysis">
          <span className="eyebrow">
            LECTURA CON IA · {analysis.relevancia}
          </span>
          <p>{analysis.resumen}</p>
          <strong>Posible impacto · {analysis.sentimiento}</strong>
          <p>{analysis.impacto}</p>
          <p className="muted">{analysis.justificacion}</p>
          <small>
            Análisis del título y extracto. No es una predicción ni una
            recomendación de inversión.
          </small>
        </div>
      )}
    </article>
  );
}
export default function App() {
  const initial = useMemo(load, []);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [filterEditor, setFilterEditor] = useState<NewsFilter | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    } catch {
      /* Las preferencias siguen disponibles durante esta sesión. */
    }
  }, [preferences]);
  const [data, setData] = useState<LocalData>(initial.data),
    [storageError, setStorageError] = useState(initial.error);
  const previousVisit = useRef(initial.data.lastVisit);
  const [page, setPage] = useState<Page>("inicio"),
    [mobile, setMobile] = useState(false),
    [notice, setNotice] = useState("");
  const [market, setMarket] = useState<Market | null>(null),
    [marketError, setMarketError] = useState("");
  const [assets, setAssets] = useState<Asset[]>([
    ...catalog,
    ...argentinaSeeds,
    ...cedearSeeds,
  ]);
  const [selected, setSelected] = useState<Asset>(
    initial.data.watchlist[0] || catalog[0],
  );
  const [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(""),
    [remote, setRemote] = useState<Asset[]>([]),
    [searchBusy, setSearchBusy] = useState(false),
    [searchError, setSearchError] = useState(""),
    [searchPage, setSearchPage] = useState(1),
    [hasMore, setHasMore] = useState(false);
  const [exchange, setExchange] = useState("todos");
  const [riskFilter, setRiskFilter] = useState("todos");
  const [kind, setKind] = useState("todos"),
    [country, setCountry] = useState("todos"),
    [sector, setSector] = useState("todos"),
    [list, setList] = useState("Todas");
  const [news, setNews] = useState<News | null>(null),
    [newsBusy, setNewsBusy] = useState(false),
    [newsError, setNewsError] = useState(""),
    [newsLanguage, setNewsLanguage] = useState("en"),
    [newsCountry, setNewsCountry] = useState(""),
    [newsMode, setNewsMode] = useState("direct"),
    [newsScope, setNewsScope] = useState("lista"),
    [newsPage, setNewsPage] = useState(1),
    [newsBatch, setNewsBatch] = useState(0),
    [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Asset | null>(null),
    [confirmImport, setConfirmImport] = useState<LocalData | null>(null),
    [newList, setNewList] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (storageError) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...data, lastVisit: new Date().toISOString() }),
      );
    } catch {
      setStorageError(
        "No se pudo guardar en este navegador. Exportá una copia para conservar tus datos.",
      );
    }
  }, [data, storageError]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    let canceled = false;
    Promise.allSettled([
      api<Market>("market"),
      api<{ data: Asset[] }>("catalog"),
    ]).then(([m, a]) => {
      if (canceled) return;
      if (m.status === "fulfilled") {
        setMarket((previous) => ({ ...m.value, global: previous?.global }));
        setMarketError("");
      } else setMarketError(m.reason.message);
      if (a.status === "fulfilled") setAssets(a.value.data);
    });
    return () => {
      canceled = true;
    };
  }, [reload]);
  useEffect(() => {
    let canceled = false;
    setRemote([]);
    setSearchError("");
    setHasMore(false);
    if (query.trim().length < 2) {
      setSearchBusy(false);
      return;
    }
    setSearchBusy(true);
    const timer = setTimeout(() => {
      api<{ data: Asset[]; hasMore: boolean }>(
        `search?q=${encodeURIComponent(query.trim())}&page=${searchPage}${country === "todos" || country === "asia" ? "" : "&country=" + country}`,
      )
        .then((r) => {
          if (!canceled) {
            setRemote(r.data);
            setHasMore(r.hasMore);
          }
        })
        .catch((e) => {
          if (!canceled) setSearchError(e.message);
        })
        .finally(() => {
          if (!canceled) setSearchBusy(false);
        });
    }, 650);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [query, searchPage, country]);
  const followed = [
    ...new Map(
      [...data.watchlist, ...data.positions.map((p) => p.asset), selected].map(
        (a) => [a.id, a],
      ),
    ).values(),
  ];
  const customFilter = preferences.filters.find((f) => f.id === newsScope);
  const newsAsset = followed.find((a) => a.id === newsScope) || selected;
  const allSymbols = useMemo(
    () =>
      [
        ...new Set(
          (newsScope === "mercado"
            ? []
            : customFilter
              ? customFilter.assets
              : newsScope !== "lista"
                ? [newsAsset]
                : [...data.watchlist, ...data.positions.map((p) => p.asset)]
          )
            .map(newsSymbol)
            .filter(Boolean),
        ),
      ]
        .sort()
        .join(","),
    [data.watchlist, data.positions, newsAsset, newsScope, customFilter],
  );
  const symbols = allSymbols
    .split(",")
    .filter(Boolean)
    .slice(newsBatch * 15, (newsBatch + 1) * 15)
    .join(",");
  const newsSector = newsMode === "sector" ? newsAsset.sector : "";
  const previousNewsFilter = useRef("");
  useEffect(() => {
    const filter = JSON.stringify([
      allSymbols,
      newsMode,
      newsSector,
      newsLanguage,
      newsCountry,
    ]);
    if (previousNewsFilter.current !== filter) {
      previousNewsFilter.current = filter;
      if (newsPage !== 1 || newsBatch !== 0) {
        setNewsPage(1);
        setNewsBatch(0);
        return;
      }
    }
    let canceled = false;
    setNewsBusy(true);
    setNewsError("");
    Promise.all(
      Array.from({ length: newsPage }, (_, i) =>
        api<News>(
          `news?symbols=${encodeURIComponent(symbols)}&mode=${newsMode}&sector=${encodeURIComponent(newsSector)}&page=${i + 1}&language=${newsLanguage}&country=${newsCountry}`,
        ),
      ),
    )
      .then((r) => {
        if (!canceled)
          setNews({
            ...r[r.length - 1],
            data: [
              ...new Map(
                r.flatMap((n) => n.data).map((a) => [a.url, a]),
              ).values(),
            ],
            warnings: [...new Set(r.flatMap((n) => n.warnings || []))],
          });
      })
      .catch((e) => {
        if (!canceled) {
          setNews(null);
          setNewsError(e.message);
        }
      })
      .finally(() => {
        if (!canceled) setNewsBusy(false);
      });
    return () => {
      canceled = true;
    };
  }, [
    allSymbols,
    symbols,
    newsBatch,
    newsMode,
    newsSector,
    newsPage,
    newsLanguage,
    newsCountry,
    reload,
  ]);
  const quoteIds = [
    ...new Set(
      [selected, ...data.positions.map((p) => p.asset)]
        .filter((a) => a.country !== "ar")
        .map((a) => a.id),
    ),
  ]
    .sort()
    .join(",");
  const [quoteWarnings, setQuoteWarnings] = useState<string[]>([]);
  useEffect(() => {
    let canceled = false;
    if (!market?.fetchedAt) return;
    setQuoteWarnings([]);
    const ids = quoteIds.split(",").filter(Boolean);
    (async () => {
      for (let i = 0; i < ids.length; i += 20) {
        try {
          const result = await api<{
            data: {
              id: string;
              quote: NonNullable<Market["global"]>[string];
            }[];
            warnings?: string[];
          }>(
            "quotes?ids=" + encodeURIComponent(ids.slice(i, i + 20).join(",")),
          );
          if (canceled) return;
          setMarket((m) =>
            m
              ? {
                  ...m,
                  global: {
                    ...m.global,
                    ...Object.fromEntries(
                      result.data.map((r) => [r.id, r.quote]),
                    ),
                  },
                }
              : m,
          );
          setQuoteWarnings((w) => [...w, ...(result.warnings || [])]);
        } catch {
          if (!canceled)
            setQuoteWarnings((w) => [
              ...w,
              "No se pudo actualizar una tanda de precios internacionales. Reintentá desde Noticias → Actualizar.",
            ]);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [quoteIds, reload, market?.fetchedAt]);
  const balance = totals(data.positions, market, data.currency),
    selectedQuote = quoteFor(selected, market);
  const visibleWatchlist = data.watchlist.filter(
    (a) => list === "Todas" || (data.assignments[a.id] || "Principal") === list,
  );
  const shownAssets = useMemo(
    () =>
      [
        ...new Map([...assets, ...remote].map((a) => [a.id, a])).values(),
      ].filter(
        (a) =>
          matchesSearch(a, query) &&
          (kind === "todos" || a.kind === kind) &&
          matchesCountry(a.country, country) &&
          (exchange === "todos" || a.exchange === exchange) &&
          (sector === "todos" || a.sector === sector),
      ),
    [assets, remote, query, kind, country, sector, exchange],
  );
  const newArticles =
    news?.data.filter(
      (a) => Date.parse(a.published_at) > Date.parse(previousVisit.current),
    ).length || 0;
  function go(p: Page) {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleWatch(a: Asset) {
    setData((d) => ({
      ...d,
      watchlist: d.watchlist.some((x) => x.id === a.id)
        ? d.watchlist.filter((x) => x.id !== a.id)
        : [...d.watchlist, a],
    }));
  }
  function choose(a: Asset) {
    setSelected(a);
    setSearchOpen(false);
    go(page === "analisis" ? "analisis" : "inicio");
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brujula-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2000000)
        throw Error("El respaldo supera el tamaño máximo de 2 MB.");
      setConfirmImport(parseBackup(JSON.parse(await file.text())));
    } catch (e) {
      setNotice((e as Error).message);
    }
    if (uploadRef.current) uploadRef.current.value = "";
  }
  function assetForNews(article: Article): Asset | null {
    if (!customFilter && newsScope !== "lista" && newsScope !== "mercado")
      return newsAsset;
    const known = [
      ...(customFilter?.assets || []),
      ...followed,
      ...assets,
    ].find((asset) =>
      article.entities.some((e) => e.symbol === newsSymbol(asset)),
    );
    if (known) return known;
    const symbol = article.entities[0]?.symbol;
    return symbol
      ? {
          id: `NOTICIAS:${symbol}`,
          symbol,
          name: symbol,
          exchange: "OTROS",
          country: "",
          currency: "XXX",
          kind: "accion",
          sector: "Otros",
          underlying: symbol,
          tv: symbol,
        }
      : null;
  }
  const newsSection = (
    <section className="panel news-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">EL CONTEXTO IMPORTA</span>
          <h2>
            Detrás del movimiento{" "}
            <span className="count">{news?.data.length || 0}</span>
          </h2>
        </div>
        <button className="text-btn" onClick={() => go("noticias")}>
          Todas las noticias <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="news-controls">
        <button
          className="secondary compact"
          onClick={() =>
            setFilterEditor({
              id: `filtro:${crypto.randomUUID()}`,
              name: "",
              assets: [],
            })
          }
        >
          Crear filtro
        </button>
        {customFilter && (
          <button
            className="secondary compact"
            onClick={() => setFilterEditor(customFilter)}
          >
            Editar filtro
          </button>
        )}
        <select
          aria-label="Noticias de"
          value={newsScope}
          onChange={(e) => setNewsScope(e.target.value)}
        >
          <option value="lista">Mi seguimiento</option>
          <option value="mercado">Todo el mercado</option>
          {preferences.filters.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} · filtro
            </option>
          ))}
          {followed.map((a) => (
            <option key={a.id} value={a.id}>
              {a.symbol} · {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo de noticias"
          value={newsMode}
          onChange={(e) => setNewsMode(e.target.value)}
        >
          <option value="direct">Menciones directas</option>
          <option value="sector">Contexto del sector</option>
        </select>
        <select
          aria-label="Idioma de las noticias"
          value={newsLanguage}
          onChange={(e) => setNewsLanguage(e.target.value)}
        >
          <option value="en">Inglés</option>
          <option value="es">Español</option>
          <option value="en,es">Ambos idiomas</option>
        </select>
        <select
          aria-label="Mercado de las noticias"
          value={newsCountry}
          onChange={(e) => setNewsCountry(e.target.value)}
        >
          <option value="">Todo el mundo</option>
          <option value="ar">Argentina</option>
          <option value="us">EE. UU.</option>
          <option value="asia">Asia (China, Hong Kong, Japón, India)</option>
          {countries
            .filter((c) => !["ar", "us"].includes(c))
            .map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
        </select>
        <span className="muted">
          Marketaux · hasta 3 noticias por empresa y página · caché de 30 min
        </span>
      </div>
      {newsBusy ? (
        <div className="loading">
          <LoaderCircle className="spin" />
          Buscando lo que importa…
        </div>
      ) : newsError ? (
        <Empty
          title="Las noticias están en pausa"
          text={newsError}
          action={
            <button
              className="secondary"
              onClick={() => setReload((n) => n + 1)}
            >
              Reintentar
            </button>
          }
        />
      ) : news?.data.length ? (
        <div className="news-grid">
          {news.data.map((a) => (
            <NewsCard
              key={a.uuid}
              article={a}
              symbol={assetForNews(a) ? newsSymbol(assetForNews(a)!) : ""}
              onNotice={setNotice}
              onMore={() => {
                const asset = assetForNews(a);
                if (!asset) return;
                setSelected(asset);
                setNewsScope(asset.id);
                setNewsPage(1);
                go("noticias");
              }}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="Sin noticias para este filtro"
          text="Probá con otra acción o mirá el contexto de su sector."
        />
      )}
      {news?.warnings?.map((w) => (
        <p className="inline-error" key={w}>
          {w}
        </p>
      ))}
      <div className="button-row">
        {news?.hasMore && (
          <button
            className="secondary"
            disabled={newsBusy}
            onClick={() => setNewsPage((p) => p + 1)}
          >
            Ver más noticias
          </button>
        )}
        {allSymbols.split(",").length > 15 && (
          <>
            <span>
              Instrumentos {newsBatch * 15 + 1}–
              {Math.min((newsBatch + 1) * 15, allSymbols.split(",").length)} de{" "}
              {allSymbols.split(",").length}
            </span>
            {newsBatch > 0 && (
              <button
                className="secondary"
                onClick={() => {
                  setNewsBatch((b) => b - 1);
                  setNewsPage(1);
                }}
              >
                Instrumentos anteriores
              </button>
            )}
            {(newsBatch + 1) * 15 < allSymbols.split(",").length && (
              <button
                className="secondary"
                onClick={() => {
                  setNewsBatch((b) => b + 1);
                  setNewsPage(1);
                }}
              >
                Siguientes instrumentos
              </button>
            )}
          </>
        )}
      </div>
      {newsMode === "sector" && (
        <p className="footnote">
          El contexto del sector puede incluir empresas no presentes en tu
          lista; no implica una relación directa con tu acción.
        </p>
      )}
    </section>
  );
  const assetTable = (rows: Asset[], manage = false) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Empresa / instrumento</th>
            <th>Mercado</th>
            <th>Cotización</th>
            <th>Variación</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const q = quoteFor(a, market),
              watched = data.watchlist.some((x) => x.id === a.id);
            return (
              <tr key={a.id}>
                <td>
                  <button className="asset-cell" onClick={() => choose(a)}>
                    <Badge asset={a} />
                    <span>
                      <strong>
                        {a.symbol}
                        <span className="kind-label">
                          {a.kind === "cedear"
                            ? "CEDEAR"
                            : a.kind === "etf"
                              ? "ETF"
                              : "ACCIÓN"}
                        </span>
                      </strong>
                      <small>{a.name}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <span>{a.exchange}</span>
                  <small>{countryName(a.country)}</small>
                </td>
                <td className="numeric">
                  {q ? format(q.price, a.currency) : "Sin cobertura"}
                  <small>{a.currency}</small>
                </td>
                <td>
                  <span
                    className={`change ${q?.change == null ? "" : q.change >= 0 ? "positive" : "negative"}`}
                  >
                    {pct(q?.change)}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className={`icon-btn ${watched ? "is-starred" : ""}`}
                      aria-label={`${watched ? "Quitar" : "Seguir"} ${a.symbol} ${a.exchange}`}
                      onClick={() => toggleWatch(a)}
                    >
                      <Star
                        size={17}
                        fill={watched ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Registrar compra de ${a.symbol}`}
                      onClick={() => setEditing(a)}
                    >
                      <Plus size={17} />
                    </button>
                    {manage && (
                      <select
                        aria-label={`Lista de ${a.symbol}`}
                        value={data.assignments[a.id] || "Principal"}
                        onChange={(e) =>
                          setData((d) => ({
                            ...d,
                            assignments: {
                              ...d.assignments,
                              [a.id]: e.target.value,
                            },
                          }))
                        }
                      >
                        {data.lists.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("inicio");
          }}
        >
          <span className="brand-icon">
            <Compass size={25} />
          </span>
          <span>
            brújula<span className="brand-sub">BURSÁTIL</span>
          </span>
        </a>
        <div className="workspace-label">
          TU ESPACIO PERSONAL<span>01</span>
        </div>
        <nav aria-label="Navegación principal">
          {[
            { title: "SEGUIMIENTO", ids: ["inicio", "mercados", "noticias"] },
            { title: "MI PORTFOLIO", ids: ["cartera", "analisis", "riesgo"] },
            {
              title: "CONTEXTO Y HERRAMIENTAS",
              ids: ["calendario", "recursos"],
            },
          ].map((group) => (
            <div className="nav-group" key={group.title}>
              <span className="nav-group-title">{group.title}</span>
              {navigation
                .filter((n) => group.ids.includes(n.id))
                .map((n) => (
                  <button
                    key={n.id}
                    className={page === n.id ? "active" : ""}
                    onClick={() => go(n.id)}
                  >
                    <n.icon size={19} />
                    {n.label}
                    {n.id === "noticias" && newArticles > 0 && (
                      <span className="nav-count">{newArticles}</span>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-lists">
          <div className="sidebar-heading">
            MIS LISTAS{" "}
            <button
              className="icon-btn"
              aria-label="Administrar listas"
              onClick={() => go("ajustes")}
            >
              <Plus size={15} />
            </button>
          </div>
          {data.lists.map((l) => (
            <button
              key={l}
              onClick={() => {
                setList(l);
                go("inicio");
              }}
            >
              <span className="list-dot" />
              {l}
              <span>
                {
                  data.watchlist.filter(
                    (a) => (data.assignments[a.id] || "Principal") === l,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={19} />
            <div>
              <strong>Tu cartera es tuya</strong>
              <p>Guardada en este navegador.</p>
            </div>
          </div>
          <button onClick={() => go("ajustes")}>
            <Settings2 size={18} />
            Preferencias y respaldo
          </button>
          <div className="profile">
            <span>GB</span>
            <div>
              <strong>Mi espacio</strong>
              <small>Inversor independiente</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>Mi espacio</span>
            <ChevronRight size={14} />
            <strong>
              {page === "ajustes"
                ? "Preferencias"
                : navigation.find((n) => n.id === page)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <select
              aria-label="Tema de la aplicación"
              value={preferences.theme}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  theme: e.target.value as Theme,
                }))
              }
            >
              <option value="oscuro">Oscuro</option>
              <option value="suave">Oscuro suave</option>
              <option value="claro">Claro</option>
            </select>
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>Buscar una acción…</span>
              <kbd>⌕</kbd>
            </button>
            <button
              className="icon-btn"
              aria-label="Ver novedades"
              onClick={() => go("noticias")}
            >
              <Bell size={18} />
              {newArticles > 0 && <span className="notification-dot" />}
            </button>
            <span className="avatar">GB</span>
          </div>
        </header>
        <main>
          {storageError && (
            <div className="alert" role="alert">
              {storageError}
              <button onClick={exportData}>Exportar estado actual</button>
            </div>
          )}
          {marketError && (
            <div className="alert">
              {marketError}
              <button onClick={() => setReload((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          )}
          {market?.warnings.map((w) => (
            <div className="alert" key={w}>
              {w}
            </div>
          ))}
          {!!quoteWarnings.length && (
            <details className="alert">
              <summary>
                Algunos precios internacionales no están disponibles
              </summary>
              {quoteWarnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <p>
                Se conserva la última cotización recibida de esta sesión, si
                existe. Podés ingresar un precio manual al editar la posición.
              </p>
            </details>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-compass">✦</span> UNA PERSPECTIVA MÁS
                CLARA
              </div>
              <h1>
                {
                  {
                    inicio: "Tu próximo horizonte.",
                    mercados: "El mundo, en tu radar.",
                    noticias: "Información con contexto.",
                    cartera: "Tus inversiones, a tu manera.",
                    calendario: "Anticipate a lo que viene.",
                    ajustes: "Un espacio bien tuyo.",
                    analisis: "Entendé lo que estás comprando.",
                    riesgo: "El equilibrio de tu cartera.",
                    recursos: "Todas tus herramientas, juntas.",
                  }[page]
                }
              </h1>
              <p>
                {
                  {
                    inicio:
                      "Tus acciones, las noticias que importan y una mirada al mercado.",
                    mercados:
                      "Encontrá acciones internacionales y CEDEARs. Elegí qué seguir.",
                    noticias:
                      "Conectá los titulares con las empresas que te interesan.",
                    cartera:
                      "Registrá tus posiciones y seguí su evolución desde un solo lugar.",
                    calendario:
                      "Eventos económicos y acceso a los próximos balances.",
                    analisis:
                      "Fundamentos, señales técnicas y tu lista de evaluación.",
                    riesgo:
                      "Distribución por valor, concentración y una lectura con IA.",
                    recursos:
                      "Accesos por categoría y tipos de cambio de referencia.",
                    ajustes:
                      "Organizá tus listas y llevá tus datos a donde quieras.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              <div
                className="currency-switch"
                aria-label="Moneda de referencia"
              >
                <select
                  aria-label="Moneda final de la cartera"
                  value={data.currency}
                  onChange={(e) =>
                    setData((d) => ({ ...d, currency: e.target.value }))
                  }
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button className="primary" onClick={() => setSearchOpen(true)}>
                <Plus size={17} />
                Agregar acción
              </button>
            </div>
          </div>
          {(page === "inicio" || page === "cartera") && (
            <div className="metrics">
              <div className="metric">
                <div>
                  <span>
                    {balance.missing
                      ? "Valor parcial de mi cartera"
                      : "Valor de mi cartera"}
                  </span>
                  <Wallet size={16} />
                </div>
                <strong>
                  {data.positions.length
                    ? balance.missing === data.positions.length
                      ? "Sin valoración"
                      : format(balance.value, data.currency)
                    : "Tu punto de partida"}
                </strong>
                <small>
                  {data.positions.length
                    ? `${balance.missing ? balance.missing + " posiciones sin valorar · " : ""}${data.currency} · tipos de cambio actuales`
                    : "Registrá tu primera compra para empezar"}
                </small>
              </div>
              <div className="metric">
                <div>
                  <span>Resultado estimado</span>
                  <ChartNoAxesCombined size={16} />
                </div>
                <strong
                  className={balance.profit >= 0 ? "positive" : "negative"}
                >
                  {data.positions.length
                    ? balance.missing === data.positions.length
                      ? "—"
                      : format(balance.profit, data.currency)
                    : "—"}
                  <span>
                    {data.positions.length ? pct(balance.percent) : ""}
                  </span>
                </strong>
                <small>
                  Sin comisiones · costos y valores al cambio actual
                </small>
              </div>
              <div className="metric">
                <div>
                  <span>En mi radar</span>
                  <Star size={16} />
                </div>
                <strong>
                  {data.watchlist.length.toString().padStart(2, "0")}
                  <span className="metric-caption">instrumentos</span>
                </strong>
                <small>
                  {data.watchlist.filter((a) => a.kind === "cedear").length}{" "}
                  CEDEARs ·{" "}
                  {data.watchlist.filter((a) => a.kind === "accion").length}{" "}
                  acciones
                </small>
              </div>
              <div className="metric accent-metric">
                <div>
                  <span>Desde tu última visita</span>
                  <Sparkles size={16} />
                </div>
                <strong>
                  {newArticles.toString().padStart(2, "0")}
                  <span className="metric-caption">noticias nuevas</span>
                </strong>
                <button onClick={() => go("noticias")}>
                  Ponete al día <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          )}
          {page === "inicio" && (
            <>
              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="section-head">
                    <div className="selected-company">
                      <Badge asset={selected} />
                      <div>
                        <h2>{selected.name}</h2>
                        <span>
                          {selected.symbol} <b>·</b> {selected.exchange}{" "}
                          <b>·</b>{" "}
                          {selected.kind === "cedear" ? "CEDEAR" : "Acción"}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`icon-btn ${data.watchlist.some((a) => a.id === selected.id) ? "is-starred" : ""}`}
                      aria-label="Alternar favorito del gráfico"
                      onClick={() => toggleWatch(selected)}
                    >
                      <Star size={19} />
                    </button>
                  </div>
                  <div className="chart-price">
                    <strong>
                      {selectedQuote
                        ? format(selectedQuote.price, selected.currency)
                        : "Gráfico de mercado"}
                    </strong>
                    <span
                      className={
                        selectedQuote?.change != null &&
                        selectedQuote.change < 0
                          ? "negative"
                          : "positive"
                      }
                    >
                      {selectedQuote
                        ? pct(selectedQuote.change)
                        : selected.currency}
                    </span>
                    <small>
                      {selectedQuote
                        ? market?.global?.[selected.id]
                          ? `Yahoo Finance · ${time(market.global[selected.id].asOf)}`
                          : "Referencia Data912 · no es tiempo real"
                        : "La disponibilidad depende del mercado"}
                    </small>
                  </div>
                  <button
                    className="secondary research-link"
                    onClick={() => go("analisis")}
                  >
                    Ver fundamentos y evaluación de {selected.symbol}
                  </button>
                  <TradingWidget
                    theme={preferences.theme === "claro" ? "light" : "dark"}
                    symbol={selected.tv}
                  />
                  {selected.kind === "cedear" && (
                    <div className="underlying">
                      <span>
                        Acción de origen:{" "}
                        <strong>{selected.underlying || "Sin vincular"}</strong>
                      </span>
                      {selected.underlying && (
                        <button
                          onClick={() =>
                            choose(
                              catalog.find(
                                (a) => a.symbol === selected.underlying,
                              ) || {
                                ...selected,
                                id: `OTROS:${selected.underlying}`,
                                symbol: selected.underlying,
                                country: "us",
                                currency: "USD",
                                exchange: "OTROS",
                                kind: "accion",
                                tv: selected.underlying,
                              },
                            )
                          }
                        >
                          Ver subyacente <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </section>
                <aside className="radar-side">
                  <section className="panel radar-panel">
                    <div className="section-head">
                      <h2>Tu radar</h2>
                      <button
                        className="icon-btn"
                        aria-label="Añadir al radar"
                        onClick={() => setSearchOpen(true)}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                    {data.watchlist.length ? (
                      data.watchlist.slice(0, 5).map((a) => {
                        const q = quoteFor(a, market);
                        return (
                          <button
                            className={`radar-item ${selected.id === a.id ? "selected" : ""}`}
                            key={a.id}
                            onClick={() => {
                              setSelected(a);
                              setNewsScope(a.id);
                            }}
                          >
                            <Badge asset={a} />
                            <span>
                              <strong>{a.symbol}</strong>
                              <small>
                                {a.kind === "cedear" ? "CEDEAR · ARS" : a.name}
                              </small>
                            </span>
                            <span className="radar-price">
                              <strong>
                                {q ? format(q.price, a.currency) : "—"}
                              </strong>
                              <small
                                className={
                                  q?.change != null && q.change < 0
                                    ? "negative"
                                    : "positive"
                                }
                              >
                                {q ? pct(q.change) : "Ver gráfico"}
                              </small>
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <Empty
                        title="Armá tu radar"
                        text="Marcá una estrella para empezar."
                      />
                    )}
                    <button
                      className="radar-more"
                      onClick={() => go("mercados")}
                    >
                      Explorar más instrumentos <ArrowUpRight size={14} />
                    </button>
                  </section>
                  <section className="insight-card">
                    <div className="insight-icon">
                      <Sparkles size={21} />
                    </div>
                    <span className="eyebrow">MENOS RUIDO, MÁS CONTEXTO</span>
                    <h3>
                      No solo qué pasó.
                      <br />
                      También por qué importa.
                    </h3>
                    <p>
                      Explorá el posible impacto de cada noticia con ayuda de
                      IA.
                    </p>
                    <button onClick={() => go("noticias")}>
                      Descubrir las noticias <ArrowUpRight size={16} />
                    </button>
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                  </section>
                </aside>
              </div>
              <section className="panel watch-panel">
                <div className="section-head">
                  <h2>
                    Mi seguimiento{" "}
                    <span className="count">{visibleWatchlist.length}</span>
                  </h2>
                  <select
                    aria-label="Filtrar lista"
                    value={list}
                    onChange={(e) => setList(e.target.value)}
                  >
                    <option>Todas</option>
                    {data.lists.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
                {visibleWatchlist.length ? (
                  assetTable(visibleWatchlist, true)
                ) : (
                  <Empty
                    title="Esta lista está vacía"
                    text="Agregá tus favoritas desde el buscador."
                  />
                )}
              </section>
              {newsSection}
            </>
          )}
          {page === "mercados" && (
            <section className="panel">
              <div className="market-filters">
                <select
                  aria-label="Bolsa"
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                >
                  <option value="todos">Todas las bolsas</option>
                  {[...new Set([...assets, ...remote].map((a) => a.exchange))]
                    .sort()
                    .map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                </select>
                <div className="search-input">
                  <Search size={19} />
                  <input
                    aria-label="Buscar acciones"
                    placeholder="Empresa, ticker o mercado…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearchPage(1);
                    }}
                  />
                </div>
                <select
                  aria-label="Tipo de instrumento"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="todos">Todos los instrumentos</option>
                  <option value="accion">Acciones internacionales</option>
                  <option value="cedear">CEDEARs</option>
                  <option value="etf">ETFs</option>
                </select>
                <select
                  aria-label="País"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setSearchPage(1);
                  }}
                >
                  <option value="todos">Todos los países</option>
                  <option value="asia">Asia</option>
                  {[
                    "us",
                    "ar",
                    "de",
                    "fr",
                    "nl",
                    "gb",
                    "jp",
                    "hk",
                    "ch",
                    "br",
                    "ca",
                    "in",
                    "cn",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {countryName(c)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="todos">Todos los sectores</option>
                  {[...new Set(assets.map((a) => a.sector))].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="results-meta">
                <span>{shownAssets.length} instrumentos en esta vista</span>
                {searchBusy && (
                  <span>
                    <LoaderCircle className="spin" size={14} /> Consultando
                    mercados mundiales…
                  </span>
                )}
              </div>
              {searchError && (
                <p className="inline-error">
                  {searchError} Se muestran coincidencias del catálogo local.
                </p>
              )}
              {shownAssets.length ? (
                assetTable(shownAssets)
              ) : (
                <Empty
                  title="No encontramos coincidencias"
                  text="Probá con el nombre de la empresa o su símbolo. La cobertura depende del proveedor."
                />
              )}
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={searchPage === 1}
                  onClick={() => setSearchPage((n) => n - 1)}
                >
                  Anterior
                </button>
                <span>Página {searchPage}</span>
                <button
                  className="secondary"
                  disabled={!hasMore || searchBusy}
                  onClick={() => setSearchPage((n) => n + 1)}
                >
                  Siguiente
                </button>
              </div>
              <p className="footnote">
                El catálogo inicial es una selección. Escribí al menos dos
                caracteres para buscar en los mercados cubiertos por Marketaux.
                Los instrumentos seleccionados y las posiciones consultan su
                precio por bolsa. La cobertura puede ser parcial; también podés
                registrar un precio manual.
              </p>
            </section>
          )}
          {page === "noticias" && (
            <>
              <div className="recap">
                <Sparkles />
                <div>
                  <h2>Qué pasó con mis acciones</h2>
                  <p>
                    {newArticles
                      ? `${newArticles} noticias nuevas entre los resultados disponibles desde tu última visita.`
                      : "Estás al día con las noticias disponibles para tu selección."}{" "}
                    {symbols
                      ? `En seguimiento: ${symbols.replaceAll(",", ", ")}.`
                      : "Agregá favoritas para personalizar este resumen."}
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setReload((n) => n + 1)}
                >
                  Actualizar
                </button>
              </div>
              {newsSection}
            </>
          )}
          {page === "cartera" && (
            <section className="panel">
              <div className="section-head">
                <h2>Mis posiciones</h2>
                <select
                  aria-label="Filtrar riesgo"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  {["todos", "alto", "medio", "bajo", "sin clasificar"].map(
                    (r) => (
                      <option key={r}>{r}</option>
                    ),
                  )}
                </select>
                <button
                  className="secondary"
                  onClick={() => setSearchOpen(true)}
                >
                  <Plus size={16} />
                  Registrar compra
                </button>
              </div>
              {data.positions.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Instrumento</th>
                        <th>Cantidad</th>
                        <th>Costo unitario</th>
                        <th>Valor estimado</th>
                        <th>Resultado</th>
                        <th>Gestionar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.positions
                        .filter(
                          (p) =>
                            riskFilter === "todos" ||
                            (p.risk || "sin clasificar") === riskFilter,
                        )
                        .map((p) => {
                          const { value, cost } = positionValue(
                            p,
                            market,
                            data.currency,
                          );
                          return (
                            <tr key={p.asset.id}>
                              <td>
                                <button
                                  className="asset-cell"
                                  onClick={() => choose(p.asset)}
                                >
                                  <Badge asset={p.asset} />
                                  <span>
                                    <strong>{p.asset.symbol}</strong>
                                    <small>
                                      {p.asset.kind === "cedear"
                                        ? "CEDEAR"
                                        : p.asset.exchange}{" "}
                                      · {p.asset.currency}
                                    </small>
                                  </span>
                                </button>
                              </td>
                              <td>{p.quantity}</td>
                              <td>
                                {format(
                                  p.cost,
                                  p.costCurrency || p.asset.currency,
                                )}
                              </td>
                              <td>
                                {format(value, data.currency)}
                                <small>
                                  {p.manualPrice !== undefined
                                    ? `Manual · ${time(p.manualPriceAt || p.updatedAt)}`
                                    : market?.global?.[p.asset.id]
                                      ? `Yahoo · ${time(market.global[p.asset.id].asOf)}`
                                      : "Referencia Data912"}{" "}
                                  · Riesgo {p.risk || "sin clasificar"}
                                </small>
                              </td>
                              <td
                                className={
                                  value != null &&
                                  cost != null &&
                                  value - cost < 0
                                    ? "negative"
                                    : "positive"
                                }
                              >
                                {value != null && cost != null
                                  ? format(value - cost, data.currency)
                                  : "Sin cotización"}
                              </td>
                              <td>
                                <button
                                  className="secondary compact"
                                  onClick={() => setEditing(p.asset)}
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Cada camino empieza con una inversión"
                  text="Buscá una acción o CEDEAR y registrá cantidad y precio de compra. Tus posiciones no salen de este navegador."
                  action={
                    <button
                      className="primary"
                      onClick={() => setSearchOpen(true)}
                    >
                      <Plus size={16} />
                      Mi primera posición
                    </button>
                  }
                />
              )}
              <p className="footnote">
                El costo y el valor se convierten con los tipos de cambio
                actuales (ARS vía CCL): el resultado mide la variación en moneda
                de origen, no la ganancia histórica por tipo de cambio. No
                incluye comisiones, dividendos ni ajustes por splits. Las
                posiciones sin cotización o conversión quedan fuera del total.
              </p>
            </section>
          )}
          {page === "analisis" && (
            <Research
              key={selected.id}
              asset={selected}
              theme={preferences.theme === "claro" ? "light" : "dark"}
              onSearch={() => setSearchOpen(true)}
            />
          )}
          {page === "riesgo" && (
            <RiskPanel
              positions={data.positions}
              market={market}
              currency={data.currency}
            />
          )}
          {page === "recursos" && <Resources market={market} />}
          {page === "calendario" && (
            <>
              <MacroPanel
                positions={data.positions}
                market={market}
                currency={data.currency}
              />
              <section className="panel">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">AGENDA GLOBAL</span>
                    <h2>Calendario económico</h2>
                  </div>
                  <a
                    className="secondary"
                    href="https://www.tradingview.com/markets/stocks-usa/earnings/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Próximos balances <ExternalLink size={15} />
                  </a>
                </div>
                <TradingWidget
                  theme={preferences.theme === "claro" ? "light" : "dark"}
                  kind="calendar"
                  symbol=""
                />
              </section>
              <section className="panel">
                <div className="section-head">
                  <h2>Conocé la empresa · {selected.symbol}</h2>
                </div>
                <TradingWidget
                  theme={preferences.theme === "claro" ? "light" : "dark"}
                  kind="profile"
                  symbol={selected.tv}
                />
                <p className="footnote">
                  Los próximos balances se consultan en TradingView. El
                  calendario integrado muestra eventos económicos, no una agenda
                  personalizada de tus acciones.
                </p>
              </section>
            </>
          )}
          {page === "ajustes" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <ShieldCheck size={27} />
                <h2>Tu información, en tus manos</h2>
                <p>
                  Favoritas, listas y posiciones se guardan únicamente en este
                  navegador. Para usarlas en otro dispositivo, exportá e importá
                  un respaldo.
                </p>
                <div className="button-row">
                  <button className="primary" onClick={exportData}>
                    <ArrowDownToLine size={17} />
                    Exportar respaldo
                  </button>
                  <button
                    className="secondary"
                    onClick={() => uploadRef.current?.click()}
                  >
                    <ArrowUpFromLine size={17} />
                    Importar
                  </button>
                </div>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => importFile(e.target.files?.[0])}
                />
                <p className="footnote">
                  Borrar los datos del navegador elimina el guardado. El
                  respaldo contiene tus posiciones; compartilo solo con quien
                  quieras.
                </p>
              </section>
              <section className="panel settings-panel">
                <ListFilter size={27} />
                <h2>Organizá tus listas</h2>
                <p>
                  Separá oportunidades, largo plazo o empresas que querés
                  conocer.
                </p>
                <form
                  className="list-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = newList.trim();
                    if (
                      !name ||
                      data.lists.includes(name) ||
                      data.lists.length >= 30
                    ) {
                      setNotice(
                        "Elegí un nombre distinto. Podés crear hasta 30 listas.",
                      );
                      return;
                    }
                    setData((d) => ({ ...d, lists: [...d.lists, name] }));
                    setNewList("");
                  }}
                >
                  <input
                    aria-label="Nombre de la lista"
                    value={newList}
                    maxLength={40}
                    onChange={(e) => setNewList(e.target.value)}
                    placeholder="Nombre de tu nueva lista"
                  />
                  <button className="primary" type="submit">
                    <Plus size={17} />
                    Crear
                  </button>
                </form>
                <div className="list-pills">
                  {data.lists.map((l) => (
                    <span key={l}>
                      {l}
                      {l !== "Principal" && (
                        <button
                          aria-label={`Eliminar lista ${l}`}
                          onClick={() => {
                            setData((d) => ({
                              ...d,
                              lists: d.lists.filter((x) => x !== l),
                              assignments: Object.fromEntries(
                                Object.entries(d.assignments).filter(
                                  ([, v]) => v !== l,
                                ),
                              ),
                            }));
                            if (list === l) setList("Todas");
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </section>
              <section className="panel settings-panel">
                <Globe2 size={27} />
                <h2>Fuentes y cobertura</h2>
                <p>
                  <a
                    href="https://www.marketaux.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Marketaux
                  </a>
                  : búsqueda internacional, noticias y sentimiento.{" "}
                  <a
                    href="https://www.tradingview.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    TradingView
                  </a>
                  : gráficos y calendario.{" "}
                  <a
                    href="https://data912.apidocs.ar/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Data912
                  </a>
                  : cotizaciones orientativas de EE. UU. y CEDEARs.{" "}
                  <a
                    href="https://dolarapi.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    DolarAPI
                  </a>
                  : dólar CCL.
                </p>
                <p>
                  Data912 declara fines educativos y datos que no son en tiempo
                  real. No todos los mercados tienen cobertura. Las noticias se
                  consultan para hasta 15 símbolos por vez.
                </p>
                <small>
                  Los gráficos integrados conectan tu navegador con TradingView.
                  Las consultas de noticias envían los símbolos al servidor; las
                  cantidades y costos permanecen locales.
                </small>
              </section>
              <section className="panel settings-panel">
                <Compass size={27} />
                <h2>Hecho para crecer con vos</h2>
                <p>Brújula Bursátil · v0.4.1</p>
                <p>
                  Un proyecto personal de German Bartoli, con la colaboración de
                  Codex. Código abierto, datos personales locales.
                </p>
                <a
                  className="secondary"
                  href="https://github.com/GermanBartoli/brujula-bursatil"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver el proyecto <ArrowUpRight size={16} />
                </a>
              </section>
            </div>
          )}
          <footer>
            <span>
              <span className="footer-dot" />
              {market
                ? `Datos consultados ${time(market.fetchedAt)}`
                : "Conectando con las fuentes"}{" "}
              · Cotizaciones orientativas
            </span>
            <span>
              Hecho para mirar más lejos <Compass size={13} />
            </span>
          </footer>
        </main>
      </div>
      {filterEditor && (
        <NewsFilterModal
          filter={filterEditor}
          assets={[
            ...new Map(
              [...followed, ...filterEditor.assets, ...assets].map((a) => [
                a.id,
                a,
              ]),
            ).values(),
          ]}
          onClose={() => setFilterEditor(null)}
          onSave={(filter) => {
            setPreferences((p) => ({
              ...p,
              filters: [...p.filters.filter((f) => f.id !== filter.id), filter],
            }));
            setNewsScope(filter.id);
            setNewsMode("direct");
            setFilterEditor(null);
          }}
          onDelete={
            preferences.filters.some((f) => f.id === filterEditor.id)
              ? () => {
                  setPreferences((p) => ({
                    ...p,
                    filters: p.filters.filter((f) => f.id !== filterEditor.id),
                  }));
                  if (newsScope === filterEditor.id) setNewsScope("lista");
                  setFilterEditor(null);
                }
              : undefined
          }
        />
      )}
      {searchOpen && (
        <Modal
          title="Encontrá tu próximo horizonte"
          onClose={() => setSearchOpen(false)}
        >
          <div className="modal-body">
            <div className="search-input large">
              <Search size={20} />
              <input
                autoFocus
                aria-label="Buscar instrumento"
                placeholder="NVIDIA, ETR:NVD, FRA:NVD, NVD.DE…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchPage(1);
                  setExchange("todos");
                  setKind("todos");
                  setCountry("todos");
                  setSector("todos");
                }}
              />
            </div>
            <p className="muted">
              Buscá por nombre, bolsa:ticker o sufijo. Ej.: ETR:NVD / NVD.DE
              (Xetra, EUR), FRA:NVD / NVD.F (Frankfurt, EUR), NASDAQ:NVDA (EE.
              UU., USD), AMS:VHYL. También admite fórmulas GOOGLEFINANCE.
            </p>
            {searchBusy && (
              <p className="muted">Buscando en mercados mundiales…</p>
            )}
            {searchError && <p className="inline-error">{searchError}</p>}
            <div className="search-results">
              {shownAssets.map((a) => (
                <div className="search-result" key={a.id}>
                  <button className="asset-cell" onClick={() => choose(a)}>
                    <Badge asset={a} />
                    <span>
                      <strong>
                        {a.symbol}
                        <span className="kind-label">
                          {a.kind === "cedear" ? "CEDEAR" : a.exchange}
                        </span>
                      </strong>
                      <small>
                        {a.name} · {a.currency}
                      </small>
                    </span>
                  </button>
                  <button
                    className={`icon-btn ${data.watchlist.some((x) => x.id === a.id) ? "is-starred" : ""}`}
                    aria-label={`Seguir ${a.symbol} ${a.exchange}`}
                    onClick={() => toggleWatch(a)}
                  >
                    <Star
                      size={18}
                      fill={
                        data.watchlist.some((x) => x.id === a.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                  <button
                    className="secondary compact"
                    onClick={() => {
                      setEditing(a);
                      setSearchOpen(false);
                    }}
                  >
                    Registrar
                  </button>
                </div>
              ))}
              {!shownAssets.length && !searchBusy && (
                <Empty
                  title="Sin coincidencias"
                  text="Probá con otro nombre o símbolo."
                />
              )}
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <PositionModal
          asset={editing}
          position={data.positions.find((p) => p.asset.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            setData((d) => ({
              ...d,
              positions: [
                ...d.positions.filter((x) => x.asset.id !== p.asset.id),
                p,
              ],
              watchlist: d.watchlist.map((a) =>
                a.id === p.asset.id ? p.asset : a,
              ),
            }));
            setEditing(null);
            setNotice("Posición guardada en este navegador.");
          }}
          onDelete={() => {
            setData((d) => ({
              ...d,
              positions: d.positions.filter((p) => p.asset.id !== editing.id),
            }));
            setEditing(null);
            setNotice("Posición eliminada del registro local.");
          }}
        />
      )}
      {confirmImport && (
        <Modal
          title="Importar tu respaldo"
          onClose={() => setConfirmImport(null)}
        >
          <div className="modal-body">
            <p>
              Este respaldo contiene {confirmImport.watchlist.length} favoritas
              y {confirmImport.positions.length} posiciones. Reemplazará los
              datos actuales de este navegador.
            </p>
            <div className="button-row">
              <button className="secondary" onClick={exportData}>
                Respaldar datos actuales
              </button>
              <button
                className="primary"
                onClick={() => {
                  setData(confirmImport);
                  setStorageError("");
                  setSelected(confirmImport.watchlist[0] || catalog[0]);
                  setList("Todas");
                  setConfirmImport(null);
                  setNotice("Respaldo importado.");
                }}
              >
                Reemplazar e importar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button
            className="icon-btn"
            aria-label="Cerrar aviso"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function PositionModal({
  asset,
  position,
  onClose,
  onSave,
  onDelete,
}: {
  asset: Asset;
  position?: Position;
  onClose: () => void;
  onSave: (p: Position) => void;
  onDelete: () => void;
}) {
  const [quoteCurrency, setQuoteCurrency] = useState(
    (position?.asset.currency || asset.currency) === "XXX"
      ? ""
      : position?.asset.currency || asset.currency,
  );
  const [costCurrency, setCostCurrency] = useState(
    position?.costCurrency || asset.currency,
  );
  const [risk, setRisk] = useState(position?.risk || "");
  const [manualPrice, setManualPrice] = useState(
    position?.manualPrice?.toString() || "",
  );
  const [quantity, setQuantity] = useState(position?.quantity.toString() || ""),
    [cost, setCost] = useState(position?.cost.toString() || ""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [underlying, setUnderlying] = useState(asset.underlying);
  function submit(e: FormEvent) {
    e.preventDefault();
    const q = Number(quantity),
      c = Number(cost);
    if (
      !Number.isFinite(q) ||
      q <= 0 ||
      !Number.isFinite(c) ||
      c < 0 ||
      cost.trim() === "" ||
      q > 1e12 ||
      c > 1e12
    ) {
      setError("Ingresá una cantidad mayor a cero y un costo válido.");
      return;
    }
    if (underlying && !/^[A-Z0-9.^=_\-]{1,24}$/i.test(underlying)) {
      setError("El símbolo de origen no es válido.");
      return;
    }
    if (
      manualPrice &&
      (!Number.isFinite(Number(manualPrice)) || Number(manualPrice) <= 0)
    ) {
      setError("El precio manual debe ser mayor a cero.");
      return;
    }
    if (
      !currencies.includes(quoteCurrency) ||
      !currencies.includes(costCurrency)
    ) {
      setError("Confirmá las monedas de cotización y compra.");
      return;
    }
    onSave({
      costCurrency,
      risk: risk ? (risk as Position["risk"]) : undefined,
      manualPrice: manualPrice ? Number(manualPrice) : undefined,
      manualPriceAt: manualPrice
        ? position?.manualPrice === Number(manualPrice)
          ? position.manualPriceAt || position.updatedAt
          : new Date().toISOString()
        : undefined,
      asset: {
        ...asset,
        currency: quoteCurrency,
        underlying: underlying.toUpperCase(),
      },
      quantity: q,
      cost: c,
      updatedAt: new Date().toISOString(),
    });
  }
  return (
    <Modal
      title={position ? "Editar posición" : "Registrar posición"}
      onClose={onClose}
    >
      <form className="modal-body position-form" onSubmit={submit}>
        <div className="asset-cell">
          <Badge asset={asset} />
          <span>
            <strong>{asset.name}</strong>
            <small>
              {asset.symbol} · {asset.exchange} · {asset.currency}
            </small>
          </span>
        </div>
        <label>
          Cantidad de títulos
          <input
            autoFocus
            type="number"
            min="0.00000001"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ej. 10"
          />
        </label>
        <label>
          Precio promedio de compra por título ({costCurrency})
          <input
            type="number"
            min="0"
            step="any"
            required
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Ej. 125,50"
          />
        </label>
        <label>
          Moneda de cotización
          <select
            required
            value={quoteCurrency}
            onChange={(e) => setQuoteCurrency(e.target.value)}
          >
            <option value="">Confirmá con tu broker</option>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Moneda del precio de compra
          <select
            required
            value={costCurrency}
            onChange={(e) => setCostCurrency(e.target.value)}
          >
            <option value="XXX">Elegí la moneda</option>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Mi clasificación de riesgo
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">Sin clasificar</option>
            {["bajo", "medio", "alto"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Precio actual manual ({quoteCurrency || "confirmar moneda"}) ·
          opcional
          <input
            type="number"
            step="any"
            min="0.00000001"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            placeholder="Vacío: usar precio del mercado"
          />
        </label>
        <small>
          La cotización pertenece a {asset.exchange}. Confirmá su moneda con el
          broker; los precios automáticos solo se usan si su moneda coincide.
          Para otra cotización, elegí esa bolsa. El precio manual reemplaza al
          automático hasta que lo borres.
        </small>
        {asset.kind === "cedear" && (
          <label>
            Símbolo de la acción de origen
            <input
              value={underlying}
              maxLength={24}
              onChange={(e) => setUnderlying(e.target.value)}
              placeholder="Ej. AAPL"
            />
            <small>
              Se usa para buscar noticias de la empresa. No convierte cantidades
              ni aplica ratios.
            </small>
          </label>
        )}
        <p className="footnote">
          Si ya tenés varias compras, ingresá el total de títulos y su costo
          promedio. Este registro no ejecuta operaciones de bolsa.
        </p>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="primary" type="submit">
            Guardar posición <Check size={16} />
          </button>
          {position && (
            <button
              type="button"
              className="danger-btn"
              onClick={() => (deleting ? onDelete() : setDeleting(true))}
            >
              <Trash2 size={15} />
              {deleting ? "Confirmar eliminación" : "Eliminar"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function NewsFilterModal({
  filter,
  assets,
  onSave,
  onClose,
  onDelete,
}: {
  filter: NewsFilter;
  assets: Asset[];
  onSave: (filter: NewsFilter) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(filter.name);
  const [chosen, setChosen] = useState(filter.assets.map((a) => a.id));
  const [query, setQuery] = useState("");
  const filtered = assets.filter((a) =>
    `${a.symbol} ${a.name}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <Modal
      title={
        filter.name ? "Editar filtro de noticias" : "Crear filtro de noticias"
      }
      onClose={onClose}
    >
      <form
        className="modal-body news-filter-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && chosen.length)
            onSave({
              ...filter,
              name: name.trim(),
              assets: assets.filter((a) => chosen.includes(a.id)),
            });
        }}
      >
        <label>
          Nombre del filtro
          <input
            autoFocus
            value={name}
            maxLength={40}
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Tecnología y energía"
          />
        </label>
        <label>
          Buscar acciones del filtro
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o símbolo"
          />
        </label>
        <p className="muted">
          Elegí las acciones que quieras combinar. {chosen.length}{" "}
          seleccionadas.
        </p>
        <div className="filter-options">
          {filtered.map((a) => (
            <label key={a.id} className="filter-option">
              <input
                type="checkbox"
                checked={chosen.includes(a.id)}
                onChange={(e) =>
                  setChosen((ids) =>
                    e.target.checked
                      ? [...ids, a.id]
                      : ids.filter((id) => id !== a.id),
                  )
                }
              />
              <span>
                <strong>
                  {a.symbol} · {a.exchange}
                </strong>
                <small>{a.name}</small>
              </span>
            </label>
          ))}
          {!filtered.length && <p className="muted">Sin coincidencias.</p>}
        </div>
        <div className="button-row">
          <button
            className="primary"
            type="submit"
            disabled={!name.trim() || !chosen.length}
          >
            Guardar filtro
          </button>
          {onDelete && (
            <button className="danger-btn" type="button" onClick={onDelete}>
              Eliminar filtro
            </button>
          )}
        </div>
        <p className="footnote">
          Se guarda en este navegador. Los filtros de idioma y mercado también
          se aplican a esta selección.
        </p>
      </form>
    </Modal>
  );
}
