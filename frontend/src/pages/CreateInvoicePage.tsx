import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";

type Item = any;
type Uom = any;

type Line = {
  key: string;
  item_id: number | null;
  qty: string;
  uom_code: string;
};

function randNo() {
  return `НК-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function CreateInvoicePage() {
  const { nsi } = useApi();
  const { token } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);

  const [number, setNumber] = useState(randNo());
  const [supplier, setSupplier] = useState("ACME");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));

  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadRefs() {
    setErr(null);

    const it = await nsi.GET("/api/v1/items/");
    if (it.error) {
      setErr("Не удалось загрузить номенклатуру: " + JSON.stringify(it.error));
      return;
    }
    const iArr = (it.data as any) ?? [];
    setItems(iArr);

    const u = await nsi.GET("/api/v1/uoms/");
    if (u.error) {
      setErr("Не удалось загрузить ЕИ: " + JSON.stringify(u.error));
      return;
    }
    const uArr = (u.data as any) ?? [];
    setUoms(uArr);

    const demoItem = iArr.find((x: any) => (x.sku ?? "").includes("DEMO")) ?? iArr[0];
    const ton = uArr.find((x: any) => x.code === "TON") ?? uArr[0];
    const bag = uArr.find((x: any) => x.code === "BAG") ?? uArr[0];
    const pcs = uArr.find((x: any) => x.code === "PCS") ?? uArr[0];

    if (lines.length === 0) {
      setLines([
        { key: uid(), item_id: demoItem?.id ?? null, qty: "1.5", uom_code: ton?.code ?? "TON" },
        { key: uid(), item_id: demoItem?.id ?? null, qty: "2", uom_code: bag?.code ?? "BAG" },
        { key: uid(), item_id: demoItem?.id ?? null, qty: "10", uom_code: pcs?.code ?? "PCS" },
      ]);
    }
  }

  useEffect(() => { loadRefs(); /* eslint-disable-next-line */ }, []);

  const itemLabel = useMemo(() => {
    const m = new Map(items.map((i: any) => [i.id, `${i.sku} — ${i.name}`]));
    return (id: number | null) => (id ? (m.get(id) ?? String(id)) : "—");
  }, [items]);

  const uomOptions = useMemo(() => uoms.map((u: any) => u.code), [uoms]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    const firstItem = items[0]?.id ?? null;
    const firstUom = uomOptions[0] ?? "KG";
    setLines((prev) => [...prev, { key: uid(), item_id: firstItem, qty: "1", uom_code: firstUom }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function create() {
    if (!token) {
      setErr("Нет токена авторизации (перелогиньтесь).");
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

    const payload = { number, supplier, doc_date: docDate, lines: cleanLines };

    try {
      const created = await requestJson<any>({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/invoices/`,
        token,
        body: payload,
      });
      nav(`/invoices/${created.id}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setCreating(false);
      return;
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>Создать накладную</h3>
        <button className="btn" onClick={loadRefs}>Обновить справочники</button>
      </div>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="row" style={{ marginTop: 10, marginBottom: 12 }}>
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
      </div>

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
            <th>ЕИ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, idx) => (
            <tr key={l.key}>
              <td>{idx + 1}</td>
              <td>
                <select
                  value={l.item_id ?? ""}
                  onChange={(e) => updateLine(idx, { item_id: Number(e.target.value) })}
                >
                  {items.map((it: any) => (
                    <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <input value={l.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
              </td>
              <td>
                <select value={l.uom_code} onChange={(e) => updateLine(idx, { uom_code: e.target.value })}>
                  {uomOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="btn" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan={5}><small>Нет строк. Добавьте строку.</small></td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <small>Выбранные товары: {lines.map((l) => itemLabel(l.item_id)).join(" • ")}</small>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={create} disabled={creating}>
          {creating ? "Создаю…" : "Создать"}
        </button>
      </div>
    </div>
  );
}
