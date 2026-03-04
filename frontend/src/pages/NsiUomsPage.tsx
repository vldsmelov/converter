import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { jsonErr, toNum } from "./nsi_utils";
import { requestJson } from "../api/request";

export default function NsiUomsPage() {
  const { nsi } = useApi();
  const { token } = useAuth();
  const [uoms, setUoms] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState("BOX");
  const [name, setName] = useState("Коробка");
  const [category, setCategory] = useState<number | null>(null);
  const [factor, setFactor] = useState("1");
  const [precision, setPrecision] = useState(0);

  async function load() {
    setErr(null);

    const c = await nsi.GET("/api/v1/uom-categories/");
    if (c.error) { setErr("Категории: " + jsonErr(c.error)); return; }
    const carr = (c.data as any) ?? [];
    setCats(carr);
    const defaultCat = carr.find((x: any) => x.code === "COUNT") ?? carr[0];
    if (defaultCat && category === null) setCategory(defaultCat.id);

    const r = await nsi.GET("/api/v1/uoms/");
    if (r.error) { setErr("Единицы: " + jsonErr(r.error)); return; }
    setUoms((r.data as any) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const catName = useMemo(() => {
    const m = new Map(cats.map((c: any) => [c.id, c.code]));
    return (id: number) => m.get(id) ?? id;
  }, [cats]);

  async function create() {
    if (!token) { setErr("Нет токена авторизации."); return; }
    if (!category) return;
    setErr(null);

    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`,
        token,
        body: { code, name, category, factor_to_base: factor, precision },
      });
      setCode("");
      setName("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>НСИ: Единицы измерения</h3>
        <button className="btn" onClick={load}>Обновить</button>
      </div>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="row" style={{ marginTop: 8 }}>
        <label><small>Код</small><br />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <label><small>Название</small><br />
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label><small>Категория</small><br />
          <select value={category ?? ""} onChange={(e) => setCategory(toNum(e.target.value))}>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </label>
        <label><small>Коэф. к базовой</small><br />
          <input value={factor} onChange={(e) => setFactor(e.target.value)} />
        </label>
        <label><small>Точность</small><br />
          <input type="number" value={precision} onChange={(e) => setPrecision(toNum(e.target.value))} />
        </label>
        <button className="btn primary" onClick={create}>Добавить</button>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th><th>Код</th><th>Название</th><th>Категория</th><th>Коэф.</th><th>Точность</th>
          </tr>
        </thead>
        <tbody>
          {uoms.map((u: any) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.code}</td>
              <td>{u.name}</td>
              <td>{catName(u.category)}</td>
              <td><small>{u.factor_to_base}</small></td>
              <td>{u.precision}</td>
            </tr>
          ))}
          {uoms.length === 0 && <tr><td colSpan={6}><small>Пока нет единиц.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
