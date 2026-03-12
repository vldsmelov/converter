import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

type Scope = "global" | "category" | "item";
type ItemRuleType = "density" | "kg_per_m" | "pcs_weight";

type Uom = any;
type UomCat = any;
type Item = any;
type ItemCat = any;

type CategoryRuleMeta = {
  supplier_code: string;
  barcode: string;
  effective_from: string | null;
  effective_to: string | null;
};

type ItemRuleMeta = {
  conditions: Record<string, unknown>;
  priority: number;
  effective_from: string | null;
  effective_to: string | null;
  supersedes: number | null;
};

function n(s: unknown): number {
  const v = Number(String(s ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function fmt(x: number, digits = 6) {
  return Number.isFinite(x) ? String(Number(x.toFixed(digits))) : "-";
}

function up(s: unknown) {
  return String(s ?? "").toUpperCase();
}

function resolveScope(s: unknown): Scope {
  if (s === "global" || s === "category" || s === "item") return s;
  return "global";
}

function parseItemRuleType(s: unknown): ItemRuleType | null {
  if (s === "density" || s === "kg_per_m" || s === "pcs_weight") return s;
  return null;
}

function pickUomForCategory(uoms: any[], uomCatsById: Map<number, any>, categoryId: number | null | undefined): number | null {
  if (!categoryId) return null;
  const inCategory = uoms.filter((u: any) => u.category === categoryId);
  if (!inCategory.length) return null;

  const catCode = up(uomCatsById.get(categoryId)?.code);
  const preferredCode =
    catCode === "COUNT"
      ? "PCS"
      : catCode === "MASS"
        ? "KG"
        : catCode === "LENGTH"
          ? "M"
          : catCode === "VOLUME"
            ? "L"
            : "";

  if (preferredCode) {
    const preferred = inCategory.find((u: any) => up(u.code) === preferredCode);
    if (preferred) return preferred.id;
  }

  return inCategory[0].id;
}

function ruleTypeFitsPair(ruleType: ItemRuleType, fromCatCode: string, toCatCode: string): boolean {
  const pair = new Set([fromCatCode, toCatCode]);
  if (ruleType === "pcs_weight") return pair.has("COUNT") && pair.has("MASS");
  if (ruleType === "kg_per_m") return pair.has("LENGTH") && pair.has("MASS");
  return pair.has("MASS") && pair.has("VOLUME");
}

function inferRuleTypeByPair(fromCatCode: string, toCatCode: string): ItemRuleType | null {
  if (ruleTypeFitsPair("pcs_weight", fromCatCode, toCatCode)) return "pcs_weight";
  if (ruleTypeFitsPair("kg_per_m", fromCatCode, toCatCode)) return "kg_per_m";
  if (ruleTypeFitsPair("density", fromCatCode, toCatCode)) return "density";
  return null;
}

function ruleParamKey(ruleType: ItemRuleType): string {
  if (ruleType === "density") return "density_kg_per_l";
  if (ruleType === "kg_per_m") return "kg_per_m";
  return "kg_per_pc";
}

function ruleHint(ruleType: ItemRuleType): string {
  if (ruleType === "density") return "Ограничение: MASS <-> VOLUME.";
  if (ruleType === "kg_per_m") return "Ограничение: LENGTH <-> MASS.";
  return "Ограничение: COUNT <-> MASS (для COUNT используйте PCS).";
}

function defaultItemPreset(ruleType: ItemRuleType, uoms: any[]): { fromId: number | null; toId: number | null; coef: string } {
  const byCode = (code: string) => uoms.find((x: any) => up(x.code) === code)?.id ?? null;

  if (ruleType === "kg_per_m") {
    return { fromId: byCode("M"), toId: byCode("KG"), coef: "1" };
  }

  if (ruleType === "density") {
    return { fromId: byCode("L"), toId: byCode("KG"), coef: "1" };
  }

  return { fromId: byCode("KG"), toId: byCode("PCS"), coef: "0.023" };
}

export default function NsiRulesWizardPage() {
  const { token } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { scope: scopeParam, id: idParam } = useParams<{ scope?: string; id?: string }>();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scopeFromQuery = resolveScope(qs.get("scope"));
  const preFrom = qs.get("from");
  const preTo = qs.get("to");
  const preRuleType = parseItemRuleType(qs.get("rule_type"));
  const preCatId = qs.get("category_id");
  const preItemId = qs.get("item_id");

  const isEditMode = idParam !== undefined;
  const parsedId = idParam ? Number(idParam) : NaN;
  const editId = Number.isFinite(parsedId) ? parsedId : null;
  const editScope = resolveScope(scopeParam);

  const [scope, setScope] = useState<Scope>(() => (isEditMode ? editScope : scopeFromQuery));

  const [uoms, setUoms] = useState<Uom[]>([]);
  const [uomCats, setUomCats] = useState<UomCat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemCats, setItemCats] = useState<ItemCat[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [fromUomId, setFromUomId] = useState<number | null>(null);
  const [toUomId, setToUomId] = useState<number | null>(null);
  const [coef, setCoef] = useState("1");

  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [categoryId, setCategoryId] = useState<number | null>(preCatId ? Number(preCatId) : null);
  const [itemId, setItemId] = useState<number | null>(preItemId ? Number(preItemId) : null);
  const [itemRuleType, setItemRuleType] = useState<ItemRuleType>(preRuleType ?? "pcs_weight");

  const [categoryRuleMeta, setCategoryRuleMeta] = useState<CategoryRuleMeta>({
    supplier_code: "",
    barcode: "",
    effective_from: null,
    effective_to: null,
  });
  const [itemRuleMeta, setItemRuleMeta] = useState<ItemRuleMeta>({
    conditions: {},
    priority: 0,
    effective_from: null,
    effective_to: null,
    supersedes: null,
  });

  const [exampleInQty, setExampleInQty] = useState("1");

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);
  const itemCatById = useMemo(() => new Map<number, any>(itemCats.map((c: any) => [c.id, c])), [itemCats]);

  const fromUom = fromUomId ? uomById.get(fromUomId) : null;
  const toUom = toUomId ? uomById.get(toUomId) : null;

  const fromCatCode = fromUom ? (uomCatsById.get(fromUom.category)?.code ?? "-") : "-";
  const toCatCode = toUom ? (uomCatsById.get(toUom.category)?.code ?? "-") : "-";

  useEffect(() => {
    if (scope !== "item") return;
    const inferred = inferRuleTypeByPair(fromCatCode, toCatCode);
    if (!inferred) return;
    if (!isEditMode && !preRuleType) {
      setItemRuleType(inferred);
    }
  }, [scope, fromCatCode, toCatCode, isEditMode, preRuleType]);

  const exampleText = useMemo(() => {
    if (scope === "global") return "Пример товара: любой товар";
    if (scope === "category") return `Пример товара: любой товар из категории "${itemCatById.get(categoryId ?? -1)?.name ?? "-"}"`;
    const it = itemById.get(itemId ?? -1);
    return `Пример товара: ${it?.name ?? "-"}`;
  }, [scope, categoryId, itemId, itemById, itemCatById]);

  const exampleOutQty = useMemo(() => {
    const inQ = n(exampleInQty);
    const k = n(coef);
    if (k <= 0) return "-";

    if (scope === "item") {
      if (itemRuleType === "pcs_weight") {
        if (fromCatCode === "COUNT" && toCatCode === "MASS") return fmt(inQ * k, 6);
        if (fromCatCode === "MASS" && toCatCode === "COUNT") return fmt(inQ / k, 6);
        return "-";
      }

      if (itemRuleType === "kg_per_m") {
        if (fromCatCode === "LENGTH" && toCatCode === "MASS") return fmt(inQ * k, 6);
        if (fromCatCode === "MASS" && toCatCode === "LENGTH") return fmt(inQ / k, 6);
        return "-";
      }

      if (fromCatCode === "VOLUME" && toCatCode === "MASS") return fmt(inQ * k, 6);
      if (fromCatCode === "MASS" && toCatCode === "VOLUME") return fmt(inQ / k, 6);
      return "-";
    }

    return fmt(inQ * k, 6);
  }, [exampleInQty, coef, scope, fromCatCode, toCatCode, itemRuleType]);

  const validations = useMemo(() => {
    const v: string[] = [];
    if (!fromUom || !toUom) v.push("Выберите входящую и итоговую ЕИ.");
    if (n(coef) <= 0) v.push("Параметр коэффициента должен быть > 0.");

    if (scope === "global") {
      if (fromUom && toUom && fromUom.category !== toUom.category) {
        v.push("Глобальные правила возможны только внутри одной категории ЕИ.");
      }
    }

    if (scope === "category") {
      if (!categoryId) v.push("Выберите категорию номенклатуры.");
      if (fromUom && fromCatCode !== "COUNT") v.push("Для правила категории входящая ЕИ должна быть из COUNT.");
      if (toUom && toCatCode !== "MASS") v.push("Для правила категории итоговая ЕИ должна быть из MASS.");
    }

    if (scope === "item") {
      if (!itemId) v.push("Выберите номенклатурную позицию.");
      if (!ruleTypeFitsPair(itemRuleType, fromCatCode, toCatCode)) {
        v.push(`Выбранный тип правила не подходит для пары категорий (${fromCatCode} -> ${toCatCode}).`);
      }

      if (itemRuleType === "pcs_weight") {
        if (fromCatCode === "COUNT" && up(fromUom?.code) !== "PCS") v.push("Для COUNT используйте ЕИ PCS.");
        if (toCatCode === "COUNT" && up(toUom?.code) !== "PCS") v.push("Для COUNT используйте ЕИ PCS.");
      }
    }

    return v;
  }, [scope, fromUom, toUom, coef, categoryId, itemId, fromCatCode, toCatCode, itemRuleType]);

  const canSave = validations.length === 0 && (!isEditMode || !!editId);

  useEffect(() => {
    if (isEditMode) setScope(editScope);
  }, [isEditMode, editScope]);

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

      const nextUoms = u ?? [];
      const nextUomCats = uc ?? [];
      const nextItems = it ?? [];
      const nextItemCats = ic ?? [];
      const nextUomCatsById = new Map<number, any>(nextUomCats.map((c: any) => [c.id, c]));

      setUoms(nextUoms);
      setUomCats(nextUomCats);
      setItems(nextItems);
      setItemCats(nextItemCats);

      if (isEditMode) {
        if (!editId) {
          throw new Error("Некорректный идентификатор правила.");
        }

        if (editScope === "global") {
          const r = await requestJson<any>({
            method: "GET",
            url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/${editId}/`,
            token,
          });
          setFromUomId(r.from_uom ?? null);
          setToUomId(r.to_uom ?? null);
          setCoef(String(r.multiplier ?? "1"));
          setStatus((r.status ?? "active") as any);
        } else if (editScope === "category") {
          const r = await requestJson<any>({
            method: "GET",
            url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/${editId}/`,
            token,
          });
          setCategoryId(r.category ?? null);
          setFromUomId(r.package_uom ?? null);
          setToUomId(r.content_uom ?? null);
          setCoef(String(r.content_qty ?? "1"));
          setStatus((r.status ?? "active") as any);
          setCategoryRuleMeta({
            supplier_code: String(r.supplier_code ?? ""),
            barcode: String(r.barcode ?? ""),
            effective_from: r.effective_from ? String(r.effective_from) : null,
            effective_to: r.effective_to ? String(r.effective_to) : null,
          });
        } else {
          const r = await requestJson<any>({
            method: "GET",
            url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/${editId}/`,
            token,
          });

          const loadedType = parseItemRuleType(r.rule_type) ?? "pcs_weight";
          const paramKey = ruleParamKey(loadedType);

          setItemId(r.item ?? null);
          setItemRuleType(loadedType);
          setCoef(String(r.params?.[paramKey] ?? "1"));
          setStatus((r.status ?? "active") as any);
          setItemRuleMeta({
            conditions: (r.conditions && typeof r.conditions === "object" && !Array.isArray(r.conditions)) ? r.conditions : {},
            priority: Number(r.priority ?? 0),
            effective_from: r.effective_from ? String(r.effective_from) : null,
            effective_to: r.effective_to ? String(r.effective_to) : null,
            supersedes: r.supersedes ? Number(r.supersedes) : null,
          });

          const guessedFromUomId = pickUomForCategory(nextUoms, nextUomCatsById, r.from_category);
          const guessedToUomId = pickUomForCategory(nextUoms, nextUomCatsById, r.to_category);
          setFromUomId(guessedFromUomId);
          setToUomId(guessedToUomId);
        }
        return;
      }

      if (preFrom && fromUomId === null) {
        const fu = nextUoms.find((x: any) => up(x.code) === up(preFrom));
        if (fu) setFromUomId(fu.id);
      }

      if (preTo && toUomId === null) {
        const tu = nextUoms.find((x: any) => up(x.code) === up(preTo));
        if (tu) setToUomId(tu.id);
      }

      const cm = nextUoms.find((x: any) => x.code === "CM");
      const m = nextUoms.find((x: any) => x.code === "M");
      const bag = nextUoms.find((x: any) => x.code === "BAG");
      const kg = nextUoms.find((x: any) => x.code === "KG");

      if (!fromUomId || !toUomId) {
        if (scope === "global" && cm && m) {
          setFromUomId(cm.id);
          setToUomId(m.id);
          setCoef("0.01");
        }

        if (scope === "category" && bag && kg) {
          setFromUomId(bag.id);
          setToUomId(kg.id);
          setCoef("50");
        }

        if (scope === "item") {
          const preset = defaultItemPreset(preRuleType ?? itemRuleType, nextUoms);
          if (preset.fromId) setFromUomId(preset.fromId);
          if (preset.toId) setToUomId(preset.toId);
          setCoef(preset.coef);
        }
      }

      if (!categoryId && nextItemCats.length) setCategoryId(nextItemCats[0].id);
      if (!itemId && nextItems.length) setItemId(nextItems[0].id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token, isEditMode, editId, editScope, location.search]);

  const coefLabel = useMemo(() => {
    if (scope === "global") return "Коэффициент (multiplier)";
    if (scope === "category") return "Коэффициент (сколько итоговой ЕИ в 1 входящей)";
    if (itemRuleType === "density") return "Плотность (density_kg_per_l, кг/л)";
    if (itemRuleType === "kg_per_m") return "Линейная масса (kg_per_m, кг/м)";
    return "Вес 1 PCS (kg_per_pc, кг)";
  }, [scope, itemRuleType]);

  async function saveRule() {
    if (!token) return;
    if (!canSave) return;

    if (isEditMode && !editId) {
      setErr("Некорректный идентификатор правила.");
      return;
    }

    setErr(null);

    try {
      if (scope === "global") {
        await requestJson({
          method: isEditMode ? "PUT" : "POST",
          url: isEditMode
            ? `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/${editId}/`
            : `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/`,
          token,
          body: { from_uom: fromUomId, to_uom: toUomId, multiplier: coef, status },
        });
      } else if (scope === "category") {
        await requestJson({
          method: isEditMode ? "PUT" : "POST",
          url: isEditMode
            ? `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/${editId}/`
            : `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/`,
          token,
          body: {
            category: categoryId,
            package_uom: fromUomId,
            content_uom: toUomId,
            content_qty: coef,
            status,
            supplier_code: categoryRuleMeta.supplier_code ?? "",
            barcode: categoryRuleMeta.barcode ?? "",
            effective_from: categoryRuleMeta.effective_from ?? null,
            effective_to: categoryRuleMeta.effective_to ?? null,
          },
        });
      } else {
        const params: Record<string, string> = {
          [ruleParamKey(itemRuleType)]: String(n(coef)),
        };

        await requestJson({
          method: isEditMode ? "PUT" : "POST",
          url: isEditMode
            ? `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/${editId}/`
            : `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/`,
          token,
          body: {
            item: itemId,
            from_category: fromUom?.category,
            to_category: toUom?.category,
            rule_type: itemRuleType,
            conditions: itemRuleMeta.conditions ?? {},
            params,
            priority: itemRuleMeta.priority ?? 0,
            status,
            effective_from: itemRuleMeta.effective_from ?? null,
            effective_to: itemRuleMeta.effective_to ?? null,
            supersedes: itemRuleMeta.supersedes ?? null,
          },
        });
      }

      nav("/nsi/rules");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const pageTitle = isEditMode ? "Редактирование правила" : "Создание правила";
  const pageSubtitle = isEditMode
    ? "Измените параметры и сохраните правило."
    : "Создайте правило перевода между ЕИ. Для межкатегорийного перевода выбирайте тип правила в блоке параметров.";
  const submitLabel = isEditMode ? "Сохранить" : "Создать правило";

  return (
    <div className="card">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        right={<button className="btn" onClick={() => nav("/nsi/rules")}>Отмена</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Тип правила</h4>
        <div className="row">
          <label>
            <small>Какое правило создаем?</small><br />
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} disabled={isEditMode}>
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
            <>
              <label style={{ flex: 1 }}>
                <small>Номенклатура</small><br />
                <select value={itemId ?? ""} onChange={(e) => setItemId(toNum(e.target.value))} style={{ width: "100%" }}>
                  {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </label>

              <label>
                <small>Тип конвертации</small><br />
                <select value={itemRuleType} onChange={(e) => setItemRuleType(e.target.value as ItemRuleType)}>
                  <option value="pcs_weight">COUNT ↔ MASS (pcs_weight)</option>
                  <option value="kg_per_m">LENGTH ↔ MASS (kg_per_m)</option>
                  <option value="density">MASS ↔ VOLUME (density)</option>
                </select>
              </label>
            </>
          )}
        </div>

        {isEditMode && <div style={{ marginTop: 8 }}><small>Тип области фиксирован в режиме редактирования.</small></div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Параметры правила</h4>

        <div className="row">
          <label>
            <small>входящая ЕИ</small><br />
            <select value={fromUomId ?? ""} onChange={(e) => setFromUomId(toNum(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code} ({uomCatsById.get(u.category)?.code ?? "-"})</option>)}
            </select>
          </label>

          <label>
            <small>итоговая ЕИ</small><br />
            <select value={toUomId ?? ""} onChange={(e) => setToUomId(toNum(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code} ({uomCatsById.get(u.category)?.code ?? "-"})</option>)}
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
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          {scope === "global" && <small>Ограничение: обе ЕИ должны быть в <b>одной категории</b>. Сейчас: {fromCatCode} {"->"} {toCatCode}</small>}
          {scope === "category" && <small>Ограничение: COUNT {"->"} MASS (пример: BAG {"->"} KG). Сейчас: {fromCatCode} {"->"} {toCatCode}</small>}
          {scope === "item" && <small>{ruleHint(itemRuleType)} Сейчас: {fromCatCode} {"->"} {toCatCode}</small>}
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
                  <span className="badge">{fromUom?.code ?? "-"}</span>
                </div>
              </td>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <input value={exampleOutQty} readOnly style={{ width: 120 }} />
                  <span className="badge">{toUom?.code ?? "-"}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {scope === "item" ? (
          <div style={{ marginTop: 8 }}>
            <small>
              Параметр для типа правила: <b>{ruleParamKey(itemRuleType)}</b>. Пример рассчитывается из выбранных ЕИ и коэффициента.
            </small>
          </div>
        ) : null}

        {validations.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {validations.map((v, idx) => (
              <div key={idx} style={{ color: "#fca5a5" }}>* {v}</div>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/rules")}>Отмена</button>
          <button className="btn primary" onClick={saveRule} disabled={!canSave}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
