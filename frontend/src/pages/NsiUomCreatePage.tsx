import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiUomCreatePage() {
  const { token, keycloak } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState("M");
  const [name, setName] = useState("Метр");
  const [category, setCategory] = useState<number | null>(null);
  const [factor, setFactor] = useState("1");
  const [precision, setPrecision] = useState(3);
  const [makeDefaultField, setMakeDefaultField] = useState(false);
  const [defaultFieldCode, setDefaultFieldCode] = useState("");
  const [defaultFieldLabel, setDefaultFieldLabel] = useState("");
  const [defaultFieldType, setDefaultFieldType] = useState<"string" | "number" | "boolean">("string");
  const [defaultFieldValue, setDefaultFieldValue] = useState("");
  const [defaultFieldRequired, setDefaultFieldRequired] = useState(false);

  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const canCreateDefaultField = realmRoles.includes("nsi.default_field.write") || realmRoles.includes("system.admin");

  const catCode = useMemo(() => {
    const m = new Map<number, string>(cats.map((c: any) => [c.id, c.code]));
    return (id: number | null) => (id ? (m.get(id) ?? String(id)) : "—");
  }, [cats]);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const c = await requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token });
      setCats(c ?? []);
      const length = (c ?? []).find((x: any) => x.code === "LENGTH") ?? (c ?? [])[0];
      if (length && category === null) setCategory(length.id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const example = useMemo(() => {
    return `1 ${code.toUpperCase()} = ${factor} (в базовых единицах категории ${catCode(category)})`;
  }, [code, factor, category, catCode]);

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
    if (!category) { setErr("Выберите категорию ЕИ."); return; }
    setErr(null);
    try {
      await createDefaultFieldIfNeeded();
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`,
        token,
        body: { code: code.toUpperCase(), name, category, factor_to_base: factor, precision },
      });
      nav("/nsi/uoms");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="Создание ЕИ"
        subtitle="Код + категория + коэффициент к базовой (factor_to_base)."
        right={
          <>
            <button className="btn" onClick={() => nav("/nsi/uoms")}>Отмена</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label>
            <small>Код</small><br />
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            <small>Название</small><br />
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <small>Категория</small><br />
            <select value={category ?? ""} onChange={(e) => setCategory(toNum(e.target.value))}>
              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </label>
          <label>
            <small>factor_to_base</small><br />
            <input value={factor} onChange={(e) => setFactor(e.target.value)} />
          </label>
          <label>
            <small>precision</small><br />
            <input type="number" value={precision} onChange={(e) => setPrecision(toNum(e.target.value))} />
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">{example}</span>
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
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
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
          <button className="btn" onClick={() => nav("/nsi/uoms")}>Отмена</button>
          <button className="btn primary" onClick={create}>Создать</button>
        </div>
      </div>
    </div>
  );
}
