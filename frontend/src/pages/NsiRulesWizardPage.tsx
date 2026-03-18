import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, requestJson } from "../api/request";
import ItemLookup from "../components/ItemLookup";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

type Scope = "global" | "category" | "item";
type ItemRuleType = "density" | "kg_per_m" | "pcs_weight";

type Uom = any;
type UomCat = any;
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

type PairRuleSpec = {
  ruleType: ItemRuleType;
  paramKey: string;
  label: string;
  example: string;
};

type CompositeRuleStep = PairRuleSpec & {
  fromCategory: string;
  toCategory: string;
};

const CATEGORY_CODES = ["MASS", "VOLUME", "LENGTH", "COUNT"] as const;

const PAIR_RULE_SPECS: Record<string, PairRuleSpec> = {
  "COUNT|MASS": {
    ruleType: "pcs_weight",
    paramKey: "kg_per_pc",
    label: "Р’РµСЃ 1 PCS (kg_per_pc, РєРі)",
    example: "0.023",
  },
  "LENGTH|MASS": {
    ruleType: "kg_per_m",
    paramKey: "kg_per_m",
    label: "Р›РёРЅРµР№РЅР°СЏ РјР°СЃСЃР° (kg_per_m, РєРі/Рј)",
    example: "1",
  },
  "MASS|VOLUME": {
    ruleType: "density",
    paramKey: "density_kg_per_l",
    label: "РџР»РѕС‚РЅРѕСЃС‚СЊ (density_kg_per_l, РєРі/Р»)",
    example: "1",
  },
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

function pairKey(a: string, b: string): string {
  return [up(a), up(b)].sort().join("|");
}

function pairRuleSpec(a: string, b: string): PairRuleSpec | null {
  return PAIR_RULE_SPECS[pairKey(a, b)] ?? null;
}

function buildCategoryPath(startCatCode: string, targetCatCode: string): string[] {
  const start = up(startCatCode);
  const target = up(targetCatCode);

  if (!CATEGORY_CODES.includes(start as any) || !CATEGORY_CODES.includes(target as any)) return [];
  if (start === target) return [start];

  const queue: Array<{ cat: string; path: string[] }> = [{ cat: start, path: [start] }];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    if (cur.path.length > 4) continue;

    for (const next of CATEGORY_CODES) {
      const nextCat = String(next);
      if (cur.path.includes(nextCat)) continue;
      if (!pairRuleSpec(cur.cat, nextCat)) continue;

      const nextPath = [...cur.path, nextCat];
      if (nextCat === target) return nextPath;
      queue.push({ cat: nextCat, path: nextPath });
    }
  }

  return [];
}

function buildCompositeRuleSteps(fromCatCode: string, toCatCode: string): CompositeRuleStep[] {
  const path = buildCategoryPath(fromCatCode, toCatCode);
  if (path.length < 3) return [];

  const steps: CompositeRuleStep[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const fromCategory = path[i];
    const toCategory = path[i + 1];
    const spec = pairRuleSpec(fromCategory, toCategory);
    if (!spec) return [];
    steps.push({ fromCategory, toCategory, ...spec });
  }
  return steps;
}

function compositeStepId(step: CompositeRuleStep): string {
  return `${step.fromCategory}_${step.toCategory}_${step.ruleType}`;
}

function applyRuleStepByCategory(
  qty: number,
  fromCategory: string,
  toCategory: string,
  ruleType: ItemRuleType,
  k: number
): number | null {
  if (!Number.isFinite(qty) || !Number.isFinite(k) || k <= 0) return null;
  const from = up(fromCategory);
  const to = up(toCategory);

  if (ruleType === "density") {
    if (from === "VOLUME" && to === "MASS") return qty * k;
    if (from === "MASS" && to === "VOLUME") return qty / k;
    return null;
  }

  if (ruleType === "kg_per_m") {
    if (from === "LENGTH" && to === "MASS") return qty * k;
    if (from === "MASS" && to === "LENGTH") return qty / k;
    return null;
  }

  if (from === "COUNT" && to === "MASS") return qty * k;
  if (from === "MASS" && to === "COUNT") return qty / k;
  return null;
}

