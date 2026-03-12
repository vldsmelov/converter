import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

type Item = any;
type Uom = any;
type Cat = any;
type UomCat = any;

type Line = {
  key: string;
  item_id: number | null;
  qty: string;
  uom_code: string;
};

type Check = {
  state: "idle" | "checking" | "ok" | "missing" | "mismatch";
  message?: string;
  suggestedUrl?: string;
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

function randNo() {
  return `НК-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function up(s: any) {
  return String(s ?? "").toUpperCase();
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

export default function CreateInvoicePage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [uomCats, setUomCats] = useState<UomCat[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [number, setNumber] = useState(randNo());
  const [supplier, setSupplier] = useState("ACME");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));

  const [lines, setLines] = useState<Line[]>([]);
  const [creating, setCreating] = useState(false);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  const catById = useMemo(() => new Map<number, any>(cats.map((c: any) => [c.id, c])), [cats]);
  const catName = (id: number | null | undefined) => (id ? (catById.get(id)?.name ?? String(id)) : "-");

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomByCode = useMemo(() => new Map<string, any>(uoms.map((u: any) => [up(u.code), u])), [uoms]);
  const uomCatCodeById = useMemo(() => new Map<number, string>(uomCats.map((c: any) => [c.id, up(c.code)])), [uomCats]);
  const uomCodeById = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "-");

  function uomCategoryCodeByUomCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const u = uomByCode.get(up(code));
    if (!u) return null;
    return uomCatCodeById.get(u.category) ?? null;
  }

  function pickUomCodeForCategory(categoryCode: string | null | undefined): string | null {
    if (!categoryCode) return null;
    const cc = up(categoryCode);
    const inCategory = uoms.filter((u: any) => up(uomCatCodeById.get(u.category)) === cc);
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

  function itemPostingUomCode(it: any): string | null {
    const id = it?.policy?.posting_uom;
    if (typeof id === "number") return uomCodeById(id);
    return null;
  }

  async function loadRefs() {
    if (!token) return;
    setErr(null);

    try {
      const [it, u, uc, c] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
      ]);

      setItems(it ?? []);
      setUoms(u ?? []);
      setUomCats(uc ?? []);
      setCats(c ?? []);

      if (lines.length === 0) {
        const firstItem = (it ?? [])[0]?.id ?? null;
        setLines([{ key: uid(), item_id: firstItem, qty: "1", uom_code: "KG" }]);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    loadRefs();
    // eslint-disable-next-line
  }, [token]);

  const uomOptions = useMemo(() => (uoms ?? []).map((u: any) => u.code), [uoms]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    const firstItem = items[0]?.id ?? null;
    setLines((prev) => [...prev, { key: uid(), item_id: firstItem, qty: "1", uom_code: "KG" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function setLineItem(idx: number, itemId: number) {
    const it = items.find((x: any) => x.id === itemId);
    const posting = itemPostingUomCode(it);
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const nextUom = l.uom_code === "KG" && posting ? posting : l.uom_code;
        return { ...l, item_id: itemId, uom_code: nextUom };
      })
    );
  }

  function suggestRuleUrl(args: {
    item: any;
    fromCode: string;
    toCode?: string | null;
    ruleType?: string | null;
    fromCategory?: string | null;
    toCategory?: string | null;
  }): string {
    const from = up(args.fromCode);
    const to = up(args.toCode ?? itemPostingUomCode(args.item) ?? "KG");

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

  async function checkLine(line: Line) {
    if (!token) return;
    if (!line.item_id || !line.uom_code) return;

    const it = items.find((x: any) => x.id === line.item_id);
    const posting = itemPostingUomCode(it);

    if (posting && up(posting) === up(line.uom_code)) {
      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: "ok",
          message: `OK: ЕИ совпадает с хранением (${up(posting)})`,
        },
      }));
      return;
    }

    setChecks((m) => ({ ...m, [line.key]: { state: "checking" } }));

    try {
      const res = await requestJson<any>({
        method: "POST",
        url: `/conversion/api/v1/convert`,
        token,
        body: {
          item_id: line.item_id,
          qty: "1",
          from_uom: line.uom_code,
          uom_code: line.uom_code,
          context: {},
        },
      });

      const resultUom = up(res?.to?.uom ?? res?.posting_uom_code);
      const resultQty = String(res?.to?.qty ?? res?.posting_qty ?? "");
      const ok = posting ? resultUom === up(posting) : true;

      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: ok ? "ok" : "mismatch",
          message: ok
            ? `OK: 1 ${up(line.uom_code)} -> ${resultQty} ${resultUom}`
            : `Есть конвертация, но итоговая ЕИ (${resultUom}) не совпадает с оприходованием (${up(posting)}).`,
          suggestedUrl: ok
            ? undefined
            : (it
              ? suggestRuleUrl({ item: it, fromCode: line.uom_code, toCode: posting })
              : undefined),
        },
      }));
    } catch (e: any) {
      const parsed = parseConvertError(e);

      let message = "Нет подходящего правила для перевода. Нужно создать правило.";
      let suggestedUrl = it ? suggestRuleUrl({ item: it, fromCode: line.uom_code, toCode: posting }) : undefined;

      if (parsed) {
        const steps = parsed.suggestedSteps;

        if (steps.length > 0) {
          const first = steps[0];
          const fromCodeForStep = pickUomCodeForCategory(first.from_category) ?? up(line.uom_code);
          const toCodeForStep = pickUomCodeForCategory(first.to_category) ?? up(posting ?? "KG");

          if (it) {
            suggestedUrl = suggestRuleUrl({
              item: it,
              fromCode: fromCodeForStep,
              toCode: toCodeForStep,
              ruleType: first.rule_type ?? null,
              fromCategory: first.from_category ?? null,
              toCategory: first.to_category ?? null,
            });
          }

          const stepsText = steps
            .map((s: SuggestedRuleStep) => {
              const num = s.step ?? "?";
              const pair = `${s.from_category ?? "?"} -> ${s.to_category ?? "?"}`;
              const rule = s.rule_type ?? "rule";
              const param = s.required_param ? `, ${s.required_param}=${s.example_param_value ?? "..."}` : "";
              return `${num}) ${pair}, ${rule}${param}`;
            })
            .join("; ");

          message = `${parsed.message ?? message}. Шаги: ${stepsText}`;
        } else if (parsed.message) {
          message = parsed.message;
        }
      }

      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: "missing",
          message,
          suggestedUrl,
        },
      }));
    }
  }

  const signature = useMemo(
    () => lines.map((l) => `${l.key}:${l.item_id ?? ""}:${l.uom_code}`).join("|"),
    [lines]
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      for (const l of lines) {
        if (cancelled) return;
        if (!l.item_id || !l.uom_code) continue;
        await checkLine(l);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, signature, items, uoms, uomCats]);

  const exampleRow = useMemo(() => {
    const l = lines[0];
    const it = items.find((x: any) => x.id === l?.item_id);
    const name = it?.name ?? "-";
    const cat = it?.category ? catName(it.category) : "-";
    const posting = itemPostingUomCode(it) ?? "-";
    return { name, cat, posting };
  }, [lines, items, cats]);

  async function create() {
    if (!token) {
      setErr("Нет токена авторизации (перелогиньтесь).");
      return;
    }

    const bad = lines.filter((l) => {
      const st = checks[l.key]?.state;
      return st === "missing" || st === "mismatch";
    });

    if (bad.length > 0) {
      setErr("Нельзя создать накладную: для одной или нескольких строк нет подходящего правила (или итоговая ЕИ не совпадает с хранением). Создайте правила и попробуйте снова.");
      return;
    }

    setCreating(true);
    setErr(null);

    const cleanLines = lines
      .map((l, idx) => {
        const it = items.find((x: any) => x.id === l.item_id);
        return {
          line_no: idx + 1,
          item_id: l.item_id,
          qty: l.qty,
          uom_code: l.uom_code,
          context: {
            item_name: it?.name ?? "",
          },
        };
      })
      .filter((l) => !!l.item_id && !!l.qty && !!l.uom_code);

    if (cleanLines.length === 0) {
      setErr("Добавьте хотя бы одну строку с товаром и количеством.");
      setCreating(false);
      return;
    }

    try {
      const created = await requestJson<any>({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/`,
        token,
        body: { number, supplier, doc_date: docDate, lines: cleanLines },
      });
      nav(`/invoices/${created.id}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setCreating(false);
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="Создание накладной"
        subtitle="При заполнении строк показываем, есть ли правило для перевода. Если ЕИ уже совпадает с хранением, это OK."
        right={<button className="btn" onClick={() => nav("/")}>Отмена</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label>
            <small>Номер</small><br />
            <input value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label>
            <small>Поставщик</small><br />
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </label>
          <label>
            <small>Дата</small><br />
            <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </label>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={loadRefs}>Обновить справочники</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h4 style={{ margin: 0 }}>Строки</h4>
          <button className="btn" onClick={addLine}>+ Добавить строку</button>
        </div>

        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Товар</th>
              <th>Кол-во</th>
              <th>ЕИ (в документе)</th>
              <th>Правило</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const ch = checks[l.key];
              return (
                <tr key={l.key}>
                  <td>{idx + 1}</td>
                  <td>
                    <select value={l.item_id ?? ""} onChange={(e) => setLineItem(idx, Number(e.target.value))}>
                      {items.map((it: any) => (
                        <option key={it.id} value={it.id}>
                          {it.name} - {catName(it.category)} (хранение: {itemPostingUomCode(it) ?? "-"})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={l.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                  </td>
                  <td>
                    <select value={l.uom_code} onChange={(e) => updateLine(idx, { uom_code: e.target.value })}>
                      {uomOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td>
                    {!ch || ch.state === "checking" || ch.state === "idle" ? (
                      <small>Проверяю...</small>
                    ) : ch.state === "ok" ? (
                      <div>
                        <span className="badge">OK</span>
                        {ch.message ? <div><small>{ch.message}</small></div> : null}
                      </div>
                    ) : ch.state === "mismatch" ? (
                      <div>
                        <div className="row" style={{ gap: 8, justifyContent: "flex-start" }}>
                          <span className="badge">не совпадает ЕИ</span>
                          {ch.suggestedUrl ? (
                            <button className="btn" onClick={() => ch.suggestedUrl && nav(ch.suggestedUrl)}>Создать правило</button>
                          ) : null}
                        </div>
                        {ch.message ? <div><small>{ch.message}</small></div> : null}
                      </div>
                    ) : (
                      <div>
                        <div className="row" style={{ gap: 8, justifyContent: "flex-start" }}>
                          <span className="badge">нет правила</span>
                          {ch.suggestedUrl ? (
                            <button className="btn" onClick={() => ch.suggestedUrl && nav(ch.suggestedUrl)}>Создать правило</button>
                          ) : null}
                        </div>
                        {ch.message ? <div><small>{ch.message}</small></div> : null}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>Удалить</button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr><td colSpan={6}><small>Нет строк. Добавьте строку.</small></td></tr>
            ) : null}
          </tbody>
        </table>

        <div style={{ marginTop: 10 }}>
          <small>Пример товара (подсказка):</small><br />
            <span className="badge">{exampleRow.name} - {exampleRow.cat} → хранение: {exampleRow.posting}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/")}>Отмена</button>
          <button className="btn primary" onClick={create} disabled={creating}>
            {creating ? "Создаю..." : "Создать накладную"}
          </button>
        </div>
      </div>
    </div>
  );
}
