import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import ItemLookup from "../components/ItemLookup";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiPackageEditPage() {
  const { id } = useParams();
  const packageId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

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
  const uomCatCode = useCallback((catId: number) => uomCatsById.get(catId)?.code ?? "вЂ—", [uomCatsById]);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null) => (id ? (uomById.get(id)?.code ?? String(id)) : "вЂ”");

  const pkgUoms = useMemo(() => uoms.filter((u: any) => uomCatCode(u.category) === "COUNT"), [uoms, uomCatCode]);
  const contentUoms = useMemo(() => uoms.filter((u: any) => uomCatCode(u.category) === "MASS"), [uoms, uomCatCode]);

  const load = useCallback(async () => {
    if (!token) return;
    if (!Number.isFinite(packageId)) {
      setErr("РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID СѓРїР°РєРѕРІРєРё.");
      return;
    }
    setErr(null);
    try {
      const [u, uc, p] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/packages/${packageId}/`, token }),
      ]);
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
  }, [token, packageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token) return;
    if (!Number.isFinite(packageId)) { setErr("РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID СѓРїР°РєРѕРІРєРё."); return; }
    if (!itemId || !packageUom || !contentUom) { setErr("Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РїРѕР»СЏ."); return; }
    if (toNum(qty) <= 0) { setErr("РљРѕР»РёС‡РµСЃС‚РІРѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ > 0."); return; }

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
    if (!Number.isFinite(packageId)) { setErr("РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID СѓРїР°РєРѕРІРєРё."); return; }
    if (!confirm("РЈРґР°Р»РёС‚СЊ СѓРїР°РєРѕРІРєСѓ?")) return;
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
        subtitle="Р¤Р°СЃРѕРІРєР° РґР»СЏ РєРѕРЅРєСЂРµС‚РЅРѕР№ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹: 1 BAG = 25 KG Рё С‚.Рї."
        right={<button className="btn" onClick={() => nav("/nsi/packages")}>РћС‚РјРµРЅР°</button>}
      />
      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!loaded ? <div style={{ padding: 8 }}>Р—Р°РіСЂСѓР·РєР°...</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1 }}>
            <small>РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°</small><br />
            <ItemLookup token={token} value={itemId} onChange={(item) => setItemId(item?.id ?? null)} />
          </label>
          <label>
            <small>РЈРїР°РєРѕРІРєР°</small><br />
            <select value={packageUom ?? ""} onChange={(e) => setPackageUom(toNum(e.target.value))}>
              {pkgUoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </label>
          <label>
            <small>РљРѕР»-РІРѕ</small><br />
            <input value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label>
            <small>РЎРѕРґРµСЂР¶РёРјРѕРµ</small><br />
            <select value={contentUom ?? ""} onChange={(e) => setContentUom(toNum(e.target.value))}>
              {contentUoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </label>
          <label>
            <small>РЎС‚Р°С‚СѓСЃ</small><br />
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">РђРєС‚РёРІРЅС‹Р№</option>
              <option value="draft">Р§РµСЂРЅРѕРІРёРє</option>
              <option value="archived">РђСЂС…РёРІ</option>
            </select>
          </label>
          <label>
            <small>РџРѕСЃС‚Р°РІС‰РёРє (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)</small><br />
            <input
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              placeholder="РЅР°РїСЂРёРјРµСЂ: РљРѕРјРїР°РЅРёСЏ Рђ"
            />
          </label>
          <label>
            <small>РЁС‚СЂРёС…РєРѕРґ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)</small><br />
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </label>
          <label>
            <small>Р”РµР№СЃС‚РІСѓРµС‚ СЃ</small><br />
            <input
              type="date"
              value={effectiveFrom ?? ""}
              onChange={(e) => setEffectiveFrom(e.target.value || null)}
            />
          </label>
          <label>
            <small>Р”РµР№СЃС‚РІСѓРµС‚ РїРѕ</small><br />
            <input
              type="date"
              value={effectiveTo ?? ""}
              onChange={(e) => setEffectiveTo(e.target.value || null)}
            />
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>РџСЂРёРјРµСЂ:</small><br />
          <span className="badge">1 {uomCode(packageUom)} = {qty} {uomCode(contentUom)}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/packages")}>РћС‚РјРµРЅР°</button>
          <button className="btn primary" onClick={save}>РЎРѕС…СЂР°РЅРёС‚СЊ</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={remove}>РЈРґР°Р»РёС‚СЊ</button>
        </div>
      </div>
    </div>
  );
}


