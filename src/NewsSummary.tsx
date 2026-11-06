import { useEffect, useRef, useState } from "react";
import type { Article } from "./types";
export function NewsSummary({ articles, context, busy }: { articles: Article[]; context: string; busy: boolean }) {
  const [result, setResult] = useState<{ analysis: string; sources: { title: string; url: string }[] } | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const signature = context + articles.map(a => a.uuid).join(",");
  const current = useRef(signature); current.current = signature;
  useEffect(() => { setResult(null); setError(""); }, [signature]);
  async function summarize() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/news-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: articles.slice(0, 12).map(a => a.uuid), sector: context.slice(0, 100) }) });
      const data = await r.json() as { analysis: string; sources: { title: string; url: string }[]; error?: string };
      if (!r.ok) throw Error(data.error || "No se pudo resumir.");
      if (current.current === signature) setResult(data);
    } catch (e) { if (current.current === signature) setError((e as Error).message); }
    finally { setLoading(false); }
  }
  return <div className="news-summary">
    <button className="secondary" disabled={busy || loading || !articles.length} onClick={summarize}>{loading ? "Resumiendo…" : "Resumir noticias e impacto sectorial"}</button>
    <p className="footnote">Hasta 12 titulares y extractos visibles · tasas, inflación, regulación y resultados según las noticias disponibles.</p>
    {error && <p role="alert">{error}</p>}
    {!busy && result && <div className="analysis"><p style={{ whiteSpace: "pre-wrap" }}>{result.analysis}</p><ol>{result.sources.map((s, i) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">[{i + 1}] {s.title}</a></li>)}</ol></div>}
  </div>;
}
