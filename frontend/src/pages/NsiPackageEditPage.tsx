import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiPackageEditPage() {
  const { id } = useParams();
  const packageId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [uomCats, setUomCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [itemId, setItemId] = useState<number | null>(null);
  const [packageUom, setPackageUom] = useState<number | null>(null);
  const [contentUom, setContentUom] = useState<number | null>(null);
  const [qty, setQty] = useState("25");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");

  const [supplierCode, setSupplierCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [effectiveTo, setEffectiveTo] = useState<string | null>(null);

  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const uomCatCode = (catId: number) => uomCatsById.get(catId)?.code ?? "—";

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  const pkgUoms = useMemo(() => uoms.filter((u: any) => uomCatCode(u.category) === "COUNT"), [uoms, uomCatsById]);
  const contentUoms = useMemo(() => uoms.filter((u: any) => uomCatCode(u.category) === "MASS"), [uoms, uomCatsById]);

  async function load() {
    if (!token) return;
    if (!Number.isFinite(packageId)) {
      setErr("Некорректный ID упаковки.");
      return;
    }
    setErr(null);
    try {
      const [it, u, uc, p] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/${packageId}/`, token }),
      ]);
      setItems(it ?? []);
      setUoms(u ?? []);
      setUomCats(uc ?? []);

      setItemId(p.item ?? null);
      setPackageUom(p.package_uom ?? null);
      setContentUom(p.content_uom ?? null);
      setQty(String(p.content_qty ?? "25"));
      setStatus((p.status ?? "active") as any);
      setSupplierCode(String(p.supplier_code ?? ""));
      setBarcode(String(p.barcode ?? ""));
      setEffectiveFrom(p.effective_from ? String(p.effective_from) : null);
      setEffectiveTo(p.effective_to ? String(p.effective_to) : null);
      setLoaded(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, packageId]);

  async function save() {
    if (!token) return;
    if (!Number.isFinite(packageId)) { setErr("Некорректный ID упаковки."); return; }
    if (!itemId || !packageUom || !contentUom) { setErr("Заполните все поля."); return; }
    if (toNum(qty) <= 0) { setErr("Количество должно быть > 0."); return; }

    setErr(null);
    try {
      await requestJson({
        method: "PUT",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/${packageId}/`,
        token,
        body: {
          item: itemId,
          package_uom: packageUom,
          content_uom: contentUom,
          content_qty: qty,
          status,
          supplier_code: supplierCode,
          barcode,
          effective_from: effectiveFrom ?? null,
          effective_to: effectiveTo ?? null,
        },
      });
      nav("/nsi/packages");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function remove() {
    if (!token) return;
    if (!Number.isFinite(packageId)) { setErr("Некорректный ID упаковки."); return; }
    if (!confirm("Удалить упаковку?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/${packageId}/`,
        token,
      });
      nav("/nsi/packages");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title={`Редактирование упаковки #${packageId}`}
        subtitle="Фасовка для конкретной номенклатуры: 1 BAG = 25 KG и т.п."
        right={<button className="btn" onClick={() => nav("/nsi/packages")}>Отмена</button>}
      />
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!loaded ? <div style={{ padding: 8 }}>Загрузка...</div> : null}

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
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">1 {uomCode(packageUom)} = {qty} {uomCode(contentUom)}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/packages")}>Отмена</button>
          <button className="btn primary" onClick={save}>Сохранить</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={remove}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
