import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiPackageCreatePage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [uomCats, setUomCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [itemId, setItemId] = useState<number | null>(null);
  const [packageUom, setPackageUom] = useState<number | null>(null);
  const [contentUom, setContentUom] = useState<number | null>(null);
  const [qty, setQty] = useState("25");
  const [status, setStatus] = useState<"active" | "draft">("active");

  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const uomCatCode = (catId: number) => uomCatsById.get(catId)?.code ?? "—";

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  async function load() {
    if (!token) return;
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

      const firstItem = (it ?? [])[0];
      if (firstItem && itemId === null) setItemId(firstItem.id);

      const bag = (u ?? []).find((x: any) => x.code === "BAG") ?? (u ?? [])[0];
      const kg = (u ?? []).find((x: any) => x.code === "KG") ?? (u ?? [])[0];
      if (bag && packageUom === null) setPackageUom(bag.id);
      if (kg && contentUom === null) setContentUom(kg.id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function create() {
    if (!token) return;
    if (!itemId || !packageUom || !contentUom) { setErr("Заполните все поля."); return; }
    if (toNum(qty) <= 0) { setErr("Количество должно быть > 0."); return; }

    setErr(null);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/`,
        token,
        body: {
          item: itemId,
          package_uom: packageUom,
          content_uom: contentUom,
          content_qty: qty,
          status,
        },
      });
      nav("/nsi/packages");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const pkgUoms = useMemo(() => uoms.filter((u: any) => uomCatCode(u.category) === "COUNT"), [uoms, uomCatsById]);
  const contentUoms = useMemo(() => uoms.filter((u: any) => uomCatCode(u.category) === "MASS"), [uoms, uomCatsById]);

  return (
    <div className="card">
      <PageHeader
        title="Создание упаковки"
        subtitle="Фасовка для конкретной номенклатуры: 1 BAG = 25 KG и т.п."
        right={<button className="btn" onClick={() => nav("/nsi/packages")}>Отмена</button>}
      />
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1 }}>
            <small>Номенклатура</small><br />
            <select value={itemId ?? ""} onChange={(e) => setItemId(toNum(e.target.value))} style={{ width: "100%" }}>
              {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
          </label>
          <label>
            <small>Упаковка</small><br />
            <select value={packageUom ?? ""} onChange={(e) => setPackageUom(toNum(e.target.value))}>
              {pkgUoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </label>
          <label>
            <small>Кол-во</small><br />
            <input value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label>
            <small>Содержимое</small><br />
            <select value={contentUom ?? ""} onChange={(e) => setContentUom(toNum(e.target.value))}>
              {contentUoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </label>
          <label>
            <small>Статус</small><br />
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">active</option>
              <option value="draft">draft</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">1 {uomCode(packageUom)} = {qty} {uomCode(contentUom)}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/packages")}>Отмена</button>
          <button className="btn primary" onClick={create}>Создать</button>
        </div>
      </div>
    </div>
  );
}
