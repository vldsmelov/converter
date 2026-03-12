import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

type InvoiceRow = any;
type QuickPreset = "all" | "new" | "failed" | "today" | "reset";

function fmtDate(s: string | null | undefined) {
  if (!s) return "-";
  return s.slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoicesPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const data = await requestJson<any[]>({
        method: "GET",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/`,
        token,
      });
      setRows(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token]);

  function applyPreset(preset: QuickPreset) {
    const today = todayIso();
    if (preset === "new") {
      setStatus("new");
      return;
    }

    if (preset === "failed") {
      setStatus("failed");
      return;
    }

    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
      return;
    }

    if (preset === "all") {
      setStatus("all");
      return;
    }

    setQ("");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return (rows ?? []).filter((r: any) => {
      if (status !== "all" && String(r.status ?? "") !== status) return false;

      const d = fmtDate(r.doc_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;

      if (!qq) return true;
      const s = `${r.number ?? ""} ${r.supplier ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [rows, q, status, dateFrom, dateTo]);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    (rows ?? []).forEach((r: any) => r?.status && s.add(String(r.status)));
    return Array.from(s).sort();
  }, [rows]);

  const total = rows.length;
  const shown = filtered.length;

  return (
    <div className="card">
      <PageHeader
        title="Накладные"
        subtitle={`Реестр документов: показано ${shown} из ${total}`}
        right={
          <>
            <button className="btn btn-tight" onClick={load}>Обновить</button>
            <button className="btn primary btn-tight" onClick={() => nav("/create")}>Создать накладную</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card invoice-filters" style={{ marginTop: 10 }}>
        <div className="row">
          <label style={{ flex: 1, minWidth: 260 }}>
            <small>Поиск (номер / поставщик)</small><br />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%" }}
              placeholder="например: INV-TEST"
            />
          </label>

          <label>
            <small>Статус</small><br />
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="all">Все</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label>
            <small>Дата с</small><br />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label>
            <small>Дата по</small><br />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>

        <div className="row invoice-preset-row" style={{ marginTop: 8 }}>
          <button className="btn btn-tight" onClick={() => applyPreset("all")}>Все</button>
          <button className="btn btn-tight" onClick={() => applyPreset("new")}>Новые</button>
          <button className="btn btn-tight" onClick={() => applyPreset("failed")}>Ошибки</button>
          <button className="btn btn-tight" onClick={() => applyPreset("today")}>Сегодня</button>
          <button className="btn btn-tight" onClick={() => applyPreset("reset")}>Сброс</button>
        </div>
      </div>

      <div className="invoice-list-wrap" style={{ marginTop: 10 }}>
        <table className="compact-table invoice-list-table">
          <thead>
            <tr>
              <th className="num mono id-col">ID</th>
              <th className="mono">Номер</th>
              <th>Поставщик</th>
              <th className="mono">Дата</th>
              <th className="num mono">Строк</th>
              <th>Статус</th>
              <th className="action-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => {
              const lineCount = Array.isArray(r.lines) ? r.lines.length : "-";
              return (
                <tr key={r.id}>
                  <td className="num mono id-col">{r.id}</td>
                  <td className="mono"><Link to={`/invoices/${r.id}`}>{r.number}</Link></td>
                  <td>{r.supplier}</td>
                  <td className="mono">{fmtDate(r.doc_date)}</td>
                  <td className="num mono">{lineCount}</td>
                  <td><span className="badge">{r.status}</span></td>
                  <td className="action-col" style={{ textAlign: "right" }}>
                    <button className="btn btn-tight" onClick={() => nav(`/invoices/${r.id}`)}>Открыть</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7}><small>По текущему фильтру записей нет.</small></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
