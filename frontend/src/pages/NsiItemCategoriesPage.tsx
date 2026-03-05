import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

export default function NsiItemCategoriesPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [u, c] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
      ]);
      setUoms(u ?? []);
      setCats(c ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  return (
    <div className="card">
      <PageHeader
        title="НСИ: Категории номенклатуры"
        subtitle="Единица по умолчанию — рекомендация для автоподстановки в номенклатуру. В каждой позиции можно выбрать другую единицу хранения."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={() => nav("/nsi/item-categories/new")}>Создать категорию</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Категория</th>
            <th>ЕИ по умолчанию</th>
            <th>Активна</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cats.map((c: any) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{uomCode(c.default_uom)}</td>
              <td>{String(c.is_active)}</td>
              <td style={{ textAlign: "right" }}>
                <button className="btn" onClick={() => nav(`/nsi/item-categories/${c.id}/edit`)}>Редактировать</button>
              </td>
            </tr>
          ))}
          {cats.length === 0 && <tr><td colSpan={5}><small>Пока нет категорий.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
