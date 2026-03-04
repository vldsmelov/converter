import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { jsonErr, toNum } from "./nsi_utils";
import { requestJson } from "../api/request";

export default function NsiRulesPage() {
  const { nsi } = useApi();
  const { token } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [itemId, setItemId] = useState<number | null>(null);
  const [fromCat, setFromCat] = useState<number | null>(null);
  const [toCat, setToCat] = useState<number | null>(null);
  const [kgPerPc, setKgPerPc] = useState("2.5");

  async function load() {
    setErr(null);

    const it = await nsi.GET("/api/v1/items/");
    if (it.error) { setErr("Товары: " + jsonErr(it.error)); return; }
    const iarr = (it.data as any) ?? [];
    setItems(iarr);
    const demo = iarr.find((x: any) => (x.sku ?? "").includes("DEMO")) ?? iarr[0];
    if (demo && itemId === null) setItemId(demo.id);

    const c = await nsi.GET("/api/v1/uom-categories/");
    if (c.error) { setErr("Категории: " + jsonErr(c.error)); return; }
    const carr = (c.data as any) ?? [];
    setCats(carr);
    const count = carr.find((x: any) => x.code === "COUNT") ?? carr[0];
    const mass = carr.find((x: any) => x.code === "MASS") ?? carr[0];
    if (count && fromCat === null) setFromCat(count.id);
    if (mass && toCat === null) setToCat(mass.id);

    const r = await nsi.GET("/api/v1/rules/");
    if (r.error) { setErr("Правила: " + jsonErr(r.error)); return; }
    setRules((r.data as any) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const itemSku = useMemo(() => {
    const m = new Map(items.map((i: any) => [i.id, i.sku]));
    return (id: number) => m.get(id) ?? id;
  }, [items]);

  const catCode = useMemo(() => {
    const m = new Map(cats.map((c: any) => [c.id, c.code]));
    return (id: number) => m.get(id) ?? id;
  }, [cats]);

  async function create() {
    if (!token) { setErr("Нет токена авторизации."); return; }
    if (!itemId || !fromCat || !toCat) return;
    setErr(null);

    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/`,
        token,
        body: {
          item: itemId,
          from_category: fromCat,
          to_category: toCat,
          rule_type: "pcs_weight",
          conditions: {},
          params: { kg_per_pc: kgPerPc },
          priority: 0,
          status: "active",
        },
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>НСИ: Правила конвертации</h3>
        <button className="btn" onClick={load}>Обновить</button>
      </div>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="row" style={{ marginTop: 8 }}>
        <label><small>Товар</small><br />
          <select value={itemId ?? ""} onChange={(e) => setItemId(toNum(e.target.value))}>
            {items.map((i: any) => <option key={i.id} value={i.id}>{i.sku}</option>)}
          </select>
        </label>
        <label><small>Из категории</small><br />
          <select value={fromCat ?? ""} onChange={(e) => setFromCat(toNum(e.target.value))}>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </label>
        <label><small>В категорию</small><br />
          <select value={toCat ?? ""} onChange={(e) => setToCat(toNum(e.target.value))}>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </label>
        <label><small>кг за штуку</small><br />
          <input value={kgPerPc} onChange={(e) => setKgPerPc(e.target.value)} />
        </label>
        <button className="btn primary" onClick={create}>Добавить</button>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th><th>Товар</th><th>Из</th><th>В</th><th>Тип</th><th>Статус</th><th>Параметры</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r: any) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{itemSku(r.item)}</td>
              <td>{catCode(r.from_category)}</td>
              <td>{catCode(r.to_category)}</td>
              <td>{r.rule_type}</td>
              <td>{r.status}</td>
              <td><small>{JSON.stringify(r.params)}</small></td>
            </tr>
          ))}
          {rules.length === 0 && <tr><td colSpan={7}><small>Пока нет правил.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
