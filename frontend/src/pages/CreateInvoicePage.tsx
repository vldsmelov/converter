import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

type Item = any;
type Uom = any;
type Cat = any;

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

function randNo() {
  return `НК-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function up(s: any) {
  return String(s ?? "").toUpperCase();
}

export default function CreateInvoicePage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [number, setNumber] = useState(randNo());
  const [supplier, setSupplier] = useState("ACME");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));

  const [lines, setLines] = useState<Line[]>([]);
  const [creating, setCreating] = useState(false);

  const [checks, setChecks] = useState<Record<string, Check>>({});

  const catById = useMemo(() => new Map<number, any>(cats.map((c: any) => [c.id, c])), [cats]);
  const catName = (id: number | null | undefined) => (id ? (catById.get(id)?.name ?? String(id)) : "—");

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCodeById = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  function itemPostingUomCode(it: any): string | null {
    const id = it?.policy?.posting_uom;
    if (typeof id === "number") return uomCodeById(id);
    return null;
  }

  async function loadRefs() {
    if (!token) return;
    setErr(null);
    try {
      const [it, u, c] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
      ]);
      setItems(it ?? []);
      setUoms(u ?? []);
      setCats(c ?? []);

      if (lines.length === 0) {
        const firstItem = (it ?? [])[0]?.id ?? null;
        setLines([{ key: uid(), item_id: firstItem, qty: "1", uom_code: "KG" }]);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { loadRefs(); /* eslint-disable-next-line */ }, [token]);

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
        const nextUom = (l.uom_code === "KG" && posting) ? posting : l.uom_code;
        return { ...l, item_id: itemId, uom_code: nextUom };
      })
    );
  }

  function suggestRuleUrl(args: { item: any; fromCode: string }): string {
    const posting = itemPostingUomCode(args.item) ?? "KG";
    const from = up(args.fromCode);
    const to = up(posting);

    // Heuristic:
    // - if storage unit is PCS -> item-level weight rule is the most probable (KG->PCS)
    // - BAG/BOX typically means "упаковка" at category level
    // - PCS as input also points to item weight (PCS->KG)
    // - otherwise -> global
    let scope = "global";
    if (to === "PCS") scope = "item";
    if (from === "PCS") scope = "item";
    if (from === "BAG" || from === "BOX") scope = "category";

    const qs = new URLSearchParams();
    qs.set("scope", scope);
    qs.set("from", from);
    qs.set("to", to);
    if (args.item?.category) qs.set("category_id", String(args.item.category));
    if (args.item?.id) qs.set("item_id", String(args.item.id));
    return `/nsi/rules/new?${qs.toString()}`;
  }

  async function checkLine(line: Line) {
    if (!token) return;
    if (!line.item_id || !line.uom_code) return;

    const it = items.find((x: any) => x.id === line.item_id);
    const posting = itemPostingUomCode(it);

    // Short-circuit: if incoming UoM already equals posting UoM => rule not needed
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
          uom_code: line.uom_code, // backward compat
          context: {},
        },
      });

      const resultUom = up(res?.posting_uom_code);
      const ok = posting ? (resultUom === up(posting)) : true;

      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: ok ? "ok" : "mismatch",
          message: ok
            ? `OK: 1 ${up(line.uom_code)} → ${res.posting_qty} ${up(res.posting_uom_code)}`
            : `Есть конвертация, но итоговая ЕИ (${up(res.posting_uom_code)}) ≠ оприходованию (${up(posting)}).`,
          suggestedUrl: ok ? undefined : (it ? suggestRuleUrl({ item: it, fromCode: line.uom_code }) : undefined),
        },
      }));
    } catch {
      setChecks((m) => ({
        ...m,
        [line.key]: {
          state: "missing",
          message: "Нет подходящего правила для перевода. Нужно создать правило.",
          suggestedUrl: it ? suggestRuleUrl({ item: it, fromCode: line.uom_code }) : undefined,
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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, signature, items, uoms]);

  const exampleRow = useMemo(() => {
    const l = lines[0];
    const it = items.find((x: any) => x.id === l?.item_id);
    const name = it?.name ?? "—";
    const cat = it?.category ? catName(it.category) : "—";
    const posting = itemPostingUomCode(it) ?? "—";
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
      .map((l, idx) => ({
        line_no: idx + 1,
        item_id: l.item_id,
        qty: l.qty,
        uom_code: l.uom_code,
        context: {},
      }))
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
        subtitle="При заполнении строк показываем, есть ли правило для перевода. Если ЕИ уже совпадает с хранением — это OK."
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
              const it = items.find((x: any) => x.id === l.item_id);
              const ch = checks[l.key];
              return (
                <tr key={l.key}>
                  <td>{idx + 1}</td>
                  <td>
                    <select value={l.item_id ?? ""} onChange={(e) => setLineItem(idx, Number(e.target.value))}>
                      {items.map((it: any) => (
                        <option key={it.id} value={it.id}>
                          {it.name} — {catName(it.category)} (хранение: {itemPostingUomCode(it) ?? "—"})
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
                      <small>Проверяю…</small>
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
                            <button className="btn" onClick={() => nav(ch.suggestedUrl)}>Создать правило</button>
                          ) : null}
                        </div>
                        {ch.message ? <div><small>{ch.message}</small></div> : null}
                      </div>
                    ) : (
                      <div>
                        <div className="row" style={{ gap: 8, justifyContent: "flex-start" }}>
                          <span className="badge">нет правила</span>
                          {ch.suggestedUrl ? (
                            <button className="btn" onClick={() => nav(ch.suggestedUrl)}>Создать правило</button>
                          ) : null}
                        </div>
                        {ch.message ? <div><small>{ch.message}</small></div> : null}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      Удалить
                    </button>
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
          <span className="badge">{exampleRow.name} — {exampleRow.cat} → хранение: {exampleRow.posting}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/")}>Отмена</button>
          <button className="btn primary" onClick={create} disabled={creating}>
            {creating ? "Создаю…" : "Создать накладную"}
          </button>
        </div>
      </div>
    </div>
  );
}
