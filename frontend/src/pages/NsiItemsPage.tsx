import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { jsonErr, toNum } from "./nsi_utils";
import { requestJson } from "../api/request";

export default function NsiItemsPage() {
  const { nsi } = useApi();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [sku, setSku] = useState("SKU-NEW");
  const [name, setName] = useState("Новый товар");
  const [postingUom, setPostingUom] = useState<number | null>(null);
  const [allowFractional, setAllowFractional] = useState(true);
  const [roundingPrecision, setRoundingPrecision] = useState(3);

  async function load() {
    setErr(null);

    const u = await nsi.GET("/api/v1/uoms/");
    if (u.error) { setErr("Единицы: " + jsonErr(u.error)); return; }
    const uarr = (u.data as any) ?? [];
    setUoms(uarr);
    const kg = uarr.find((x: any) => x.code === "KG") ?? uarr[0];
    if (kg && postingUom === null) setPostingUom(kg.id);

    const r = await nsi.GET("/api/v1/items/");
    if (r.error) { setErr("Товары: " + jsonErr(r.error)); return; }
    setItems((r.data as any) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const uomCode = useMemo(() => {
    const m = new Map(uoms.map((u: any) => [u.id, u.code]));
    return (id: number) => m.get(id) ?? id;
  }, [uoms]);

  async function create() {
    if (!token) { setErr("Нет токена авторизации."); return; }
    if (!postingUom) return;
    setErr(null);

    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`,
        token,
        body: {
          sku,
          name,
          is_active: true,
          policy: {
            storage_uom: postingUom,
            posting_uom: postingUom,
            allow_fractional: allowFractional,
            rounding_precision: roundingPrecision,
          }
        },
      });
      setSku("");
      setName("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>НСИ: Номенклатура</h3>
        <button className="btn" onClick={load}>Обновить</button>
      </div>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="row" style={{ marginTop: 8 }}>
        <label><small>SKU</small><br />
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        <label style={{ flex: 1 }}><small>Название</small><br />
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label><small>ЕИ проводки</small><br />
          <select value={postingUom ?? ""} onChange={(e) => setPostingUom(toNum(e.target.value))}>
            {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </label>
        <label><small>Округление</small><br />
          <input type="number" value={roundingPrecision} onChange={(e) => setRoundingPrecision(toNum(e.target.value))} />
        </label>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={allowFractional} onChange={(e) => setAllowFractional(e.target.checked)} />
          <small>дробные</small>
        </label>
        <button className="btn primary" onClick={create}>Добавить</button>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th><th>SKU</th><th>Название</th><th>ЕИ проводки</th><th>Активен</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any) => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.sku}</td>
              <td>{it.name}</td>
              <td>{uomCode(it.policy?.posting_uom)}</td>
              <td>{String(it.is_active)}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5}><small>Пока нет товаров.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
