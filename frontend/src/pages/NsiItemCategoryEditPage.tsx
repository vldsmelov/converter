import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiItemCategoryEditPage() {
  const { id } = useParams();
  const catId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [defaultUom, setDefaultUom] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [u, c] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/${catId}/`, token }),
      ]);
      setUoms(u ?? []);
      setName(c.name ?? "");
      setDefaultUom(c.default_uom ?? null);
      setIsActive(!!c.is_active);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, [token, catId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token) return;
    setErr(null);
    try {
      await requestJson({
        method: "PUT",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/${catId}/`,
        token,
        body: { id: catId, name, default_uom: defaultUom, is_active: isActive },
      });
      nav("/nsi/item-categories");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function remove() {
    if (!token) return;
    if (!confirm("Удалить категорию?")) return;
    setErr(null);
    try {
      await requestJson({ method: "DELETE", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/${catId}/`, token });
      nav("/nsi/item-categories");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title={`Редактирование категории #${catId}`}
        subtitle="ЕИ по умолчанию используется только как автоподстановка в номенклатуру и не запрещает хранить отдельные позиции в другой единице."
        right={<button className="btn" onClick={() => nav("/nsi/item-categories")}>← Назад</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1 }}>
            <small>Название</small><br />
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <small>ЕИ по умолчанию (рекомендация)</small><br />
            <select value={defaultUom ?? ""} onChange={(e) => setDefaultUom(toNum(e.target.value))}>
              <option value="">— не задано —</option>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <small>активна</small>
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">Категория «{name || "…"}» → ЕИ по умолчанию: {uomCode(defaultUom)}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/item-categories")}>Отмена</button>
          <button className="btn primary" onClick={save}>Сохранить</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={remove}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
