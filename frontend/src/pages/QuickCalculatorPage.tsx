import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

type ConvertStep = {
  kind?: string;
  description?: string;
  from_qty?: string;
  from_uom?: string;
  to_qty?: string;
  to_uom?: string;
};

type SuggestedRuleStep = {
  step?: number;
  from_category?: string;
  to_category?: string;
  rule_type?: string;
  required_param?: string;
  example_param_value?: string;
};

type ParsedConvertError = {
  message?: string;
  suggestedSteps: SuggestedRuleStep[];
};

function up(s: unknown): string {
  return String(s ?? "").toUpperCase();
}

function normalizeQty(value: string): string {
  return String(value ?? "").replace(",", ".").trim();
}

function roundHalfUp(value: string, precision: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const p = Math.max(0, Math.min(8, precision));
  const k = 10 ** p;
  const r = Math.round((n + Number.EPSILON) * k) / k;
  return p === 0 ? String(Math.round(r)) : r.toFixed(p);
}

function inferRuleTypeByCategories(fromCategory: string | null, toCategory: string | null): string | null {
  if (!fromCategory || !toCategory) return null;
  const pair = new Set([fromCategory, toCategory]);
  if (pair.has("COUNT") && pair.has("MASS")) return "pcs_weight";
  if (pair.has("LENGTH") && pair.has("MASS")) return "kg_per_m";
  if (pair.has("MASS") && pair.has("VOLUME")) return "density";
  return null;
}

function parseConvertError(error: unknown): ParsedConvertError | null {
  if (!(error instanceof ApiError)) return null;
  try {
    const parsed = JSON.parse(error.bodyText);
    const detail = parsed?.detail;
    if (!detail || typeof detail !== "object") return null;

    const message = typeof detail.message === "string" ? detail.message : undefined;
    const suggestedSteps = Array.isArray(detail.suggested_steps) ? detail.suggested_steps : [];
    return { message, suggestedSteps };
  } catch {
    return null;
  }
}

