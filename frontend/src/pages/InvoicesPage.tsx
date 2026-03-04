import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "./api";

type InvoiceRow = any;

export default function InvoicesPage() {
  const { docs } = useApi();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await docs.GET("/api/v1/invoices/");
    if (error) {
      setErr(typeof error === "string" ? error : JSON.stringify(error));
      setRows([]);
    } else {
      setRows((data as any) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Накладные</h3>
        <button className="btn" onClick={load}>Обновить</button>
      </div>

      {loading && <div style={{ padding: 8 }}>Загрузка…</div>}
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Номер</th>
            <th>Статус</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><Link to={`/invoices/${r.id}`}>{r.number}</Link></td>
              <td><span className="badge">{r.status}</span></td>
              <td><small>{r.updated_at}</small></td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={4}><small>Пока нет накладных. Перейди в «Создать».</small></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
