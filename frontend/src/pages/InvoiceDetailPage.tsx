import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { downloadWithAuth } from "../lib/download";

type Invoice = any;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invId = Number(id);
  const { docs } = useApi();
  const { token } = useAuth();

  const [inv, setInv] = useState<Invoice | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await docs.GET("/api/v1/invoices/{id}/", { params: { path: { id: invId } } as any });
    if (error) {
      setErr(typeof error === "string" ? error : JSON.stringify(error));
      return;
    }
    setInv(data as any);
    setErr(null);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invId]);

  async function runAndWait(kind: "calculate" | "generate") {
    setBusy(kind);
    setErr(null);

    const path = kind === "calculate"
      ? "/api/v1/invoices/{id}/calculate/"
      : "/api/v1/invoices/{id}/generate/";

    const { error } = await docs.POST(path as any, { params: { path: { id: invId } } as any });
    if (error) {
      setErr(typeof error === "string" ? error : JSON.stringify(error));
      setBusy(null);
      return;
    }

    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      await load();
      const st = (inv as any)?.status;
      if (st === "failed") break;
      if (kind === "calculate" && st === "calculated") break;
      if (kind === "generate" && st === "generated") break;
    }
    setBusy(null);
  }

  async function downloadFile(f: any) {
    if (f.presigned_url) {
      window.open(f.presigned_url, "_blank");
      return;
    }
    if (!token) {
      setErr("Нет токена для скачивания через прокси.");
      return;
    }
    await downloadWithAuth(f.download_url, token, f.file_name);
  }

  if (!inv) return <div className="card">Загрузка…</div>;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0 }}>{inv.number}</h3>
          <small>ID: {inv.id} • Поставщик: {inv.supplier} • Дата: {inv.doc_date}</small>
        </div>
        <div className="row">
          <span className="badge">{inv.status}</span>
        </div>
      </div>

      {inv.error && <div style={{ padding: 8, color: "#fca5a5" }}>Ошибка: {inv.error}</div>}
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={!!busy} onClick={() => runAndWait("calculate")}>
          {busy === "calculate" ? "Рассчитываю…" : "Рассчитать"}
        </button>
        <button className="btn primary" disabled={!!busy || inv.status !== "calculated"} onClick={() => runAndWait("generate")}>
          {busy === "generate" ? "Формирую…" : "Сформировать XLSX/PDF"}
        </button>
        <button className="btn" onClick={load}>Обновить</button>
      </div>

      <h4>Строки</h4>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Товар</th>
            <th>Кол-во</th>
            <th>ЕИ</th>
            <th>Проводка</th>
            <th>ЕИ проводки</th>
            <th>Шаги</th>
          </tr>
        </thead>
        <tbody>
          {(inv.lines ?? []).map((ln: any) => (
            <tr key={ln.line_no}>
              <td>{ln.line_no}</td>
              <td>{ln.item_id}</td>
              <td>{ln.qty}</td>
              <td>{ln.uom_code}</td>
              <td>{ln.converted?.posting_qty ?? "—"}</td>
              <td>{ln.converted?.posting_uom_code ?? "—"}</td>
              <td>
                <small>
                  {(ln.converted?.steps ?? []).map((s: any, idx: number) => (
                    <div key={idx}>
                      <span className="badge">{s.kind}</span> {s.description}
                    </div>
                  ))}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginTop: 16 }}>Файлы</h4>
      {(inv.files ?? []).length === 0 && <small>Файлов ещё нет (сначала «Сформировать XLSX/PDF»).</small>}
      <div className="row" style={{ marginTop: 8 }}>
        {(inv.files ?? []).map((f: any) => (
          <button key={f.id} className="btn" onClick={() => downloadFile(f)}>
            Скачать {String(f.file_type).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
