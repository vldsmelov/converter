import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, requestJson } from "../api/request";
import ItemLookup from "../components/ItemLookup";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiPackageCreatePage() {
  const { token, keycloak } = useAuth();
  const nav = useNavigate();

  const [uoms, setUoms] = useState<any[]>([]);
  const [uomCats, setUomCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [itemId, setItemId] = useState<number | null>(null);
  const [packageUom, setPackageUom] = useState<number | null>(null);
  const [contentUom, setContentUom] = useState<number | null>(null);
  const [qty, setQty] = useState("25");
  const [status, setStatus] = useState<"active" | "draft">("active");
  const [supplierCode, setSupplierCode] = useState("");
  const [makeDefaultField, setMakeDefaultField] = useState(false);
  const [defaultFieldCode, setDefaultFieldCode] = useState("");
  const [defaultFieldLabel, setDefaultFieldLabel] = useState("");
  const [defaultFieldType, setDefaultFieldType] = useState<"string" | "number" | "boolean">("string");
  const [defaultFieldValue, setDefaultFieldValue] = useState("");
  const [defaultFieldRequired, setDefaultFieldRequired] = useState(false);

  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const canCreateDefaultField = realmRoles.includes("nsi.default_field.write") || realmRoles.includes("system.admin");

  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const uomCatCode = (catId: number) => uomCatsById.get(catId)?.code ?? "—";

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [u, uc] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
      ]);
      setUoms(u ?? []);
      setUomCats(uc ?? []);

      const bag = (u ?? []).find((x: any) => x.code === "BAG") ?? (u ?? [])[0];
      const kg = (u ?? []).find((x: any) => x.code === "KG") ?? (u ?? [])[0];
      if (bag && packageUom === null) setPackageUom(bag.id);
      if (kg && contentUom === null) setContentUom(kg.id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function createDefaultFieldIfNeeded() {
    if (!token || !canCreateDefaultField || !makeDefaultField) return;

    const fieldCode = defaultFieldCode.trim();
    if (!fieldCode) throw new Error("Укажите код поля по умолчанию.");

    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/default-fields/`,
        token,
        body: {
          code: fieldCode,
          label: defaultFieldLabel.trim() || fieldCode,
          field_type: defaultFieldType,
          default_value: defaultFieldValue.trim(),
          required: defaultFieldRequired,
        },
      });
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 400 && e.status !== 409)) throw e;
      const rows = await requestJson<any[]>({
        method: "GET",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/default-fields/`,
        token,
      });
      const exists = (rows ?? []).some((f: any) => String(f.code ?? "").trim().toLowerCase() === fieldCode.toLowerCase());
      if (!exists) throw e;
    }
  }

  async function create() {
    if (!token) return;
    if (!itemId || !packageUom || !contentUom) { setErr("Заполните все поля."); return; }
    if (toNum(qty) <= 0) { setErr("Количество должно быть > 0."); return; }

    setErr(null);
    try {
      await createDefaultFieldIfNeeded();
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
          supplier_code: supplierCode.trim(),
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
            <ItemLookup token={token} value={itemId} onChange={(item) => setItemId(item?.id ?? null)} />
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
              <option value="active">Активный</option>
              <option value="draft">Черновик</option>
            </select>
          </label>
          <label>
            <small>Поставщик (опционально)</small><br />
            <input
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              placeholder="например: Компания А"
            />
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">1 {uomCode(packageUom)} = {qty} {uomCode(contentUom)}</span>
        </div>

        {canCreateDefaultField && (
          <div style={{ marginTop: 12 }}>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={makeDefaultField} onChange={(e) => setMakeDefaultField(e.target.checked)} />
              <small>поле по умолчанию</small>
            </label>
            {makeDefaultField && (
              <div className="row" style={{ marginTop: 8 }}>
                <label>
                  <small>Код поля</small><br />
                  <input value={defaultFieldCode} onChange={(e) => setDefaultFieldCode(e.target.value)} />
                </label>
                <label>
                  <small>Название</small><br />
                  <input value={defaultFieldLabel} onChange={(e) => setDefaultFieldLabel(e.target.value)} />
                </label>
                <label>
                  <small>Тип</small><br />
                  <select value={defaultFieldType} onChange={(e) => setDefaultFieldType(e.target.value as "string" | "number" | "boolean")}>
                    <option value="string">Строка</option>
                    <option value="number">Число</option>
                    <option value="boolean">Логическое</option>
                  </select>
                </label>
                <label>
                  <small>Значение по умолчанию</small><br />
                  <input value={defaultFieldValue} onChange={(e) => setDefaultFieldValue(e.target.value)} />
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={defaultFieldRequired} onChange={(e) => setDefaultFieldRequired(e.target.checked)} />
                  <small>обязательное</small>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/packages")}>Отмена</button>
          <button className="btn primary" onClick={create}>Создать</button>
        </div>
      </div>
    </div>
  );
}
