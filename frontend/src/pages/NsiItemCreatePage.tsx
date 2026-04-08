import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, requestJson, unwrapList } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiItemCreatePage() {
  const { token, keycloak } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [existingItemNames, setExistingItemNames] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("Новый товар");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [useDefaultUom, setUseDefaultUom] = useState(true);
  const [storageUom, setStorageUom] = useState<number | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [allowFractional, setAllowFractional] = useState(true);
  const [roundingPrecision, setRoundingPrecision] = useState(3);
  const [densityKgPerL, setDensityKgPerL] = useState("");
  const [makeDefaultField, setMakeDefaultField] = useState(false);
  const [defaultFieldCode, setDefaultFieldCode] = useState("");
  const [defaultFieldLabel, setDefaultFieldLabel] = useState("");
  const [defaultFieldType, setDefaultFieldType] = useState<"string" | "number" | "boolean">("string");
  const [defaultFieldValue, setDefaultFieldValue] = useState("");
  const [defaultFieldRequired, setDefaultFieldRequired] = useState(false);

  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const canCreateDefaultField = realmRoles.includes("nsi.default_field.write") || realmRoles.includes("system.admin");

  const prevCatId = useRef<number | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = useCallback((id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "-"), [uomById]);

  const catById = useMemo(() => new Map<number, any>(cats.map((c: any) => [c.id, c])), [cats]);
  const catName = useCallback((id: number | null | undefined) => (id ? (catById.get(id)?.name ?? String(id)) : "-"), [catById]);
  const catDefaultUom = useCallback((id: number | null | undefined) => (id ? (catById.get(id)?.default_uom ?? null) : null), [catById]);
  const normalizeName = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const exactNameDuplicate = useMemo(() => {
    const needle = normalizeName(name);
    if (!needle) return false;
    return existingItemNames.some((n) => normalizeName(n) === needle);
  }, [name, existingItemNames]);
  const nameSuggestions = useMemo(() => {
    const needle = normalizeName(name);
    if (!needle) return existingItemNames.slice(0, 10);
    return existingItemNames
      .filter((x) => normalizeName(x).includes(needle))
      .slice(0, 10);
  }, [name, existingItemNames]);

  async function loadAllItemNames(tokenValue: string): Promise<string[]> {
    const bag = new Set<string>();
    let nextUrl: string | null = `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/?limit=500`;
    let pageGuard = 0;

    while (nextUrl && pageGuard < 40) {
      const payload: any = await requestJson({ method: "GET", url: nextUrl, token: tokenValue });
      const rows = unwrapList<any>(payload);
      for (const row of rows) {
        const nm = String(row?.name ?? "").trim();
        if (nm) bag.add(nm);
      }

      if (Array.isArray(payload)) break;
      const rawNext: string = typeof payload?.next === "string" ? payload.next.trim() : "";
      nextUrl = rawNext || null;
      pageGuard += 1;
    }

    return Array.from(bag).sort((a, b) => a.localeCompare(b, "ru"));
  }

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [u, c, names] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        loadAllItemNames(token).catch(() => []),
      ]);
      setUoms(u ?? []);
      setCats(c ?? []);
      setExistingItemNames(names ?? []);

      const firstCat = (c ?? [])[0];
      if (firstCat && categoryId === null) {
        setCategoryId(firstCat.id);
        prevCatId.current = firstCat.id;
        const defU = firstCat.default_uom ?? null;
        if (defU) {
          setUseDefaultUom(true);
          setStorageUom(defU);
        } else {
          setUseDefaultUom(false);
          setStorageUom((u ?? [])[0]?.id ?? null);
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, [token, categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  function onCategoryChange(newId: number) {
    const oldId = prevCatId.current;
    prevCatId.current = newId;
    setCategoryId(newId);

    const newDef = catDefaultUom(newId);

    if (useDefaultUom) {
      if (newDef) {
        setStorageUom(newDef);
      } else {
        setUseDefaultUom(false);
      }
    } else if (!storageUom && newDef) {
      setStorageUom(newDef);
    }

    const oldDef = oldId ? catDefaultUom(oldId) : null;
    if (useDefaultUom && oldDef && storageUom === oldDef && newDef) setStorageUom(newDef);
  }

  useEffect(() => {
    if (!categoryId) return;
    const defU = catDefaultUom(categoryId);
    if (useDefaultUom) {
      if (defU) setStorageUom(defU);
      else setUseDefaultUom(false);
    }
  }, [useDefaultUom, categoryId, catDefaultUom]);

  useEffect(() => {
    if (!allowFractional && roundingPrecision !== 0) {
      setRoundingPrecision(0);
    }
  }, [allowFractional, roundingPrecision]);

  const sourceLabel = useMemo(() => {
    if (!categoryId) return "—";
    const defU = catDefaultUom(categoryId);
    if (!defU) return "вручную";
    if (useDefaultUom) return "по умолчанию";
    return defU === storageUom ? "по умолчанию" : "вручную";
  }, [categoryId, useDefaultUom, storageUom, catDefaultUom]);

  const example = useMemo(() => {
    return `«${name || "…"}» — категория «${catName(categoryId)}», храним в базе: ${uomCode(storageUom)} (${sourceLabel})`;
  }, [name, categoryId, storageUom, sourceLabel, catName, uomCode]);

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
    if (!categoryId) { setErr("Выберите категорию."); return; }
    if (!storageUom) { setErr("Выберите единицу хранения."); return; }
    const densityText = String(densityKgPerL ?? "").replace(",", ".").trim();
    let densityValue: number | null = null;
    if (densityText) {
      const parsed = Number(densityText);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setErr("Плотность должна быть числом больше 0.");
        return;
      }
      densityValue = parsed;
    }
    if (exactNameDuplicate) {
      setErr("Номенклатура с таким названием уже существует. Выберите существующую позицию или укажите другое имя.");
      return;
    }
    setErr(null);
    try {
      await createDefaultFieldIfNeeded();
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`,
        token,
        body: {
          sku: null,
          name,
          category: categoryId,
          density_kg_per_l: densityValue,
          is_active: isActive,
          policy: {
            storage_uom: storageUom,
            posting_uom: storageUom,
            allow_fractional: allowFractional,
            rounding_precision: roundingPrecision,
          },
        },
      });
      nav("/nsi/items");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const defUom = categoryId ? catDefaultUom(categoryId) : null;

  return (
    <div className="card">
      <PageHeader
        title="Создание номенклатурной позиции"
        subtitle="Единица хранения — в какой единице мы храним количество в базе (например, болты — PCS). Поставщик может поставлять в других единицах — это решается правилами конвертации."
        right={<button className="btn" onClick={() => nav("/nsi/items")}>Отмена</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card nsi-item-form" style={{ marginTop: 12 }}>
        <div className="nsi-item-row-one">
          <label className="field">
            <small>Название номенклатуры</small>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="item-name-suggestions"
              autoComplete="off"
            />
            <datalist id="item-name-suggestions">
              {nameSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            {exactNameDuplicate && <small style={{ color: "#fca5a5" }}>Такое название уже есть в справочнике.</small>}
          </label>
        </div>

        <div className="nsi-item-row-two">
          <label className="field">
            <small>Категория</small>
            <select value={categoryId ?? ""} onChange={(e) => onCategoryChange(toNum(e.target.value))}>
              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="field nsi-item-toggle-field">
            <small>&nbsp;</small>
            <span className="nsi-item-toggle">
              <input
                type="checkbox"
                checked={useDefaultUom && !!defUom}
                disabled={!defUom}
                onChange={(e) => setUseDefaultUom(e.target.checked)}
              />
              <span>Использовать ЕИ по умолчанию категории</span>
            </span>
          </label>

          <label className="field">
            <small>Единица хранения (в базе)</small>
            <select
              value={storageUom ?? ""}
              onChange={(e) => setStorageUom(toNum(e.target.value))}
              disabled={useDefaultUom && !!defUom}
            >
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
            </select>
          </label>

          <label className="field">
            <small>Плотность, кг/л (опционально)</small>
            <input
              type="number"
              min={0}
              step="0.000001"
              value={densityKgPerL}
              onChange={(e) => setDensityKgPerL(e.target.value)}
              placeholder="например, 1.45"
            />
          </label>
        </div>

        <div className="nsi-item-row-three">
          <label className="field nsi-item-toggle-field">
            <small>&nbsp;</small>
            <span className="nsi-item-toggle">
              <input
                type="checkbox"
                checked={allowFractional}
                onChange={(e) => setAllowFractional(e.target.checked)}
              />
              <span>Использовать дробные числа</span>
            </span>
          </label>

          <label className="field">
            <small>Округление</small>
            <input
              type="number"
              min={0}
              value={roundingPrecision}
              readOnly={!allowFractional}
              onChange={(e) => {
                if (!allowFractional) return;
                setRoundingPrecision(toNum(e.target.value));
              }}
            />
          </label>

          <label className="field nsi-item-toggle-field">
            <small>&nbsp;</small>
            <span className="nsi-item-toggle">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Активен</span>
            </span>
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

        <div className="row nsi-item-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/items")}>Отмена</button>
          <button className="btn primary" onClick={create} disabled={exactNameDuplicate}>Создать</button>
        </div>
      </div>
    </div>
  );
}

