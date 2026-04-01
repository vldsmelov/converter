import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiUomEditPage() {
  const { id } = useParams();
  const uomId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<any[]>([]);
  const [uom, setUom] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [factor, setFactor] = useState("1");
  const [precision, setPrecision] = useState(3);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [c, u] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/${uomId}/`, token }),
      ]);
      setCats(c ?? []);
      setUom(u);
      setCode(u.code ?? "");
      setName(u.name ?? "");
      setCategory(u.category ?? null);
      setFactor(String(u.factor_to_base ?? "1"));
      setPrecision(Number(u.precision ?? 3));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, uomId]);

  const catCode = useMemo(() => {
    const m = new Map<number, string>(cats.map((c: any) => [c.id, c.code]));
    return (id: number | null) => (id ? (m.get(id) ?? String(id)) : "—");
  }, [cats]);

  const example = useMemo(() => {
    return `1 ${code.toUpperCase()} = ${factor} (в базовых единицах категории ${catCode(category)})`;
  }, [code, factor, category, catCode]);

  async function save() {
    if (!token) return;
    if (!category) { setErr("Выберите категорию ЕИ."); return; }
    setErr(null);
    try {
      await requestJson({
        method: "PUT",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/${uomId}/`,
        token,
        body: { id: uomId, code: code.toUpperCase(), name, category, factor_to_base: factor, precision },
      });
      nav("/nsi/uoms");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function remove() {
    if (!token) return;
    if (!confirm("Удалить ЕИ?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/${uomId}/`,
        token,
      });
      nav("/nsi/uoms");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title={`Редактирование ЕИ #${uomId}`}
        subtitle="Изменения влияют на глобальные конвертации внутри категории."
        right={<button className="btn" onClick={() => nav("/nsi/uoms")}>← Назад</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!uom ? <div style={{ padding: 8 }}>Загрузка…</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label>
            <small>Код</small><br />
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            <small>Название</small><br />
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <small>Категория</small><br />
            <select value={category ?? ""} onChange={(e) => setCategory(toNum(e.target.value))}>
              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </label>
          <label>
            <small>Коэффициент к базовой</small><br />
            <input value={factor} onChange={(e) => setFactor(e.target.value)} />
          </label>
          <label>
            <small>Точность</small><br />
            <input type="number" value={precision} onChange={(e) => setPrecision(toNum(e.target.value))} />
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">{example}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/uoms")}>Отмена</button>
          <button className="btn primary" onClick={save}>Сохранить</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={remove}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
