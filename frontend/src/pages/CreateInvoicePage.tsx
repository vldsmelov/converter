import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, requestJson, unwrapList } from "../api/request";
import ItemLookup from "../components/ItemLookup";
import TextLookup from "../components/TextLookup";
import PageHeader from "../components/PageHeader";
import { ruleParamLabel, ruleTypeLabel, uomCategoryLabel } from "../lib/ruLabels";
import type {
  ConvertResponseDto,
  NsiCounterpartyDto,
  NsiItemCategoryDto,
  NsiItemDto,
  NsiRuleDto,
  NsiUomCategoryDto,
  NsiUomDto,
} from "../types/api";

type Line = {
  key: string;
  item_id: number | null;
  qty: string;
  uom_code: string;
  to_uom_code: string;
  supplier_code: string;
  note: string;
};

type LineDraft = Omit<Line, "key">;

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

type CreateInvoiceResponse = { id: number };

function randNo() {
  return `НК-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function up(s: unknown) {
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

  const [items, setItems] = useState<NsiItemDto[]>([]);
  const [uoms, setUoms] = useState<NsiUomDto[]>([]);
  const [uomCats, setUomCats] = useState<NsiUomCategoryDto[]>([]);
  const [cats, setCats] = useState<NsiItemCategoryDto[]>([]);
  const [counterparties, setCounterparties] = useState<NsiCounterpartyDto[]>([]);
  const [itemRuleSuppliers, setItemRuleSuppliers] = useState<Record<number, string[]>>({});
  const [err, setErr] = useState<string | null>(null);

  const [number, setNumber] = useState(randNo());
  const [supplier, setSupplier] = useState("ACME");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));

  const [lines, setLines] = useState<Line[]>([]);
  const [creating, setCreating] = useState(false);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [editor, setEditor] = useState<LineDraft>({
    item_id: null,
    qty: "1",
    uom_code: "KG",
    to_uom_code: "KG",
    supplier_code: "",
    note: "",
  });

  const catById = useMemo(() => new Map<number, NsiItemCategoryDto>(cats.map((c) => [c.id, c])), [cats]);
  const catName = useCallback((id: number | null | undefined) => (id ? (catById.get(id)?.name ?? String(id)) : "-"), [catById]);

  const uomById = useMemo(() => new Map<number, NsiUomDto>(uoms.map((u) => [u.id, u])), [uoms]);
  const uomByCode = useMemo(() => new Map<string, NsiUomDto>(uoms.map((u) => [up(u.code), u])), [uoms]);
  const uomCatCodeById = useMemo(() => new Map<number, string>(uomCats.map((c) => [c.id, up(c.code)])), [uomCats]);
  const uomCodeById = useCallback((id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "-"), [uomById]);
  const uomOptions = useMemo(
    () => (uoms ?? []).map((u) => ({ code: up(u.code), label: `${String(u.name ?? u.code)} (${up(u.code)})` })),
    [uoms]
  );
  const counterpartyNames = useMemo(
    () => (counterparties ?? [])
      .map((x) => String(x?.name ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ru")),
    [counterparties]
  );

  const uomLabelByCode = (code: string | null | undefined) => {
    const normalized = up(code);
    const u = uomByCode.get(normalized);
    if (!u) return normalized || "-";
    return `${String(u.name ?? u.code)} (${normalized})`;
  };

  function uomCategoryCodeByUomCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const u = uomByCode.get(up(code));
    if (!u) return null;
    return uomCatCodeById.get(u.category) ?? null;
  }

  function pickUomCodeForCategory(categoryCode: string | null | undefined): string | null {
    if (!categoryCode) return null;
    const cc = up(categoryCode);
    const inCategory = uoms.filter((u) => up(uomCatCodeById.get(u.category)) === cc);
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
      const preferred = inCategory.find((u) => up(u.code) === preferredCode);
      if (preferred) return up(preferred.code);
    }

    return up(inCategory[0].code);
  }

  const itemPostingUomCode = useCallback((it: NsiItemDto | null | undefined): string | null => {
    const id = it?.policy?.posting_uom;
    if (typeof id === "number") return uomCodeById(id);
    return null;
  }, [uomCodeById]);

  const supplierOptionsForItem = useCallback((itemId: number | null): string[] => {
    const bag = new Set<string>();
    if (!itemId) return [];

    for (const s of (itemRuleSuppliers[itemId] ?? [])) {
      const v = String(s ?? "").trim();
      if (v) bag.add(v.toLowerCase());
    }

    const it = items.find((x) => x.id === itemId);
    const packages = Array.isArray(it?.packages) ? it.packages : [];
    for (const p of packages) {
      const v = String(p?.supplier_code ?? "").trim();
      if (v) bag.add(v.toLowerCase());
    }

    for (const s of counterpartyNames) {
      bag.add(String(s).trim().toLowerCase());
    }

    const values = Array.from(bag)
      .map((s) => {
        const foundCounterparty = counterpartyNames.find((name) => name.toLowerCase() === s);
        if (foundCounterparty) return foundCounterparty;
        const fromRule = (itemRuleSuppliers[itemId] ?? []).find((name) => String(name).trim().toLowerCase() === s);
        if (fromRule) return fromRule;
        const fromPkg = packages
          .map((p) => String(p?.supplier_code ?? "").trim())
          .find((name: string) => name.toLowerCase() === s);
        return fromPkg ?? s;
      })
      .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ru"));
  }, [itemRuleSuppliers, items, counterpartyNames]);

  async function loadRefs() {
    if (!token) return;
    setErr(null);

    try {
      const [itRaw, uRaw, ucRaw, cRaw, cpRaw, rulesRaw] = await Promise.all([
        requestJson<unknown>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<unknown>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<unknown>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<unknown>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        requestJson<unknown>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/counterparties/?active=1`, token }).catch(() => []),
        requestJson<unknown>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/?status=active`, token }).catch(() => []),
      ]);

      const it = unwrapList<NsiItemDto>(itRaw);
      const u = unwrapList<NsiUomDto>(uRaw);
      const uc = unwrapList<NsiUomCategoryDto>(ucRaw);
      const c = unwrapList<NsiItemCategoryDto>(cRaw);
      const cps = unwrapList<NsiCounterpartyDto>(cpRaw);
      const rules = unwrapList<NsiRuleDto>(rulesRaw);

      const byItem = new Map<number, Set<string>>();
      for (const r of rules) {
        const itemId = Number(r?.item ?? 0);
        if (itemId <= 0) continue;
        const supplier = String((r?.conditions ?? {})["supplier_code"] ?? "").trim();
        if (!supplier) continue;
        if (!byItem.has(itemId)) byItem.set(itemId, new Set<string>());
        byItem.get(itemId)!.add(supplier);
      }
      const suppliersMap: Record<number, string[]> = {};
      for (const [itemId, names] of byItem.entries()) {
        suppliersMap[itemId] = Array.from(names).sort((a, b) => a.localeCompare(b, "ru"));
      }

      setItems(it ?? []);
      setUoms(u ?? []);
      setUomCats(uc ?? []);
      setCats(c ?? []);
      setCounterparties(cps ?? []);
      setItemRuleSuppliers(suppliersMap);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    loadRefs();
    // eslint-disable-next-line
  }, [token]);

  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditorOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen]);

  function startAddLine() {
    setEditorIndex(null);
    setEditor({
      item_id: null,
      qty: "1",
      uom_code: "KG",
      to_uom_code: "KG",
      supplier_code: "",
      note: "",
    });
    setEditorOpen(true);
  }

  function startEditLine(idx: number) {
    const l = lines[idx];
    if (!l) return;
    setEditorIndex(idx);
    setEditor({
      item_id: l.item_id,
      qty: l.qty,
      uom_code: l.uom_code,
      to_uom_code: l.to_uom_code ?? "",
      supplier_code: l.supplier_code ?? "",
      note: l.note ?? "",
    });
    setEditorOpen(true);
  }

  function onEditorItemChange(itemId: number | null) {
    const it = items.find((x) => x.id === itemId);
    const posting = itemPostingUomCode(it);
    const supplierOptions = supplierOptionsForItem(itemId);
    setEditor((prev) => ({
      ...prev,
      item_id: itemId,
      uom_code: prev.uom_code === "KG" && posting ? posting : prev.uom_code,
      to_uom_code: posting ? posting : prev.to_uom_code,
      supplier_code: supplierOptions.some((x) => x === prev.supplier_code) ? prev.supplier_code : "",
    }));
  }

  async function saveEditorLine() {
    if (!editor.item_id) {
      setErr("Выберите номенклатуру для строки.");
      return;
    }
    if (Number(String(editor.qty).replace(",", ".")) <= 0) {
      setErr("Количество должно быть больше 0.");
      return;
    }
    if (!editor.to_uom_code) {
      setErr("Выберите итоговую ЕИ для строки.");
      return;
    }
    setErr(null);

    if (editorIndex === null) {
      setLines((prev) => [...prev, { key: uid(), ...editor }]);
    } else {
      setLines((prev) => prev.map((l, idx) => (idx === editorIndex ? { ...l, ...editor } : l)));
    }
    setEditorOpen(false);
  }

  function removeLine(idx: number) {
    const key = lines[idx]?.key;
    setLines((prev) => prev.filter((_, i) => i !== idx));
    if (key) {
      setChecks((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function suggestRuleUrl(args: {
    item: NsiItemDto;
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
    if (!line.item_id || !line.uom_code || !line.to_uom_code) return;

    const it = items.find((x) => x.id === line.item_id);
    const posting = itemPostingUomCode(it);
    const targetUom = up(line.to_uom_code || posting || "");

    if (targetUom && targetUom === up(line.uom_code)) {
      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: "ok",
          message: `Успешно: ЕИ источника совпадает с итоговой (${targetUom})`,
        },
      }));
      return;
    }

    setChecks((m) => ({ ...m, [line.key]: { state: "checking" } }));

    try {
      const requestContext: Record<string, unknown> = {};
      const supplierCode = line.supplier_code || undefined;
      if (supplierCode) requestContext.supplier_code = supplierCode;
      const res = await requestJson<ConvertResponseDto>({
        method: "POST",
        url: `/conversion/api/v1/convert`,
        token,
        body: {
          item_id: line.item_id,
          qty: "1",
          from_uom: line.uom_code,
          to_uom: targetUom || undefined,
          context: requestContext,
          supplier_code: supplierCode,
        },
      });

      const resultUom = up(res?.to?.uom ?? res?.posting_uom_code);
      const resultQty = String(res?.to?.qty ?? res?.posting_qty ?? "");
      const expectedUom = targetUom || up(posting ?? "");
      const ok = expectedUom ? resultUom === expectedUom : true;

      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: ok ? "ok" : "mismatch",
          message: ok
            ? `Успешно: 1 ${up(line.uom_code)} -> ${resultQty} ${resultUom}`
            : `Есть конвертация, но итоговая ЕИ (${resultUom}) не совпадает с выбранной (${expectedUom}).`,
          suggestedUrl: ok
            ? undefined
            : (it
              ? suggestRuleUrl({ item: it, fromCode: line.uom_code, toCode: expectedUom })
              : undefined),
        },
      }));
    } catch (e: unknown) {
      const parsed = parseConvertError(e);

      let message = "Нет подходящего правила для перевода. Нужно создать правило.";
      let suggestedUrl = it ? suggestRuleUrl({ item: it, fromCode: line.uom_code, toCode: targetUom || posting }) : undefined;

      if (parsed) {
        const steps = parsed.suggestedSteps;

        if (steps.length > 0) {
          const first = steps[0];
          const fromCodeForStep = pickUomCodeForCategory(first.from_category) ?? up(line.uom_code);
          const toCodeForStep = pickUomCodeForCategory(first.to_category) ?? up(targetUom || posting || "KG");

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
              const pair = `${uomCategoryLabel(s.from_category)} -> ${uomCategoryLabel(s.to_category)}`;
              const rule = ruleTypeLabel(s.rule_type);
              const param = s.required_param ? `, ${ruleParamLabel(s.required_param)}=${s.example_param_value ?? "..."}` : "";
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
    () => lines.map((l) => `${l.key}:${l.item_id ?? ""}:${l.uom_code}:${l.to_uom_code}:${l.supplier_code}`).join("|"),
    [lines]
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      for (const l of lines) {
        if (cancelled) return;
        if (!l.item_id || !l.uom_code || !l.to_uom_code) continue;
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
    const it = items.find((x) => x.id === l?.item_id);
    const name = it?.name ?? "-";
    const cat = it?.category ? catName(it.category) : "-";
    const posting = itemPostingUomCode(it) ?? "-";
    return { name, cat, posting };
  }, [lines, items, catName, itemPostingUomCode]);

  const editorSupplierOptions = useMemo(
    () => supplierOptionsForItem(editor.item_id),
    [editor.item_id, supplierOptionsForItem]
  );

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
      setErr("Нельзя создать накладную: для одной или нескольких строк нет подходящего правила (или итоговая ЕИ не совпадает с хранением).");
      return;
    }

    setCreating(true);
    setErr(null);

    const cleanLines = lines
      .map((l, idx) => {
        const it = items.find((x) => x.id === l.item_id);
        const context: Record<string, unknown> = {
          item_name: it?.name ?? "",
        };
        if ((l.note ?? "").trim()) {
          context.note = (l.note ?? "").trim();
        }

        return {
          line_no: idx + 1,
          item_id: l.item_id,
          qty: l.qty,
          uom_code: l.uom_code,
          to_uom_code: l.to_uom_code,
          context,
          supplier_code: l.supplier_code ?? "",
        };
      })
      .filter((l) => !!l.item_id && !!l.qty && !!l.uom_code && !!l.to_uom_code);

    if (cleanLines.length === 0) {
      setErr("Добавьте хотя бы одну строку с товаром и количеством.");
      setCreating(false);
      return;
    }

    try {
      const created = await requestJson<CreateInvoiceResponse>({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/`,
        token,
        body: { number, supplier, doc_date: docDate, lines: cleanLines },
      });
      nav(`/invoices/${created.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  return (
    <div className="card invoice-create-page">
      <PageHeader
        title="Создание накладной"
        subtitle="Табличная часть и проверка правил конвертации по строкам."
        right={<button className="btn" onClick={() => nav("/app")}>Отмена</button>}
      />

      {err && <div className="error-banner">{err}</div>}

      <div className="card invoice-create-meta" style={{ marginTop: 12 }}>
        <div className="invoice-create-meta-grid">
          <label className="field">
            <small>Номер</small>
            <input value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label className="field">
            <small>Поставщик</small>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </label>
          <label className="field">
            <small>Дата</small>
            <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </label>
          <div className="field invoice-create-refresh-field">
            <small>&nbsp;</small>
            <button className="btn" onClick={loadRefs}>Обновить справочники</button>
          </div>
        </div>
      </div>

      <div className="card invoice-create-lines-card" style={{ marginTop: 12 }}>
        <div className="row section-header">
          <h4 className="section-title">Табличная часть</h4>
          <button className="btn" onClick={startAddLine}>+ Добавить номенклатуру</button>
        </div>

        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="compact-table invoice-entry-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Номенклатура</th>
                <th>Кол-во</th>
                <th>Входящая ЕИ</th>
                <th>Итоговая ЕИ</th>
                <th>Вариант перевода</th>
                <th>Проверка</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const ch = checks[l.key];
                const it = items.find((x) => x.id === l.item_id);
                return (
                  <tr key={l.key}>
                    <td>{idx + 1}</td>
                    <td>
                      <div>{it?.name ?? "-"}</div>
                      <small>
                        {catName(it?.category)} | хранение: {itemPostingUomCode(it) ?? "-"}
                      </small>
                    </td>
                    <td className="num">{l.qty}</td>
                    <td>{uomLabelByCode(l.uom_code)}</td>
                    <td>{uomLabelByCode(l.to_uom_code)}</td>
                    <td>{l.supplier_code || "-"}</td>
                    <td>
                      {!ch || ch.state === "checking" || ch.state === "idle" ? (
                        <small>Проверяю...</small>
                      ) : ch.state === "ok" ? (
                        <div>
                          <span className="badge status-ok">Успешно</span>
                          {ch.message ? <div><small>{ch.message}</small></div> : null}
                        </div>
                      ) : ch.state === "mismatch" ? (
                        <div>
                          <div className="row" style={{ gap: 8, justifyContent: "flex-start" }}>
                            <span className="badge status-warn">не совпадает ЕИ</span>
                            {ch.suggestedUrl ? (
                              <button className="btn btn-tight" onClick={() => ch.suggestedUrl && nav(ch.suggestedUrl)}>Создать правило</button>
                            ) : null}
                          </div>
                          {ch.message ? <div><small>{ch.message}</small></div> : null}
                        </div>
                      ) : (
                        <div>
                          <div className="row" style={{ gap: 8, justifyContent: "flex-start" }}>
                            <span className="badge status-bad">нет правила</span>
                            {ch.suggestedUrl ? (
                              <button className="btn btn-tight" onClick={() => ch.suggestedUrl && nav(ch.suggestedUrl)}>Создать правило</button>
                            ) : null}
                          </div>
                          {ch.message ? <div><small>{ch.message}</small></div> : null}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-tight" onClick={() => startEditLine(idx)} style={{ marginRight: 6 }}>Изменить</button>
                      <button className="btn btn-tight" onClick={() => removeLine(idx)}>Удалить</button>
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 ? (
                <tr><td colSpan={8} className="empty-row"><small>Пока нет строк. Добавьте номенклатурную позицию.</small></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Подсказка по первой строке:</small>
          <div style={{ marginTop: 4 }}>
          <span className="badge">{exampleRow.name} - {exampleRow.cat} → хранение: {exampleRow.posting}</span>
          </div>
        </div>

        <div className="row invoice-create-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/app")}>Отмена</button>
          <button className="btn primary" onClick={create} disabled={creating}>
            {creating ? "Создаю..." : "Создать накладную"}
          </button>
        </div>
      </div>

      {editorOpen && (
        <div className="modal-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>{editorIndex === null ? "Добавление позиции" : "Редактирование позиции"}</h4>
              <button className="btn btn-tight" onClick={() => setEditorOpen(false)}>Закрыть</button>
            </div>

            <div className="modal-grid">
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <small>Номенклатура</small>
                <ItemLookup token={token} value={editor.item_id} onChange={(item) => onEditorItemChange(item?.id ?? null)} />
              </label>

              <label className="field">
                <small>Количество</small>
                <input value={editor.qty} onChange={(e) => setEditor((v) => ({ ...v, qty: e.target.value }))} />
              </label>

              <label className="field">
                <small>ЕИ документа</small>
                <select value={editor.uom_code} onChange={(e) => setEditor((v) => ({ ...v, uom_code: up(e.target.value) }))}>
                  {uomOptions.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
                </select>
              </label>

              <label className="field">
                <small>Итоговая ЕИ</small>
                <select value={editor.to_uom_code} onChange={(e) => setEditor((v) => ({ ...v, to_uom_code: up(e.target.value) }))}>
                  {uomOptions.map((u) => <option key={`to-${u.code}`} value={u.code}>{u.label}</option>)}
                </select>
              </label>

              <label className="field">
                <small>Вариант перевода (контрагент)</small>
                <TextLookup
                  value={editor.supplier_code}
                  onChange={(value) => setEditor((v) => ({ ...v, supplier_code: value }))}
                  options={editorSupplierOptions}
                  placeholder="по умолчанию"
                  emptyText="Контрагенты не найдены"
                />
              </label>

              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <small>Комментарий (доп. реквизит)</small>
                <input value={editor.note} onChange={(e) => setEditor((v) => ({ ...v, note: e.target.value }))} />
              </label>
            </div>

            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setEditorOpen(false)}>Отмена</button>
              <button className="btn primary" onClick={() => void saveEditorLine()}>
                {editorIndex === null ? "Добавить позицию" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
