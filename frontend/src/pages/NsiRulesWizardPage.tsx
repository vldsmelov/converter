import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

type Scope = "global" | "category" | "item";

type Uom = any;
type UomCat = any;
type Item = any;
type ItemCat = any;

function n(s: unknown): number {
  const v = Number(String(s ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function fmt(x: number, digits = 6) {
  return Number.isFinite(x) ? String(Number(x.toFixed(digits))) : "—";
}

function up(s: any) {
  return String(s ?? "").toUpperCase();
}

export default function NsiRulesWizardPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const preScope = (qs.get("scope") as Scope) || "global";
  const preFrom = qs.get("from"); // uom code
  const preTo = qs.get("to");     // uom code
  const preCatId = qs.get("category_id");
  const preItemId = qs.get("item_id");

  const [scope, setScope] = useState<Scope>(preScope);

  const [uoms, setUoms] = useState<Uom[]>([]);
  const [uomCats, setUomCats] = useState<UomCat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemCats, setItemCats] = useState<ItemCat[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [fromUomId, setFromUomId] = useState<number | null>(null);
  const [toUomId, setToUomId] = useState<number | null>(null);

  // "coef" meaning depends on scope:
  // - global: multiplier
  // - category: content_qty (e.g. 1 BAG = 50 KG)
  // - item: kg_per_pc (weight of 1 PCS in KG)
  const [coef, setCoef] = useState("1");

  const [status, setStatus] = useState<"active" | "draft">("active");
  const [categoryId, setCategoryId] = useState<number | null>(preCatId ? Number(preCatId) : null);
  const [itemId, setItemId] = useState<number | null>(preItemId ? Number(preItemId) : null);

  const [exampleInQty, setExampleInQty] = useState("1");

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);
  const itemCatById = useMemo(() => new Map<number, any>(itemCats.map((c: any) => [c.id, c])), [itemCats]);

  const fromUom = fromUomId ? uomById.get(fromUomId) : null;
  const toUom = toUomId ? uomById.get(toUomId) : null;

  const fromCatCode = fromUom ? (uomCatsById.get(fromUom.category)?.code ?? "—") : "—";
  const toCatCode = toUom ? (uomCatsById.get(toUom.category)?.code ?? "—") : "—";

  const exampleText = useMemo(() => {
    if (scope === "global") return "Пример товара: любой товар";
    if (scope === "category") return `Пример товара: любой товар из категории «${itemCatById.get(categoryId ?? -1)?.name ?? "—"}»`;
    const it = itemById.get(itemId ?? -1);
    return `Пример товара: ${it?.name ?? "—"}`;
  }, [scope, categoryId, itemId, itemById, itemCatById]);

  const exampleOutQty = useMemo(() => {
    const inQ = n(exampleInQty);
    const k = n(coef);

    if (scope === "item") {
      // coef = kg_per_pc
      if (k <= 0) return "—";
      // COUNT->MASS: kg = pcs * kg_per_pc ; MASS->COUNT: pcs = kg / kg_per_pc
      if (fromCatCode === "COUNT" && toCatCode === "MASS") return fmt(inQ * k, 6);
      if (fromCatCode === "MASS" && toCatCode === "COUNT") return fmt(inQ / k, 6);
      return "—";
    }

    // global/category: multiplier
    if (k <= 0) return "—";
    return fmt(inQ * k, 6);
  }, [exampleInQty, coef, scope, fromCatCode, toCatCode]);

  const validations = useMemo(() => {
    const v: string[] = [];
    if (!fromUom || !toUom) v.push("Выберите входящую и итоговую ЕИ.");
    if (n(coef) <= 0) v.push(scope === "item" ? "Вес 1 PCS (kg_per_pc) должен быть > 0." : "Коэффициент должен быть > 0.");

    if (scope === "global") {
      if (fromUom && toUom && fromUom.category !== toUom.category) {
        v.push("Глобальные правила возможны только внутри одной категории ЕИ (например CM→M, KG→TON).");
      }
    }

    if (scope === "category") {
      if (!categoryId) v.push("Выберите категорию номенклатуры.");
      if (fromUom && fromCatCode !== "COUNT") v.push("Для правила категории входящая ЕИ должна быть из COUNT (например BAG).");
      if (toUom && toCatCode !== "MASS") v.push("Для правила категории итоговая ЕИ должна быть из MASS (например KG).");
    }

    if (scope === "item") {
      if (!itemId) v.push("Выберите номенклатурную позицию.");

      // Allow BOTH directions: MASS<->COUNT (example: KG -> PCS or PCS -> KG)
      const okPair = new Set([fromCatCode, toCatCode]);
      if (!(okPair.has("COUNT") && okPair.has("MASS"))) {
        v.push("Для правила номенклатуры нужен перевод между COUNT и MASS (например KG→PCS или PCS→KG).");
      }

      // To avoid weird COUNT units, require PCS on the COUNT side
      if (fromCatCode === "COUNT" && up(fromUom?.code) !== "PCS") v.push("Для правила номенклатуры COUNT-единица должна быть PCS.");
      if (toCatCode === "COUNT" && up(toUom?.code) !== "PCS") v.push("Для правила номенклатуры COUNT-единица должна быть PCS.");
    }

    return v;
  }, [scope, fromUom, toUom, coef, categoryId, itemId, fromCatCode, toCatCode]);

  const canCreate = validations.length === 0;

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [u, uc, it, ic] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
      ]);

      setUoms(u ?? []);
      setUomCats(uc ?? []);
      setItems(it ?? []);
      setItemCats(ic ?? []);

      // Prefill UoMs by code if provided
      if (preFrom && fromUomId === null) {
        const fu = (u ?? []).find((x: any) => up(x.code) === up(preFrom));
        if (fu) setFromUomId(fu.id);
      }
      if (preTo && toUomId === null) {
        const tu = (u ?? []).find((x: any) => up(x.code) === up(preTo));
        if (tu) setToUomId(tu.id);
      }

      // Defaults if still empty
      const cm = (u ?? []).find((x: any) => x.code === "CM");
      const m = (u ?? []).find((x: any) => x.code === "M");
      const bag = (u ?? []).find((x: any) => x.code === "BAG");
      const kg = (u ?? []).find((x: any) => x.code === "KG");
      const pcs = (u ?? []).find((x: any) => x.code === "PCS");

      if (!fromUomId || !toUomId) {
        if (scope === "global" && cm && m) { setFromUomId(cm.id); setToUomId(m.id); setCoef("0.01"); }
        if (scope === "category" && bag && kg) { setFromUomId(bag.id); setToUomId(kg.id); setCoef("50"); }
        if (scope === "item" && kg && pcs) { setFromUomId(kg.id); setToUomId(pcs.id); setCoef("0.023"); }
      }

      if (!categoryId && (ic ?? []).length) setCategoryId((ic ?? [])[0].id);
      if (!itemId && (it ?? []).length) setItemId((it ?? [])[0].id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  // Adjust coef label per scope
  const coefLabel = useMemo(() => {
    if (scope === "global") return "Коэффициент (multiplier)";
    if (scope === "category") return "Коэффициент (сколько итоговой ЕИ в 1 входящей)";
    return "Вес 1 PCS (kg_per_pc, в KG)";
  }, [scope]);

  async function createRule() {
    if (!token) return;
    if (!canCreate) return;

    setErr(null);

    try {
      if (scope === "global") {
        await requestJson({
          method: "POST",
          url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/`,
          token,
          body: { from_uom: fromUomId, to_uom: toUomId, multiplier: coef, status },
        });
      } else if (scope === "category") {
        await requestJson({
          method: "POST",
          url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/`,
          token,
          body: {
            category: categoryId,
            package_uom: fromUomId,
            content_uom: toUomId,
            content_qty: coef,
            status,
            supplier_code: "",
            barcode: "",
            effective_from: null,
            effective_to: null,
          },
        });
      } else if (scope === "item") {
        // We always store pcs_weight param as kg_per_pc.
        // Direction is derived automatically at runtime (COUNT->MASS or MASS->COUNT).
        // from_category/to_category may be any order as match is unordered.
        await requestJson({
          method: "POST",
          url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/`,
          token,
          body: {
            item: itemId,
            from_category: fromUom?.category,
            to_category: toUom?.category,
            rule_type: "pcs_weight",
            conditions: {},
            params: { kg_per_pc: String(n(coef)) },
            priority: 0,
            status,
          },
        });
      }

      nav("/nsi/rules");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="Создание правила"
        subtitle="Для болтов (оприходование PCS) можно создать правило KG → PCS, задав вес 1 PCS."
        right={<button className="btn" onClick={() => nav("/nsi/rules")}>Отмена</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Тип правила</h4>
        <div className="row">
          <label>
            <small>Какое правило создаём?</small><br />
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="global">Глобальное (для всех)</option>
              <option value="category">Для категории</option>
              <option value="item">Для номенклатурной позиции</option>
            </select>
          </label>

          {scope === "category" && (
            <label style={{ flex: 1 }}>
              <small>Категория</small><br />
              <select value={categoryId ?? ""} onChange={(e) => setCategoryId(toNum(e.target.value))} style={{ width: "100%" }}>
                {itemCats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          {scope === "item" && (
            <label style={{ flex: 1 }}>
              <small>Номенклатура</small><br />
              <select value={itemId ?? ""} onChange={(e) => setItemId(toNum(e.target.value))} style={{ width: "100%" }}>
                {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Параметры правила</h4>

        <div className="row">
          <label>
            <small>входящая ЕИ</small><br />
            <select value={fromUomId ?? ""} onChange={(e) => setFromUomId(toNum(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code} ({uomCatsById.get(u.category)?.code ?? "—"})</option>)}
            </select>
          </label>

          <label>
            <small>итоговая ЕИ</small><br />
            <select value={toUomId ?? ""} onChange={(e) => setToUomId(toNum(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code} ({uomCatsById.get(u.category)?.code ?? "—"})</option>)}
            </select>
          </label>

          <label>
            <small>{coefLabel}</small><br />
            <input value={coef} onChange={(e) => setCoef(e.target.value)} />
          </label>

          <label>
            <small>Статус</small><br />
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">active</option>
              <option value="draft">draft</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          {scope === "global" && <small>Ограничение: обе ЕИ должны быть в <b>одной категории</b>. Сейчас: {fromCatCode} → {toCatCode}</small>}
          {scope === "category" && <small>Ограничение: COUNT → MASS (пример: BAG → KG). Сейчас: {fromCatCode} → {toCatCode}</small>}
          {scope === "item" && <small>Ограничение: MASS ↔ COUNT (PCS). Сейчас: {fromCatCode} → {toCatCode}</small>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Пример перевода</h4>

        <table>
          <thead>
            <tr>
              <th>Пример товара</th>
              <th>входящая ЕИ</th>
              <th>исходящая ЕИ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{exampleText}</td>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <input value={exampleInQty} onChange={(e) => setExampleInQty(e.target.value)} style={{ width: 120 }} />
                  <span className="badge">{fromUom?.code ?? "—"}</span>
                </div>
              </td>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <input value={exampleOutQty} readOnly style={{ width: 120 }} />
                  <span className="badge">{toUom?.code ?? "—"}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {scope === "item" ? (
          <div style={{ marginTop: 8 }}>
            <small>
              Для болтов удобно задавать вес 1 PCS: например 0.023 (KG). Тогда:
              KG → PCS: pcs = kg / 0.023; PCS → KG: kg = pcs × 0.023.
            </small>
          </div>
        ) : null}

        {validations.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {validations.map((v, idx) => (
              <div key={idx} style={{ color: "#fca5a5" }}>• {v}</div>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/rules")}>Отмена</button>
          <button className="btn primary" onClick={createRule} disabled={!canCreate}>Создать правило</button>
        </div>
      </div>
    </div>
  );
}
