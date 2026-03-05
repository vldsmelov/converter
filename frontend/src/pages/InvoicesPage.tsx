import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

type InvoiceRow = any;

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return s.slice(0, 10);
}

export default function InvoicesPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | "all">("all");

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (rows ?? []).filter((r: any) => {
      if (status !== "all" && String(r.status ?? "") !== status) return false;
      if (!qq) return true;
      const s = `${r.number ?? ""} ${r.supplier ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [rows, q, status]);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    (rows ?? []).forEach((r: any) => r?.status && s.add(String(r.status)));
    return Array.from(s).sort();
  }, [rows]);

  return (
    <div className="card">
      <PageHeader
        title="Накладные"
        subtitle="Список созданных накладных. Создание — на отдельном экране."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={() => nav("/create")}>Создать накладную</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1 }}>
            <small>Поиск (номер / поставщик)</small><br />
            <input value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%" }} placeholder="например: INV-TEST" />
          </label>
          <label>
            <small>Статус</small><br />
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="all">Все</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Номер</th>
            <th>Поставщик</th>
            <th>Дата</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r: any) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><Link to={`/invoices/${r.id}`}>{r.number}</Link></td>
              <td>{r.supplier}</td>
              <td>{fmtDate(r.doc_date)}</td>
              <td><span className="badge">{r.status}</span></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn" onClick={() => nav(`/invoices/${r.id}`)}>Открыть</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6}><small>Пока нет накладных (или фильтр ничего не нашёл).</small></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
