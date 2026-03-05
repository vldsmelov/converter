import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";

type Uom = any;
type Item = any;
type ItemCat = any;
type GlobalRule = any;
type CatPkg = any;
type Rule = any;

export default function NsiRulesPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [uoms, setUoms] = useState<Uom[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemCats, setItemCats] = useState<ItemCat[]>([]);

  const [globalRules, setGlobalRules] = useState<GlobalRule[]>([]);
  const [catPkgs, setCatPkgs] = useState<CatPkg[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  const [err, setErr] = useState<string | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  const itemCatById = useMemo(() => new Map<number, any>(itemCats.map((c: any) => [c.id, c])), [itemCats]);
  const itemCatName = (id: number | null | undefined) => (id ? (itemCatById.get(id)?.name ?? String(id)) : "—");

  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [u, it, ic, gr, cp, rl] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/`, token }).catch(() => []),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/`, token }).catch(() => []),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/`, token }),
      ]);

      setUoms(u ?? []);
      setItems(it ?? []);
      setItemCats(ic ?? []);
      setGlobalRules(gr ?? []);
      setCatPkgs(cp ?? []);
      setRules(rl ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const weightRules = useMemo(() => rules.filter((r: any) => r.rule_type === "pcs_weight"), [rules]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>НСИ: Правила</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={load}>Обновить</button>
          <button className="btn primary" onClick={() => nav("/nsi/rules/new")}>
            Создать новое правило
          </button>
        </div>
      </div>

      <p style={{ marginTop: 8 }}>
        Здесь отображаются <b>только созданные правила</b>. Добавление — через кнопку <b>«Создать новое правило»</b>.
      </p>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Глобальные правила (для всех)</h4>
        <table>
          <thead>
            <tr><th>ID</th><th>Из ЕИ</th><th>В ЕИ</th><th>Коэффициент</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {globalRules.map((r: any) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{uomCode(r.from_uom)}</td>
                <td>{uomCode(r.to_uom)}</td>
                <td>{r.multiplier}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {globalRules.length === 0 && <tr><td colSpan={5}><small>Пока нет глобальных правил.</small></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Правила для категории (упаковки)</h4>
        <table>
          <thead>
            <tr><th>ID</th><th>Категория</th><th>Правило</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {catPkgs.map((p: any) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{itemCatName(p.category)}</td>
                <td><span className="badge">1 {uomCode(p.package_uom)}</span> = <b>{p.content_qty}</b> {uomCode(p.content_uom)}</td>
                <td>{p.status}</td>
              </tr>
            ))}
            {catPkgs.length === 0 && <tr><td colSpan={4}><small>Пока нет правил для категорий.</small></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Правила для номенклатуры (вес штуки)</h4>
        <table>
          <thead>
            <tr><th>ID</th><th>Номенклатура</th><th>kg_per_pc</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {weightRules.map((r: any) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{itemById.get(r.item)?.name ?? r.item}</td>
                <td>{r.params?.kg_per_pc}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {weightRules.length === 0 && <tr><td colSpan={4}><small>Пока нет правил по номенклатуре.</small></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
