import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { downloadWithAuth } from "../lib/download";

type Invoice = any;

function fmtDate(s: string | null | undefined) {
  if (!s) return "-";
  return s.slice(0, 10);
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return "-";
  return s.replace("T", " ").slice(0, 19);
}

function fmtQty(v: unknown, digits = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "-");
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function fmtSize(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [inv, setInv] = useState<Invoice | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "calculate" | "generate">("");

  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);
  const lines = inv?.lines ?? [];
  const files = inv?.files ?? [];

  const summary = useMemo(() => {
    const data = lines.reduce(
      (acc: any, l: any) => {
        acc.count += 1;
        acc.docQty += Number(l.qty ?? 0) || 0;
        if (l.converted) {
          acc.converted += 1;
          acc.postingQty += Number(l.converted.posting_qty ?? 0) || 0;
        }
        return acc;
      },
      { count: 0, converted: 0, docQty: 0, postingQty: 0 }
    );
    return data;
  }, [lines]);

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
    return s === "new" || s === "failed";
  }, [inv?.status]);

  const canGenerate = useMemo(() => {
    const s = String(inv?.status ?? "");
    return s === "calculated";
  }, [inv?.status]);

  const status = String(inv?.status ?? "");

  return (
    <div className="card">
      <PageHeader
        title={`Накладная: ${inv?.number ?? `#${invId}`}`}
        subtitle={`Статус: ${status || "-"} • Создана: ${fmtDateTime(inv?.created_at)}`}
        right={
          <>
            <button className="btn" onClick={() => nav("/")}>К списку</button>
            <button className="btn" onClick={load}>Обновить</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!inv ? <div style={{ padding: 8 }}>Загрузка...</div> : null}

      {inv ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="invoice-meta-grid">
            <div className="invoice-meta-item">
              <small>Поставщик</small>
              <b>{String(inv.supplier ?? "-")}</b>
            </div>
            <div className="invoice-meta-item">
              <small>Дата документа</small>
              <b>{fmtDate(inv.doc_date)}</b>
            </div>
            <div className="invoice-meta-item">
              <small>Строк в документе</small>
              <b>{summary.count}</b>
            </div>
            <div className="invoice-meta-item">
              <small>Рассчитано строк</small>
              <b>{summary.converted}</b>
            </div>
            <div className="invoice-meta-item">
              <small>Сумма в документе</small>
              <b>{fmtQty(summary.docQty, 3)}</b>
            </div>
            <div className="invoice-meta-item">
              <small>Сумма оприходования</small>
              <b>{fmtQty(summary.postingQty, 6)}</b>
            </div>
          </div>
        </div>
      ) : null}

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
            {busy === "calculate" ? "Считаю..." : "Рассчитать"}
          </button>
          <button className="btn primary" onClick={generate} disabled={!canGenerate || busy !== ""}>
            {busy === "generate" ? "Генерирую..." : "Сгенерировать XLSX/PDF"}
          </button>
          <div style={{ flex: 1 }} />
          <span className="badge">new -> calculating -> calculated -> generating -> generated</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Таблица строк</h4>
        <div style={{ overflowX: "auto" }}>
          <table className="compact-table invoice-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Номенклатура</th>
                <th className="num">Кол-во</th>
                <th>ЕИ</th>
                <th className="num">Оприход.</th>
                <th>ЕИ опр.</th>
                <th>Статус</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any) => {
                const it = itemById.get(l.item_id);
                const name = it?.name ?? `item_id=${l.item_id}`;
                const conv = l.converted;
                const rowStatus = conv ? "ok" : (status === "failed" ? "failed" : "-");
                const note = conv
                  ? `Шагов: ${Array.isArray(conv.steps) ? conv.steps.length : 0}`
                  : (status === "failed" ? "Проверьте правила конвертации" : "");

                return (
                  <tr key={l.line_no}>
                    <td>{l.line_no}</td>
                    <td className="name-cell">{name}</td>
                    <td className="num">{fmtQty(l.qty, 3)}</td>
                    <td>{l.uom_code}</td>
                    <td className="num">{conv ? fmtQty(conv.posting_qty, 6) : "-"}</td>
                    <td>{conv?.posting_uom_code ?? "-"}</td>
                    <td><span className="badge">{rowStatus}</span></td>
                    <td className="note-cell"><small>{note}</small></td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={8}><small>Строк нет.</small></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Файлы</h4>
        {files.length === 0 ? (
          <small>Файлов пока нет. Нажми «Сгенерировать XLSX/PDF» после расчёта.</small>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="compact-table">
              <thead>
                <tr><th>Тип</th><th>Файл</th><th className="num">Размер</th><th>Создан</th><th></th></tr>
              </thead>
              <tbody>
                {files.map((f: any, idx: number) => (
                  <tr key={idx}>
                    <td><span className="badge">{f.file_type}</span></td>
                    <td><small>{String(f.file_name ?? f.download_url ?? "-")}</small></td>
                    <td className="num">{fmtSize(f.size)}</td>
                    <td><small>{fmtDateTime(f.created_at)}</small></td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn" onClick={() => downloadFile(f)}>Скачать</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
