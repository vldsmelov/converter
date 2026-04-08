import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson, unwrapList } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiItemEditPage() {
  const { id } = useParams();
  const itemId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [existingItems, setExistingItems] = useState<Array<{ id: number; name: string }>>([]);
  const [item, setItem] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [useDefaultUom, setUseDefaultUom] = useState(false);
  const [storageUom, setStorageUom] = useState<number | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [allowFractional, setAllowFractional] = useState(true);
  const [roundingPrecision, setRoundingPrecision] = useState(3);
  const [densityKgPerL, setDensityKgPerL] = useState("");

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
    return existingItems.some((it) => it.id !== itemId && normalizeName(it.name) === needle);
  }, [existingItems, name, itemId]);
  const nameSuggestions = useMemo(() => {
    const needle = normalizeName(name);
    const names = existingItems
      .filter((it) => it.id !== itemId)
      .map((it) => String(it.name ?? "").trim())
      .filter(Boolean);
    if (!needle) return names.slice(0, 10);
    return names.filter((x) => normalizeName(x).includes(needle)).slice(0, 10);
  }, [existingItems, name, itemId]);

  async function loadAllItems(tokenValue: string): Promise<Array<{ id: number; name: string }>> {
    const map = new Map<number, string>();
    let nextUrl: string | null = `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/?limit=500`;
    let pageGuard = 0;

    while (nextUrl && pageGuard < 40) {
      const payload: any = await requestJson({ method: "GET", url: nextUrl, token: tokenValue });
      const rows = unwrapList<any>(payload);
      for (const row of rows) {
        const currentId = Number(row?.id ?? 0);
        const nm = String(row?.name ?? "").trim();
        if (currentId > 0 && nm) map.set(currentId, nm);
      }
      if (Array.isArray(payload)) break;
      const rawNext: string = typeof payload?.next === "string" ? payload.next.trim() : "";
      nextUrl = rawNext || null;
      pageGuard += 1;
    }

    return Array.from(map.entries())
      .map(([rowId, rowName]) => ({ id: rowId, name: rowName }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [u, c, it, allItems] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${itemId}/`, token }),
        loadAllItems(token).catch(() => []),
      ]);
      setUoms(u ?? []);
      setCats(c ?? []);
      setItem(it);
      setExistingItems(allItems ?? []);

      setName(it.name ?? "");
      setCategoryId(it.category ?? null);
      prevCatId.current = it.category ?? null;

      const su = typeof it?.policy?.posting_uom === "number" ? it.policy.posting_uom : null;
      setStorageUom(su);

      setIsActive(!!it.is_active);
      setAllowFractional(!!it.policy?.allow_fractional);
      setRoundingPrecision(Number(it.policy?.rounding_precision ?? 3));
      setDensityKgPerL(it?.density_kg_per_l == null ? "" : String(it.density_kg_per_l));

      const defU = it.category ? (c ?? []).find((x: any) => x.id === it.category)?.default_uom ?? null : null;
      setUseDefaultUom(!!defU && !!su && defU === su);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, [token, itemId]);
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

  async function save() {
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
      await requestJson({
        method: "PUT",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${itemId}/`,
        token,
        body: {
          id: itemId,
          sku: item?.sku ?? null,
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

  async function remove() {
    if (!token) return;
    if (!confirm("Удалить номенклатурную позицию?")) return;
    setErr(null);
    try {
      await requestJson({ method: "DELETE", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${itemId}/`, token });
      nav("/nsi/items");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const defUom = categoryId ? catDefaultUom(categoryId) : null;

  return (
    <div className="card">
      <PageHeader
        title={`Редактирование позиции #${itemId}`}
        subtitle="Единица хранения — в какой единице мы храним количество в базе. Если поставщик поставляет в других единицах — это решается правилами конвертации."
        right={<button className="btn" onClick={() => nav("/nsi/items")}>← Назад</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!item ? <div style={{ padding: 8 }}>Загрузка…</div> : null}

      <div className="card nsi-item-form" style={{ marginTop: 12 }}>
        <div className="nsi-item-row-one">
          <label className="field">
            <small>Название номенклатуры</small>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="item-edit-name-suggestions"
              autoComplete="off"
            />
            <datalist id="item-edit-name-suggestions">
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

        <div className="row nsi-item-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/items")}>Отмена</button>
          <button className="btn primary" onClick={save} disabled={exactNameDuplicate}>Сохранить</button>
          <div style={{ flex: 1 }} />
          <button className="btn danger" onClick={remove}>Удалить</button>
        </div>
      </div>
    </div>
  );
}




