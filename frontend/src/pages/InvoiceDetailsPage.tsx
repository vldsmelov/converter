import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { downloadWithAuth } from "../lib/download";

type Invoice = any;

function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  return s.replace("T", " ").slice(0, 19);
}

export default function InvoiceDetailsPage() {
  const { id } = useParams();
  const invId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [inv, setInv] = useState<Invoice | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "calculate" | "generate">("");

  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [invoice, it] = await Promise.all([
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/${invId}/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
      ]);
      setInv(invoice);
      setItems(it ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, invId]);

  useEffect(() => {
    const s = String(inv?.status ?? "");
    if (s !== "calculating" && s !== "generating") return;
    const t = setInterval(() => load(), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [inv?.status]);

  async function calculate() {
    if (!token) return;
    setBusy("calculate");
    setErr(null);
    try {
      // POST without body: avoid any server expecting empty body.
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/${invId}/calculate/`,
        token,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    if (!token) return;
    setBusy("generate");
    setErr(null);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/${invId}/generate/`,
        token,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy("");
    }
  }

  async function downloadFile(f: any) {
    if (!token) return;
    const url = String(f.download_url ?? "");
    const abs = url.startsWith("http") ? url : `${import.meta.env.VITE_DOCS_BASE_URL}${url}`;
    const filename = `invoice-${invId}.${f.file_type ?? "bin"}`;
    try {
      await downloadWithAuth(abs, token, filename);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const canCalculate = useMemo(() => {
    const s = String(inv?.status ?? "");
    return s === "draft" || s === "failed";
  }, [inv?.status]);

  const canGenerate = useMemo(() => {
    const s = String(inv?.status ?? "");
    return s === "calculated";
  }, [inv?.status]);

  return (
    <div className="card">
      <PageHeader
        title={`Накладная: ${inv?.number ?? `#${invId}`}`}
        subtitle={`Статус: ${inv?.status ?? "—"} • Создана: ${fmtDateTime(inv?.created_at)}`}
        right={
          <>
            <button className="btn" onClick={() => nav("/")}>← К списку</button>
            <button className="btn" onClick={load}>Обновить</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!inv ? <div style={{ padding: 8 }}>Загрузка…</div> : null}

      {inv?.error ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Ошибка</h4>
          <div style={{ color: "#fca5a5" }}>{inv.error}</div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Действия</h4>
        <div className="row">
          <button className="btn primary" onClick={calculate} disabled={!canCalculate || busy !== ""}>
            {busy === "calculate" ? "Считаю…" : "Рассчитать"}
          </button>
          <button className="btn primary" onClick={generate} disabled={!canGenerate || busy !== ""}>
            {busy === "generate" ? "Генерирую…" : "Сгенерировать XLSX/PDF"}
          </button>
          <div style={{ flex: 1 }} />
          <span className="badge">draft → calculating → calculated → generating → generated</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Строки</h4>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Товар</th>
              <th>Кол-во</th>
              <th>ЕИ (в документе)</th>
              <th>Оприходование</th>
              <th>Статус строки</th>
            </tr>
          </thead>
          <tbody>
            {(inv?.lines ?? []).map((l: any) => {
              const it = itemById.get(l.item_id);
              const name = it?.name ?? `item_id=${l.item_id}`;
              const conv = l.converted;
              const ok = !!conv;
              return (
                <tr key={l.line_no}>
                  <td>{l.line_no}</td>
                  <td>{name}</td>
                  <td>{l.qty}</td>
                  <td>{l.uom_code}</td>
                  <td>{ok ? <span className="badge">{conv.posting_qty} {conv.posting_uom_code}</span> : "—"}</td>
                  <td>{ok ? "ok" : (inv?.status === "failed" ? "failed" : "—")}</td>
                </tr>
              );
            })}
            {(inv?.lines ?? []).length === 0 && <tr><td colSpan={6}><small>Строк нет.</small></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Файлы</h4>
        {(inv?.files ?? []).length === 0 ? (
          <small>Файлов пока нет. Нажми «Сгенерировать XLSX/PDF» после расчёта.</small>
        ) : (
          <table>
            <thead>
              <tr><th>Тип</th><th>Ссылка</th><th></th></tr>
            </thead>
            <tbody>
              {(inv.files ?? []).map((f: any, idx: number) => (
                <tr key={idx}>
                  <td><span className="badge">{f.file_type}</span></td>
                  <td><small>{String(f.download_url ?? "")}</small></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" onClick={() => downloadFile(f)}>Скачать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
