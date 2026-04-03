import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

export default function NsiUomsPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [uoms, setUoms] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const catCode = useMemo(() => {
    const m = new Map<number, string>(cats.map((c: any) => [c.id, c.code]));
    return (id: number) => m.get(id) ?? String(id);
  }, [cats]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [c, u] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
      ]);
      setCats(c ?? []);
      setUoms(u ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: number) {
    if (!token) return;
    if (!confirm("Удалить ЕИ?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/${id}/`,
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
        title="НСИ: Единицы измерения"
        subtitle="Здесь отображается список ЕИ. Создание/редактирование — через отдельный экран."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={() => nav("/nsi/uoms/new")}>Создать ЕИ</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th><th>Код</th><th>Название</th><th>Категория</th><th>Коэффициент к базовой</th><th>Точность</th><th></th>
          </tr>
        </thead>
        <tbody>
          {uoms.map((u: any) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.code}</td>
              <td>{u.name}</td>
              <td>{catCode(u.category)}</td>
              <td><small>{u.factor_to_base}</small></td>
              <td>{u.precision}</td>
              <td style={{ textAlign: "right" }}>
                <button className="btn" onClick={() => nav(`/nsi/uoms/${u.id}/edit`)} style={{ marginRight: 8 }}>
                  Редактировать
                </button>
                <button className="btn" onClick={() => remove(u.id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {uoms.length === 0 && <tr><td colSpan={7}><small>Пока нет ЕИ.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