function ruleParamKey(ruleType: ItemRuleType): string {
  if (ruleType === "density") return "density_kg_per_l";
  if (ruleType === "kg_per_m") return "kg_per_m";
  return "kg_per_pc";
}

function ruleHint(ruleType: ItemRuleType): string {
  if (ruleType === "density") return "РћРіСЂР°РЅРёС‡РµРЅРёРµ: MASS <-> VOLUME.";
  if (ruleType === "kg_per_m") return "РћРіСЂР°РЅРёС‡РµРЅРёРµ: LENGTH <-> MASS.";
  return "РћРіСЂР°РЅРёС‡РµРЅРёРµ: COUNT <-> MASS (РґР»СЏ COUNT РёСЃРїРѕР»СЊР·СѓР№С‚Рµ PCS).";
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
  const { token, keycloak } = useAuth();
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
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [itemCats, setItemCats] = useState<ItemCat[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const canCreateDefaultField = realmRoles.includes("nsi.default_field.write") || realmRoles.includes("system.admin");

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
  const [makeDefaultField, setMakeDefaultField] = useState(false);
  const [defaultFieldCode, setDefaultFieldCode] = useState("");
  const [defaultFieldLabel, setDefaultFieldLabel] = useState("");
  const [defaultFieldType, setDefaultFieldType] = useState<"string" | "number" | "boolean">("string");
  const [defaultFieldValue, setDefaultFieldValue] = useState("");
  const [defaultFieldRequired, setDefaultFieldRequired] = useState(false);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const itemCatById = useMemo(() => new Map<number, any>(itemCats.map((c: any) => [c.id, c])), [itemCats]);

  const fromUom = fromUomId ? uomById.get(fromUomId) : null;
  const toUom = toUomId ? uomById.get(toUomId) : null;

  const fromCatCode = fromUom ? (uomCatsById.get(fromUom.category)?.code ?? "-") : "-";
  const toCatCode = toUom ? (uomCatsById.get(toUom.category)?.code ?? "-") : "-";
  const catIdByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of uomCats) {
      const code = up(c?.code);
      const id = Number(c?.id);
      if (code && Number.isFinite(id)) m.set(code, id);
    }
    return m;
  }, [uomCats]);

  const inferredRuleType = useMemo(() => inferRuleTypeByPair(fromCatCode, toCatCode), [fromCatCode, toCatCode]);
  const compositeRuleSteps = useMemo(() => {
    if (scope !== "item" || isEditMode) return [];
    if (!fromUom || !toUom) return [];
    if (inferredRuleType) return [];
    return buildCompositeRuleSteps(fromCatCode, toCatCode);
  }, [scope, isEditMode, fromUom, toUom, inferredRuleType, fromCatCode, toCatCode]);
  const useCompositeMode = scope === "item" && !isEditMode && compositeRuleSteps.length > 0;
  const [compositeParams, setCompositeParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (scope !== "item") return;
    const inferred = inferRuleTypeByPair(fromCatCode, toCatCode);
    if (!inferred) return;
    if (!isEditMode && !preRuleType) {
      setItemRuleType(inferred);
    }
  }, [scope, fromCatCode, toCatCode, isEditMode, preRuleType]);

  useEffect(() => {
    if (!useCompositeMode) return;
    setCompositeParams((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const step of compositeRuleSteps) {
        const id = compositeStepId(step);
        if (!next[id]) {
          next[id] = step.example;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [useCompositeMode, compositeRuleSteps]);

  useEffect(() => {
    if (!token || !itemId) {
      setSelectedItem(null);
      return;
    }
    if (selectedItem?.id === itemId) return;

    let cancelled = false;
    requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${itemId}/`, token })
      .then((row) => {
        if (!cancelled) setSelectedItem(row ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelectedItem(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token, itemId, selectedItem?.id]);

  const exampleText = useMemo(() => {
    if (scope === "global") return "РџСЂРёРјРµСЂ С‚РѕРІР°СЂР°: Р»СЋР±РѕР№ С‚РѕРІР°СЂ";
    if (scope === "category") return `РџСЂРёРјРµСЂ С‚РѕРІР°СЂР°: Р»СЋР±РѕР№ С‚РѕРІР°СЂ РёР· РєР°С‚РµРіРѕСЂРёРё "${itemCatById.get(categoryId ?? -1)?.name ?? "-"}"`;
    const itemTitle = selectedItem?.name ?? (itemId ? "#" + String(itemId) : "-");
    return "\u041f\u0440\u0438\u043c\u0435\u0440 \u0442\u043e\u0432\u0430\u0440\u0430: " + itemTitle;
  }, [scope, categoryId, itemId, selectedItem, itemCatById]);

  const exampleOutQty = useMemo(() => {
    const inQ = n(exampleInQty);
    if (scope === "item" && useCompositeMode) {
      let curQty = inQ;
      let curCat = up(fromCatCode);

      for (const step of compositeRuleSteps) {
        const id = compositeStepId(step);
        const k = n(compositeParams[id]);
        const nextQty = applyRuleStepByCategory(curQty, curCat, step.toCategory, step.ruleType, k);
        if (nextQty === null) return "-";
        curQty = nextQty;
        curCat = up(step.toCategory);
      }

      return curCat === up(toCatCode) ? fmt(curQty, 6) : "-";
    }

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
  }, [exampleInQty, coef, scope, fromCatCode, toCatCode, itemRuleType, useCompositeMode, compositeRuleSteps, compositeParams]);

  const validations = useMemo(() => {
    const v: string[] = [];
    if (!fromUom || !toUom) v.push("Р’С‹Р±РµСЂРёС‚Рµ РІС…РѕРґСЏС‰СѓСЋ Рё РёС‚РѕРіРѕРІСѓСЋ Р•Р.");
    if (!useCompositeMode && n(coef) <= 0) v.push("РџР°СЂР°РјРµС‚СЂ РєРѕСЌС„С„РёС†РёРµРЅС‚Р° РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ > 0.");

    if (scope === "global") {
      if (fromUom && toUom && fromUom.category !== toUom.category) {
        v.push("Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РїСЂР°РІРёР»Р° РІРѕР·РјРѕР¶РЅС‹ С‚РѕР»СЊРєРѕ РІРЅСѓС‚СЂРё РѕРґРЅРѕР№ РєР°С‚РµРіРѕСЂРёРё Р•Р.");
      }
    }

    if (scope === "category") {
      if (!categoryId) v.push("Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹.");
      if (fromUom && fromCatCode !== "COUNT") v.push("Р”Р»СЏ РїСЂР°РІРёР»Р° РєР°С‚РµРіРѕСЂРёРё РІС…РѕРґСЏС‰Р°СЏ Р•Р РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РёР· COUNT.");
      if (toUom && toCatCode !== "MASS") v.push("Р”Р»СЏ РїСЂР°РІРёР»Р° РєР°С‚РµРіРѕСЂРёРё РёС‚РѕРіРѕРІР°СЏ Р•Р РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РёР· MASS.");
    }

    if (scope === "item") {
      if (!itemId) v.push("Р’С‹Р±РµСЂРёС‚Рµ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂРЅСѓСЋ РїРѕР·РёС†РёСЋ.");
      if (useCompositeMode) {
        compositeRuleSteps.forEach((step, idx) => {
          const id = compositeStepId(step);
          if (n(compositeParams[id]) <= 0) {
            v.push(`Р—Р°РїРѕР»РЅРёС‚Рµ РєРѕСЌС„С„РёС†РёРµРЅС‚ РґР»СЏ С€Р°РіР° ${idx + 1} (${step.paramKey}).`);
          }
        });
      } else {
        if (!ruleTypeFitsPair(itemRuleType, fromCatCode, toCatCode)) {
          v.push(`Р’С‹Р±СЂР°РЅРЅС‹Р№ С‚РёРї РїСЂР°РІРёР»Р° РЅРµ РїРѕРґС…РѕРґРёС‚ РґР»СЏ РїР°СЂС‹ РєР°С‚РµРіРѕСЂРёР№ (${fromCatCode} -> ${toCatCode}).`);
        }

        if (itemRuleType === "pcs_weight") {
          if (fromCatCode === "COUNT" && up(fromUom?.code) !== "PCS") v.push("Р”Р»СЏ COUNT РёСЃРїРѕР»СЊР·СѓР№С‚Рµ Р•Р PCS.");
          if (toCatCode === "COUNT" && up(toUom?.code) !== "PCS") v.push("Р”Р»СЏ COUNT РёСЃРїРѕР»СЊР·СѓР№С‚Рµ Р•Р PCS.");
        }
      }
    }

    return v;
  }, [scope, fromUom, toUom, coef, categoryId, itemId, fromCatCode, toCatCode, itemRuleType, useCompositeMode, compositeRuleSteps, compositeParams]);

  const canSave = validations.length === 0 && (!isEditMode || !!editId);

  useEffect(() => {
    if (isEditMode) setScope(editScope);
  }, [isEditMode, editScope]);

  async function load() {
    if (!token) return;
    setErr(null);

    try {
      const [u, uc, ic] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
      ]);

      const nextUoms = u ?? [];
      const nextUomCats = uc ?? [];
      const nextItemCats = ic ?? [];
      const nextUomCatsById = new Map<number, any>(nextUomCats.map((c: any) => [c.id, c]));

      setUoms(nextUoms);
      setUomCats(nextUomCats);
      setItemCats(nextItemCats);

      if (isEditMode) {
        if (!editId) {
          throw new Error("РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РїСЂР°РІРёР»Р°.");
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
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token, isEditMode, editId, editScope, location.search]);

  const coefLabel = useMemo(() => {
    if (scope === "global") return "РљРѕСЌС„С„РёС†РёРµРЅС‚ (multiplier)";
    if (scope === "category") return "РљРѕСЌС„С„РёС†РёРµРЅС‚ (СЃРєРѕР»СЊРєРѕ РёС‚РѕРіРѕРІРѕР№ Р•Р РІ 1 РІС…РѕРґСЏС‰РµР№)";
    if (itemRuleType === "density") return "РџР»РѕС‚РЅРѕСЃС‚СЊ (density_kg_per_l, РєРі/Р»)";
    if (itemRuleType === "kg_per_m") return "Р›РёРЅРµР№РЅР°СЏ РјР°СЃСЃР° (kg_per_m, РєРі/Рј)";
    return "Р’РµСЃ 1 PCS (kg_per_pc, РєРі)";
  }, [scope, itemRuleType]);

  async function createDefaultFieldIfNeeded() {
    if (!token || !canCreateDefaultField || !makeDefaultField) return;

    const fieldCode = defaultFieldCode.trim();
    if (!fieldCode) throw new Error("РЈРєР°Р¶РёС‚Рµ РєРѕРґ РїРѕР»СЏ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ.");

    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/default-fields/`,
        token,
        body: {
          code: fieldCode,
          label: defaultFieldLabel.trim() || fieldCode,
          field_type: defaultFieldType,
          default_value: defaultFieldValue.trim(),
          required: defaultFieldRequired,
        },
      });
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 400 && e.status !== 409)) throw e;
      const rows = await requestJson<any[]>({
        method: "GET",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/default-fields/`,
        token,
      });
      const exists = (rows ?? []).some((f: any) => String(f.code ?? "").trim().toLowerCase() === fieldCode.toLowerCase());
      if (!exists) throw e;
    }
  }

  async function saveRule() {
    if (!token) return;
    if (!canSave) return;

    if (isEditMode && !editId) {
      setErr("РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РїСЂР°РІРёР»Р°.");
      return;
    }

    setErr(null);

    try {
      await createDefaultFieldIfNeeded();
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
        const rulesBaseUrl = `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/`;

        if (useCompositeMode) {
          if (!itemId) throw new Error("Р’С‹Р±РµСЂРёС‚Рµ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂРЅСѓСЋ РїРѕР·РёС†РёСЋ.");

          for (const step of compositeRuleSteps) {
            const fromCategoryId = catIdByCode.get(up(step.fromCategory));
            const toCategoryId = catIdByCode.get(up(step.toCategory));
            if (!fromCategoryId || !toCategoryId) {
              throw new Error(`РќРµ РЅР°Р№РґРµРЅС‹ РєР°С‚РµРіРѕСЂРёРё Р•Р РґР»СЏ С€Р°РіР° ${step.fromCategory} -> ${step.toCategory}.`);
            }

            const id = compositeStepId(step);
            const stepValue = String(n(compositeParams[id]));
            const body = {
              item: itemId,
              from_category: fromCategoryId,
              to_category: toCategoryId,
              rule_type: step.ruleType,
              conditions: itemRuleMeta.conditions ?? {},
              params: { [step.paramKey]: stepValue },
              priority: itemRuleMeta.priority ?? 0,
              status,
              effective_from: itemRuleMeta.effective_from ?? null,
              effective_to: itemRuleMeta.effective_to ?? null,
              supersedes: itemRuleMeta.supersedes ?? null,
            };

            let matchedRule: any = null;
            try {
              const matched = await requestJson<any>({
                method: "POST",
                url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/match`,
                token,
                body: {
                  item: itemId,
                  from_category: step.fromCategory,
                  to_category: step.toCategory,
                  context: {},
                  on_date: new Date().toISOString().slice(0, 10),
                },
              });
              matchedRule = matched?.rule ?? null;
            } catch (e: any) {
              if (!(e instanceof ApiError) || e.status !== 404) throw e;
            }

            if (matchedRule && matchedRule.item === itemId && matchedRule.rule_type === step.ruleType) {
              await requestJson({
                method: "PUT",
                url: `${rulesBaseUrl}${matchedRule.id}/`,
                token,
                body,
              });
            } else {
              await requestJson({
                method: "POST",
                url: rulesBaseUrl,
                token,
                body,
              });
            }
          }
        } else {
          const params: Record<string, string> = {
            [ruleParamKey(itemRuleType)]: String(n(coef)),
          };

          await requestJson({
            method: isEditMode ? "PUT" : "POST",
            url: isEditMode
              ? `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/${editId}/`
              : rulesBaseUrl,
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
      }

      nav("/nsi/rules");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const pageTitle = isEditMode ? "Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РїСЂР°РІРёР»Р°" : "РЎРѕР·РґР°РЅРёРµ РїСЂР°РІРёР»Р°";
  const pageSubtitle = isEditMode
    ? "РР·РјРµРЅРёС‚Рµ РїР°СЂР°РјРµС‚СЂС‹ Рё СЃРѕС…СЂР°РЅРёС‚Рµ РїСЂР°РІРёР»Рѕ."
    : "РЎРѕР·РґР°Р№С‚Рµ РїСЂР°РІРёР»Рѕ РїРµСЂРµРІРѕРґР° РјРµР¶РґСѓ Р•Р. Р”Р»СЏ РјРµР¶РєР°С‚РµРіРѕСЂРёР№РЅРѕРіРѕ РїРµСЂРµРІРѕРґР° РІС‹Р±РёСЂР°Р№С‚Рµ С‚РёРї РїСЂР°РІРёР»Р° РІ Р±Р»РѕРєРµ РїР°СЂР°РјРµС‚СЂРѕРІ.";
  const submitLabel = isEditMode ? "РЎРѕС…СЂР°РЅРёС‚СЊ" : (useCompositeMode ? "РЎРѕР·РґР°С‚СЊ РЅР°Р±РѕСЂ РїСЂР°РІРёР»" : "РЎРѕР·РґР°С‚СЊ РїСЂР°РІРёР»Рѕ");

  return (
    <div className="card">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        right={<button className="btn" onClick={() => nav("/nsi/rules")}>РћС‚РјРµРЅР°</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>РўРёРї РїСЂР°РІРёР»Р°</h4>
        <div className="row">
          <label>
            <small>РљР°РєРѕРµ РїСЂР°РІРёР»Рѕ СЃРѕР·РґР°РµРј?</small><br />
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} disabled={isEditMode}>
              <option value="global">Р“Р»РѕР±Р°Р»СЊРЅРѕРµ (РґР»СЏ РІСЃРµС…)</option>
              <option value="category">Р”Р»СЏ РєР°С‚РµРіРѕСЂРёРё</option>
              <option value="item">Р”Р»СЏ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂРЅРѕР№ РїРѕР·РёС†РёРё</option>
            </select>
          </label>

          {scope === "category" && (
            <label style={{ flex: 1 }}>
              <small>РљР°С‚РµРіРѕСЂРёСЏ</small><br />
              <select value={categoryId ?? ""} onChange={(e) => setCategoryId(toNum(e.target.value))} style={{ width: "100%" }}>
                {itemCats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          {scope === "item" && (
            <>
              <label style={{ flex: 1 }}>
                <small>РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°</small><br />
                <ItemLookup
                  token={token}
                  value={itemId}
                  onChange={(item) => {
                    setItemId(item?.id ?? null);
                    setSelectedItem(item ?? null);
                  }}
                />
              </label>

              <label>
                <small>РўРёРї РєРѕРЅРІРµСЂС‚Р°С†РёРё</small><br />
                <select value={itemRuleType} onChange={(e) => setItemRuleType(e.target.value as ItemRuleType)} disabled={useCompositeMode}>
                  <option value="pcs_weight">COUNT в†” MASS (pcs_weight)</option>
                  <option value="kg_per_m">LENGTH в†” MASS (kg_per_m)</option>
                  <option value="density">MASS в†” VOLUME (density)</option>
                </select>
              </label>
            </>
          )}
        </div>

        {useCompositeMode && (
          <div style={{ marginTop: 8 }}>
            <small>
              РџСЂСЏРјРѕРіРѕ РїСЂР°РІРёР»Р° РґР»СЏ РїР°СЂС‹ {fromCatCode} {"->"} {toCatCode} РЅРµС‚. Р‘СѓРґРµС‚ СЃРѕР·РґР°РЅ РЅР°Р±РѕСЂ РїСЂР°РІРёР» РїРѕ С€Р°РіР°Рј С‡РµСЂРµР· РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅСѓСЋ РєР°С‚РµРіРѕСЂРёСЋ.
            </small>
          </div>
        )}

        {isEditMode && <div style={{ marginTop: 8 }}><small>РўРёРї РѕР±Р»Р°СЃС‚Рё С„РёРєСЃРёСЂРѕРІР°РЅ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ.</small></div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>РџР°СЂР°РјРµС‚СЂС‹ РїСЂР°РІРёР»Р°</h4>

        <div className="row">
          <label>
            <small>РІС…РѕРґСЏС‰Р°СЏ Р•Р</small><br />
            <select value={fromUomId ?? ""} onChange={(e) => setFromUomId(toNum(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code} ({uomCatsById.get(u.category)?.code ?? "-"})</option>)}
            </select>
          </label>

          <label>
            <small>РёС‚РѕРіРѕРІР°СЏ Р•Р</small><br />
            <select value={toUomId ?? ""} onChange={(e) => setToUomId(toNum(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code} ({uomCatsById.get(u.category)?.code ?? "-"})</option>)}
            </select>
          </label>

          {!(scope === "item" && useCompositeMode) && (
            <label>
              <small>{coefLabel}</small><br />
              <input value={coef} onChange={(e) => setCoef(e.target.value)} />
            </label>
          )}

          <label>
            <small>РЎС‚Р°С‚СѓСЃ</small><br />
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        {scope === "item" && useCompositeMode && (
          <div style={{ marginTop: 10 }}>
            {compositeRuleSteps.map((step, idx) => {
              const id = compositeStepId(step);
              return (
                <div key={id} className="row" style={{ alignItems: "center", gap: 8, marginTop: idx === 0 ? 0 : 6 }}>
                  <span className="badge">РЁР°Рі {idx + 1}</span>
                  <small>{step.fromCategory} {"->"} {step.toCategory} ({step.ruleType})</small>
                  <input
                    value={compositeParams[id] ?? ""}
                    onChange={(e) => setCompositeParams((m) => ({ ...m, [id]: e.target.value }))}
                    style={{ width: 140 }}
                  />
                  <small>{step.label}</small>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          {scope === "global" && <small>РћРіСЂР°РЅРёС‡РµРЅРёРµ: РѕР±Рµ Р•Р РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РІ <b>РѕРґРЅРѕР№ РєР°С‚РµРіРѕСЂРёРё</b>. РЎРµР№С‡Р°СЃ: {fromCatCode} {"->"} {toCatCode}</small>}
          {scope === "category" && <small>РћРіСЂР°РЅРёС‡РµРЅРёРµ: COUNT {"->"} MASS (РїСЂРёРјРµСЂ: BAG {"->"} KG). РЎРµР№С‡Р°СЃ: {fromCatCode} {"->"} {toCatCode}</small>}
          {scope === "item" && !useCompositeMode && <small>{ruleHint(itemRuleType)} РЎРµР№С‡Р°СЃ: {fromCatCode} {"->"} {toCatCode}</small>}
          {scope === "item" && useCompositeMode && <small>РЎРѕСЃС‚Р°РІРЅРѕР№ РїРµСЂРµРІРѕРґ. РЎРµР№С‡Р°СЃ: {fromCatCode} {"->"} {toCatCode}</small>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>РџСЂРёРјРµСЂ РїРµСЂРµРІРѕРґР°</h4>

        <table>
          <thead>
            <tr>
              <th>РџСЂРёРјРµСЂ С‚РѕРІР°СЂР°</th>
              <th>РІС…РѕРґСЏС‰Р°СЏ Р•Р</th>
              <th>РёСЃС…РѕРґСЏС‰Р°СЏ Р•Р</th>
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

        {scope === "item" && !useCompositeMode ? (
          <div style={{ marginTop: 8 }}>
            <small>
              РџР°СЂР°РјРµС‚СЂ РґР»СЏ С‚РёРїР° РїСЂР°РІРёР»Р°: <b>{ruleParamKey(itemRuleType)}</b>. РџСЂРёРјРµСЂ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РёР· РІС‹Р±СЂР°РЅРЅС‹С… Р•Р Рё РєРѕСЌС„С„РёС†РёРµРЅС‚Р°.
            </small>
          </div>
        ) : null}

        {scope === "item" && useCompositeMode ? (
          <div style={{ marginTop: 8 }}>
            <small>
              Р”Р»СЏ РїР°СЂС‹ {fromCatCode} {"->"} {toCatCode} С‚СЂРµР±СѓРµС‚СЃСЏ РЅРµСЃРєРѕР»СЊРєРѕ РїР°СЂР°РјРµС‚СЂРѕРІ: {compositeRuleSteps.map((s) => s.paramKey).join(", ")}.
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

        {canCreateDefaultField && (
          <div style={{ marginTop: 12 }}>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={makeDefaultField} onChange={(e) => setMakeDefaultField(e.target.checked)} />
              <small>РїРѕР»Рµ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ</small>
            </label>
            {makeDefaultField && (
              <div className="row" style={{ marginTop: 8 }}>
                <label>
                  <small>РљРѕРґ РїРѕР»СЏ</small><br />
                  <input value={defaultFieldCode} onChange={(e) => setDefaultFieldCode(e.target.value)} />
                </label>
                <label>
                  <small>РќР°Р·РІР°РЅРёРµ</small><br />
                  <input value={defaultFieldLabel} onChange={(e) => setDefaultFieldLabel(e.target.value)} />
                </label>
                <label>
                  <small>РўРёРї</small><br />
                  <select value={defaultFieldType} onChange={(e) => setDefaultFieldType(e.target.value as "string" | "number" | "boolean")}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                </label>
                <label>
                  <small>Р—РЅР°С‡РµРЅРёРµ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ</small><br />
                  <input value={defaultFieldValue} onChange={(e) => setDefaultFieldValue(e.target.value)} />
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={defaultFieldRequired} onChange={(e) => setDefaultFieldRequired(e.target.checked)} />
                  <small>РѕР±СЏР·Р°С‚РµР»СЊРЅРѕРµ</small>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/rules")}>РћС‚РјРµРЅР°</button>
          <button className="btn primary" onClick={saveRule} disabled={!canSave}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
