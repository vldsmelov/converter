import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiItemCategoryCreatePage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("Трубы");
  const [defaultUom, setDefaultUom] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const u = await requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token });
      setUoms(u ?? []);
      const m = (u ?? []).find((x: any) => x.code === "M") ?? (u ?? [])[0];
      if (m && defaultUom === null) setDefaultUom(m.id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function create() {
    if (!token) return;
    setErr(null);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`,
        token,
        body: { name, default_uom: defaultUom, is_active: isActive },
      });
      nav("/nsi/item-categories");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="Создание категории"
        subtitle="ЕИ по умолчанию — подсказка для новых позиций номенклатуры. В самой позиции единицу хранения можно выбрать другую."
        right={<button className="btn" onClick={() => nav("/nsi/item-categories")}>Отмена</button>}
      />
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1 }}>
            <small>Название категории</small><br />
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
          <button className="btn primary" onClick={create}>Создать</button>
        </div>
      </div>
    </div>
  );
}
