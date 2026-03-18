import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, requestJson } from "../api/request";
import ItemLookup from "../components/ItemLookup";
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
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("ui_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

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

    resetOutput();
  }, [itemId, selectedItem, defaultTargetUom, defaultFromUom]);

  useEffect(() => {
    if (!props.publicMode) return;
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("ui_theme", theme);
  }, [theme, props.publicMode]);

  function resetOutput() {
    setResultQtyRaw("");
    setResultUom("");
    setSteps([]);
    setWarnings([]);
    setSuggestedRuleUrl(null);
  }

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
      setErr("Выберите номенклатуру.");
      return;
    }
    if (!fromUom || !toUom) {
      setErr("Укажите входящую и итоговую ЕИ.");
      return;
    }

    const qtyText = normalizeQty(qty);
    const qtyNum = Number(qtyText);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setErr("Количество должно быть больше 0.");
      return;
    }

    setErr(null);
    setCalculating(true);
    resetOutput();

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
    } catch (e: any) {
      const parsed = parseConvertError(e);
      if (parsed && selectedItem) {
        let suggestedUrl = suggestRuleUrl({
          item: selectedItem,
          fromCode: fromUom,
          toCode: toUom,
        });
        let detailText = parsed.message ?? "Нет подходящего правила для перевода.";

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
          detailText = `${detailText} Шаги: ${stepsText}`;
        }

        setSuggestedRuleUrl(suggestedUrl);
        setErr(detailText);
      } else if (parsed) {
        setErr(parsed.message ?? "Нет подходящего правила для перевода.");
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
    <div className="card calculator-page">
      <PageHeader
        title="Калькулятор конвертации"
        subtitle="Быстрый расчёт без создания накладной: выберите номенклатуру, ЕИ и количество."
        right={
          <div className="row" style={{ gap: 8 }}>
            {props.publicMode && (
              <button
                className="btn icon-btn"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                title={theme === "dark" ? "Светлая тема" : "Темная тема"}
                aria-label={theme === "dark" ? "Светлая тема" : "Темная тема"}
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
            )}
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
              {props.publicMode ? "Войти в систему" : "К накладным"}
            </button>
          </div>
        }
      />

      {err && (
        <div className="error-banner">
          {err}
          {suggestedRuleUrl && !props.publicMode && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-tight" onClick={() => nav(suggestedRuleUrl)}>
                Создать правило
              </button>
            </div>
          )}
          {suggestedRuleUrl && props.publicMode && (
            <div style={{ marginTop: 8 }}>
              <small>Для создания правила войдите в систему.</small>
            </div>
          )}
        </div>
      )}

      <div className="card calculator-controls-card" style={{ marginTop: 12 }}>
        <div className="row">
          <label className="field" style={{ flex: 1, minWidth: 360 }}>
            <small>Номенклатура</small>
            <ItemLookup token={token} value={itemId} onChange={(item) => setItemId(item?.id ?? null)} />
          </label>
          <label className="field" style={{ minWidth: 240, flex: 1 }}>
            <small>Округление</small>
            <select value={roundMode} onChange={(e) => setRoundMode(e.target.value as "item" | "custom")}>
              <option value="item">По точности номенклатуры</option>
              <option value="custom">Пользовательская точность</option>
            </select>
          </label>
          <label className="field" style={{ width: 190, minWidth: 190 }}>
            <small>Знаков после запятой</small>
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
        </div>
        <div className="row calculator-controls-row">
          <label className="field">
            <small>Количество</small>
            <input value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 140 }} />
          </label>
          <label className="field">
            <small>Входящая ЕИ</small>
            <select value={fromUom} onChange={(e) => setFromUom(up(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={up(u.code)}>{up(u.code)} ({up(uomCatsById.get(u.category)?.code ?? "-")})</option>)}
            </select>
          </label>
          <label className="field">
            <small>Итоговая ЕИ</small>
            <select value={toUom} onChange={(e) => setToUom(up(e.target.value))}>
              {uoms.map((u: any) => <option key={u.id} value={up(u.code)}>{up(u.code)} ({up(uomCatsById.get(u.category)?.code ?? "-")})</option>)}
            </select>
          </label>
        </div>
        <div className="row calculator-actions-row">
          <button className="btn" onClick={swapUoms}>Поменять ЕИ</button>
          <button className="btn" onClick={applyDefaultTarget}>ЕИ по умолчанию</button>
          <button className="btn primary" onClick={calculate} disabled={calculating}>
            {calculating ? "Считаем..." : "Рассчитать"}
          </button>
        </div>
        <div className="calculator-categories">
          <small>Категории: {fromCatCode} {"->"} {toCatCode}</small>
        </div>
      </div>
      <div className="card calculator-result-card" style={{ marginTop: 12 }}>
        <h4 className="section-title">Результат</h4>
        {!resultQtyRaw ? (
          <small>Выполните расчёт, чтобы увидеть результат.</small>
        ) : (
          <>
            <div className="calculator-result-main">
              <span className="badge calculator-result-badge">
                {normalizeQty(qty)} {up(fromUom)} {"->"} {roundedQty} {resultUom}
              </span>
              {roundMode === "custom" && (
                <small>Округлено до {roundPrecision} зн.</small>
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
        <details className="calc-steps-spoiler">
          <summary>Шаги конвертации</summary>
          {steps.length === 0 ? (
            <small>Шаги появятся после расчёта.</small>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Описание</th>
                    <th>Из</th>
                    <th>В</th>
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
            </div>
          )}
        </details>
      </div>
    </div>
  );
}

