import React, { useEffect, useMemo, useState } from "react";
import { useApi } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { jsonErr, toNum } from "./nsi_utils";
import { requestJson } from "../api/request";

export default function NsiPackagesPage() {
  const { nsi } = useApi();
  const { token } = useAuth();
  const [pkgs, setPkgs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [itemId, setItemId] = useState<number | null>(null);
  const [packageUom, setPackageUom] = useState<number | null>(null);
  const [contentUom, setContentUom] = useState<number | null>(null);
  const [contentQty, setContentQty] = useState("25");

  async function load() {
    setErr(null);

    const it = await nsi.GET("/api/v1/items/");
    if (it.error) { setErr("Товары: " + jsonErr(it.error)); return; }
    const iarr = (it.data as any) ?? [];
    setItems(iarr);
    const demo = iarr.find((x: any) => (x.sku ?? "").includes("DEMO")) ?? iarr[0];
    if (demo && itemId === null) setItemId(demo.id);

    const u = await nsi.GET("/api/v1/uoms/");
    if (u.error) { setErr("Единицы: " + jsonErr(u.error)); return; }
    const uarr = (u.data as any) ?? [];
    setUoms(uarr);
    const bag = uarr.find((x: any) => x.code === "BAG") ?? uarr[0];
    const kg = uarr.find((x: any) => x.code === "KG") ?? uarr[0];
    if (bag && packageUom === null) setPackageUom(bag.id);
    if (kg && contentUom === null) setContentUom(kg.id);

    const r = await nsi.GET("/api/v1/packages/");
    if (r.error) { setErr("Упаковки: " + jsonErr(r.error)); return; }
    setPkgs((r.data as any) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const itemSku = useMemo(() => {
    const m = new Map(items.map((i: any) => [i.id, i.sku]));
    return (id: number) => m.get(id) ?? id;
  }, [items]);

  const uomCode = useMemo(() => {
    const m = new Map(uoms.map((u: any) => [u.id, u.code]));
    return (id: number) => m.get(id) ?? id;
  }, [uoms]);

  async function create() {
    if (!token) { setErr("Нет токена авторизации."); return; }
    if (!itemId || !packageUom || !contentUom) return;
    setErr(null);

    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/`,
        token,
        body: { item: itemId, package_uom: packageUom, content_uom: contentUom, content_qty: contentQty, status: "active" },
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>НСИ: Упаковки</h3>
        <button className="btn" onClick={load}>Обновить</button>
      </div>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="row" style={{ marginTop: 8 }}>
        <label><small>Товар</small><br />
          <select value={itemId ?? ""} onChange={(e) => setItemId(toNum(e.target.value))}>
            {items.map((i: any) => <option key={i.id} value={i.id}>{i.sku}</option>)}
          </select>
        </label>
        <label><small>ЕИ упаковки</small><br />
          <select value={packageUom ?? ""} onChange={(e) => setPackageUom(toNum(e.target.value))}>
            {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </label>
        <label><small>ЕИ содержимого</small><br />
          <select value={contentUom ?? ""} onChange={(e) => setContentUom(toNum(e.target.value))}>
            {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </label>
        <label><small>Кол-во</small><br />
          <input value={contentQty} onChange={(e) => setContentQty(e.target.value)} />
        </label>
        <button className="btn primary" onClick={create}>Добавить</button>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th><th>Товар</th><th>Упаковка</th><th>Содержимое</th><th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {pkgs.map((p: any) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{itemSku(p.item)}</td>
              <td>1 {uomCode(p.package_uom)}</td>
              <td>{p.content_qty} {uomCode(p.content_uom)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
          {pkgs.length === 0 && <tr><td colSpan={5}><small>Пока нет упаковок.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
