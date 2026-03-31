import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

export default function NsiPackagesPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [pkgs, setPkgs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const itemName = useMemo(() => {
    const m = new Map<number, string>(items.map((i: any) => [i.id, i.name]));
    return (id: number) => m.get(id) ?? String(id);
  }, [items]);

  const uomCode = useMemo(() => {
    const m = new Map<number, string>(uoms.map((u: any) => [u.id, u.code]));
    return (id: number) => m.get(id) ?? String(id);
  }, [uoms]);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [it, u, p] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/`, token }),
      ]);
      setItems(it ?? []);
      setUoms(u ?? []);
      setPkgs(p ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function remove(id: number) {
    if (!token) return;
    if (!confirm("Удалить упаковку?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/${id}/`,
        token,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="НСИ: Упаковки"
        subtitle="Список фасовок. Создание — через отдельный экран."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={() => nav("/nsi/packages/new")}>Создать упаковку</button>
          </>
        }
      />
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr><th>ID</th><th>Позиция</th><th>Поставщик</th><th>Правило</th><th>Статус</th><th></th></tr>
        </thead>
        <tbody>
          {pkgs.map((p: any) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{itemName(p.item)}</td>
              <td>{String(p.supplier_code ?? "").trim() || "—"}</td>
              <td><span className="badge">1 {uomCode(p.package_uom)}</span> = <b>{p.content_qty}</b> {uomCode(p.content_uom)}</td>
              <td>{p.status}</td>
              <td style={{ textAlign: "right" }}>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => nav(`/nsi/packages/${p.id}/edit`)}>Редактировать</button>
                  <button className="btn" onClick={() => remove(p.id)}>Удалить</button>
                </div>
              </td>
            </tr>
          ))}
          {pkgs.length === 0 && <tr><td colSpan={6}><small>Пока нет упаковок.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