export default function QuickCalculatorPage(props: { token?: string; publicMode?: boolean }) {
  const token = props.token;
  const nav = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [uomCats, setUomCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const [itemId, setItemId] = useState<number | null>(null);
  const [fromUom, setFromUom] = useState("");
  const [toUom, setToUom] = useState("");
  const [qty, setQty] = useState("1");

  const [roundMode, setRoundMode] = useState<"item" | "custom">("item");
  const [roundPrecision, setRoundPrecision] = useState(2);

  const [resultQtyRaw, setResultQtyRaw] = useState("");
  const [resultUom, setResultUom] = useState("");
  const [steps, setSteps] = useState<ConvertStep[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestedRuleUrl, setSuggestedRuleUrl] = useState<string | null>(null);

  const prevItemId = useRef<number | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);

  const selectedItem = itemId ? itemById.get(itemId) : null;

  const defaultTargetUom = useMemo(() => {
    if (!selectedItem) return "";
    const policy = selectedItem.policy ?? {};
    const postingId = policy.posting_uom ?? policy.storage_uom;
    return postingId ? up(uomById.get(postingId)?.code) : "";
  }, [selectedItem, uomById]);

  const defaultFromUom = useMemo(() => {
    if (!selectedItem) return "";
    const pkg = (selectedItem.packages ?? [])[0];
    const pkgCode = pkg?.package_uom ? up(uomById.get(pkg.package_uom)?.code) : "";
    if (pkgCode) return pkgCode;
    if (defaultTargetUom) return defaultTargetUom;
    return up(uoms[0]?.code ?? "");
  }, [selectedItem, uomById, defaultTargetUom, uoms]);

  const roundedQty = useMemo(() => {
    if (!resultQtyRaw) return "";
    if (roundMode === "item") return resultQtyRaw;
    return roundHalfUp(resultQtyRaw, roundPrecision);
  }, [resultQtyRaw, roundMode, roundPrecision]);

  const fromCatCode = useMemo(() => {
    const u = uoms.find((x: any) => up(x.code) === up(fromUom));
    if (!u) return "-";
    return up(uomCatsById.get(u.category)?.code ?? "-");
  }, [uoms, uomCatsById, fromUom]);

  const toCatCode = useMemo(() => {
    const u = uoms.find((x: any) => up(x.code) === up(toUom));
    if (!u) return "-";
    return up(uomCatsById.get(u.category)?.code ?? "-");
  }, [uoms, uomCatsById, toUom]);

  function uomCategoryCodeByUomCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const u = uoms.find((x: any) => up(x.code) === up(code));
    if (!u) return null;
    return up(uomCatsById.get(u.category)?.code ?? "");
  }

  function pickUomCodeForCategory(categoryCode: string | null | undefined): string | null {
    if (!categoryCode) return null;
    const cc = up(categoryCode);
    const inCategory = uoms.filter((u: any) => up(uomCatsById.get(u.category)?.code ?? "") === cc);
    if (!inCategory.length) return null;

    const preferredCode =
      cc === "COUNT"
        ? "PCS"
        : cc === "MASS"
          ? "KG"
          : cc === "LENGTH"
            ? "M"
            : cc === "VOLUME"
              ? "L"
              : "";

    if (preferredCode) {
      const preferred = inCategory.find((u: any) => up(u.code) === preferredCode);
      if (preferred) return up(preferred.code);
    }
    return up(inCategory[0].code);
  }

  function suggestRuleUrl(args: {
    item: any;
    fromCode: string;
    toCode: string;
    ruleType?: string | null;
    fromCategory?: string | null;
    toCategory?: string | null;
  }): string {
    const from = up(args.fromCode);
    const to = up(args.toCode);

    const fromCategory = up(args.fromCategory ?? uomCategoryCodeByUomCode(from) ?? "");
    const toCategory = up(args.toCategory ?? uomCategoryCodeByUomCode(to) ?? "");

    let scope = "global";
    if (fromCategory && toCategory && fromCategory !== toCategory) scope = "item";
    if (from === "BAG" || from === "BOX") scope = "category";
    if (from === "PCS" || to === "PCS") scope = "item";
    if (args.ruleType) scope = "item";

    const inferredRuleType = args.ruleType ?? inferRuleTypeByCategories(fromCategory || null, toCategory || null);

    const qs = new URLSearchParams();
    qs.set("scope", scope);
    qs.set("from", from);
    qs.set("to", to);
    if (scope === "item" && inferredRuleType) qs.set("rule_type", inferredRuleType);
    if (args.item?.category) qs.set("category_id", String(args.item.category));
    if (args.item?.id) qs.set("item_id", String(args.item.id));
    return `/nsi/rules/new?${qs.toString()}`;
  }

  async function loadRefs() {
    setErr(null);
    try {
      const [it, u, uc] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
      ]);
      setItems(it ?? []);
      setUoms(u ?? []);
      setUomCats(uc ?? []);

      if ((it ?? []).length && itemId === null) setItemId(it[0].id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    loadRefs();
    // eslint-disable-next-line
  }, [token]);

  useEffect(() => {
    if (!selectedItem || !itemId) return;
    if (prevItemId.current === itemId) return;
    prevItemId.current = itemId;

    if (defaultTargetUom) setToUom(defaultTargetUom);
    if (defaultFromUom) setFromUom(defaultFromUom);

    setResultQtyRaw("");
    setResultUom("");
    setSteps([]);
    setWarnings([]);
    setSuggestedRuleUrl(null);
  }, [itemId, selectedItem, defaultTargetUom, defaultFromUom]);

  function applyDefaultTarget() {
    if (defaultTargetUom) setToUom(defaultTargetUom);
  }

  function swapUoms() {
    setFromUom(toUom);
    setToUom(fromUom);
  }

  async function calculate() {
    setSuggestedRuleUrl(null);
    if (!itemId) {
      setErr("Р’С‹Р±РµСЂРёС‚Рµ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂСѓ.");
      return;
    }
    if (!fromUom || !toUom) {
      setErr("РЈРєР°Р¶РёС‚Рµ РІС…РѕРґСЏС‰СѓСЋ Рё РёС‚РѕРіРѕРІСѓСЋ Р•Р.");
      return;
    }

    const qtyText = normalizeQty(qty);
    const qtyNum = Number(qtyText);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setErr("РљРѕР»РёС‡РµСЃС‚РІРѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0.");
      return;
    }

    setErr(null);
    setCalculating(true);
    setResultQtyRaw("");
    setResultUom("");
    setSteps([]);
    setWarnings([]);
    setSuggestedRuleUrl(null);

    try {
      const res = await requestJson<any>({
        method: "POST",
        url: `/conversion/api/v1/convert`,
        token,
        body: {
          item_id: itemId,
          qty: qtyText,
          from_uom: up(fromUom),
          to_uom: up(toUom),
          context: {},
        },
      });

      setResultQtyRaw(String(res?.to?.qty ?? ""));
      setResultUom(up(res?.to?.uom ?? toUom));
      setSteps(Array.isArray(res?.steps) ? res.steps : []);
      setWarnings(Array.isArray(res?.warnings) ? res.warnings : []);
      setSuggestedRuleUrl(null);
    } catch (e: any) {
      const parsed = parseConvertError(e);
      if (parsed && selectedItem) {
        let suggestedUrl = suggestRuleUrl({
          item: selectedItem,
          fromCode: fromUom,
          toCode: toUom,
        });
        let detailText = parsed.message ?? "РќРµС‚ РїРѕРґС…РѕРґСЏС‰РµРіРѕ РїСЂР°РІРёР»Р° РґР»СЏ РїРµСЂРµРІРѕРґР°.";

        if (parsed.suggestedSteps.length > 0) {
          const first = parsed.suggestedSteps[0];
          const fromCodeForStep = pickUomCodeForCategory(first.from_category) ?? up(fromUom);
          const toCodeForStep = pickUomCodeForCategory(first.to_category) ?? up(toUom);
          suggestedUrl = suggestRuleUrl({
            item: selectedItem,
            fromCode: fromCodeForStep,
            toCode: toCodeForStep,
            ruleType: first.rule_type ?? null,
            fromCategory: first.from_category ?? null,
            toCategory: first.to_category ?? null,
          });

          const stepsText = parsed.suggestedSteps
            .map((s) => {
              const num = s.step ?? "?";
              const pair = `${s.from_category ?? "?"} -> ${s.to_category ?? "?"}`;
              const rule = s.rule_type ?? "rule";
              const param = s.required_param ? `, ${s.required_param}=${s.example_param_value ?? "..."}` : "";
              return `${num}) ${pair}, ${rule}${param}`;
            })
            .join("; ");
          detailText = `${detailText} РЁР°РіРё: ${stepsText}`;
        }

        setSuggestedRuleUrl(suggestedUrl);
        setErr(detailText);
      } else if (parsed) {
        setErr(parsed.message ?? "РќРµС‚ РїРѕРґС…РѕРґСЏС‰РµРіРѕ РїСЂР°РІРёР»Р° РґР»СЏ РїРµСЂРµРІРѕРґР°.");
      } else if (e instanceof ApiError) {
        try {
          const parsedBody = JSON.parse(e.bodyText);
          setErr(parsedBody?.detail ? String(parsedBody.detail) : e.message);
        } catch {
          setErr(e.message);
        }
      } else {
        setErr(e?.message ?? String(e));
      }
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ РєРѕРЅРІРµСЂС‚Р°С†РёРё"
        subtitle="Р‘С‹СЃС‚СЂС‹Р№ СЂР°СЃС‡С‘С‚ Р±РµР· СЃРѕР·РґР°РЅРёСЏ РЅР°РєР»Р°РґРЅРѕР№: РІС‹Р±РµСЂРёС‚Рµ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂСѓ, Р•Р Рё РєРѕР»РёС‡РµСЃС‚РІРѕ."
        right={
          <button
            className="btn"
            onClick={() => {
              if (props.publicMode) {
                window.location.href = "/";
                return;
              }
              nav("/");
            }}
          >
            {props.publicMode ? "Р’РѕР№С‚Рё РІ СЃРёСЃС‚РµРјСѓ" : "Рљ РЅР°РєР»Р°РґРЅС‹Рј"}
          </button>
        }
      />

      {err && (
        <div style={{ marginTop: 10, color: "#fca5a5" }}>
          {err}
          {suggestedRuleUrl && !props.publicMode && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-tight" onClick={() => nav(suggestedRuleUrl)}>
                РЎРѕР·РґР°С‚СЊ РїСЂР°РІРёР»Рѕ
              </button>
            </div>
          )}
          {suggestedRuleUrl && props.publicMode && (
            <div style={{ marginTop: 8 }}>
              <small>Р”Р»СЏ СЃРѕР·РґР°РЅРёСЏ РїСЂР°РІРёР»Р° РІРѕР№РґРёС‚Рµ РІ СЃРёСЃС‚РµРјСѓ.</small>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1, minWidth: 320 }}>
            <small>РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°</small><br />
            <select value={itemId ?? ""} onChange={(e) => setItemId(toNum(e.target.value))} style={{ width: "100%" }}>
              {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
          </label>
          <label>
            <small>Р’С…РѕРґСЏС‰Р°СЏ Р•Р</small><br />
            <select value={fromUom} onChange={(e) => setFromUom(up(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={up(u.code)}>{up(u.code)} ({up(uomCatsById.get(u.category)?.code ?? "-")})</option>)}
            </select>
          </label>
          <label>
            <small>РС‚РѕРіРѕРІР°СЏ Р•Р</small><br />
            <select value={toUom} onChange={(e) => setToUom(up(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={up(u.code)}>{up(u.code)} ({up(uomCatsById.get(u.category)?.code ?? "-")})</option>)}
            </select>
          </label>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <label>
            <small>РљРѕР»РёС‡РµСЃС‚РІРѕ</small><br />
            <input value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 140 }} />
          </label>

          <label>
            <small>РћРєСЂСѓРіР»РµРЅРёРµ</small><br />
            <select value={roundMode} onChange={(e) => setRoundMode(e.target.value as "item" | "custom")}>
              <option value="item">РџРѕ С‚РѕС‡РЅРѕСЃС‚Рё РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹</option>
              <option value="custom">РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєР°СЏ С‚РѕС‡РЅРѕСЃС‚СЊ</option>
            </select>
          </label>

          <label>
            <small>Р—РЅР°РєРѕРІ РїРѕСЃР»Рµ Р·Р°РїСЏС‚РѕР№</small><br />
            <input
              type="number"
              min={0}
              max={8}
              value={roundPrecision}
              disabled={roundMode !== "custom"}
              onChange={(e) => setRoundPrecision(Math.max(0, Math.min(8, toNum(e.target.value))))}
              style={{ width: 120 }}
            />
          </label>

          <div style={{ flex: 1 }} />

          <button className="btn" onClick={swapUoms}>РџРѕРјРµРЅСЏС‚СЊ Р•Р</button>
          <button className="btn" onClick={applyDefaultTarget}>Р•Р РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ</button>
          <button className="btn primary" onClick={calculate} disabled={calculating}>
            {calculating ? "РЎС‡РёС‚Р°РµРј..." : "Р Р°СЃСЃС‡РёС‚Р°С‚СЊ"}
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>РљР°С‚РµРіРѕСЂРёРё: {fromCatCode} {"->"} {toCatCode}</small>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Р РµР·СѓР»СЊС‚Р°С‚</h4>
        {!resultQtyRaw ? (
          <small>Р’С‹РїРѕР»РЅРёС‚Рµ СЂР°СЃС‡С‘С‚, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚.</small>
        ) : (
          <>
            <div className="row">
              <span className="badge">
                {normalizeQty(qty)} {up(fromUom)} {"->"} {roundedQty} {resultUom}
              </span>
              {roundMode === "custom" && (
                <small>РћРєСЂСѓРіР»РµРЅРѕ РґРѕ {roundPrecision} Р·РЅ.</small>
              )}
            </div>

            {warnings.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {warnings.map((w, i) => (
                  <div key={i}><small>{w}</small></div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>РЁР°РіРё РєРѕРЅРІРµСЂС‚Р°С†РёРё</h4>
        {steps.length === 0 ? (
          <small>РЁР°РіРё РїРѕСЏРІСЏС‚СЃСЏ РїРѕСЃР»Рµ СЂР°СЃС‡С‘С‚Р°.</small>
        ) : (
          <table className="compact-table">
            <thead>
              <tr>
                <th>РўРёРї</th>
                <th>РћРїРёСЃР°РЅРёРµ</th>
                <th>РР·</th>
                <th>Р’</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={i}>
                  <td>{s.kind ?? "-"}</td>
                  <td>{s.description ?? "-"}</td>
                  <td>{String(s.from_qty ?? "-")} {up(s.from_uom ?? "")}</td>
                  <td>{String(s.to_qty ?? "-")} {up(s.to_uom ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

