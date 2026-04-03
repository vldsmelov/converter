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
    if (!categoryId) return "вЂ”";
    const defU = catDefaultUom(categoryId);
    if (!defU) return "РІСЂСѓС‡РЅСѓСЋ";
    if (useDefaultUom) return "РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ";
    return defU === storageUom ? "РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ" : "РІСЂСѓС‡РЅСѓСЋ";
  }, [categoryId, useDefaultUom, storageUom, catDefaultUom]);

  const example = useMemo(() => {
    return `В«${name || "вЂ¦"}В» вЂ” РєР°С‚РµРіРѕСЂРёСЏ В«${catName(categoryId)}В», С…СЂР°РЅРёРј РІ Р±Р°Р·Рµ: ${uomCode(storageUom)} (${sourceLabel})`;
  }, [name, categoryId, storageUom, sourceLabel, catName, uomCode]);

  async function save() {
    if (!token) return;
    if (!categoryId) { setErr("Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ."); return; }
    if (!storageUom) { setErr("Р’С‹Р±РµСЂРёС‚Рµ РµРґРёРЅРёС†Сѓ С…СЂР°РЅРµРЅРёСЏ."); return; }
    const densityText = String(densityKgPerL ?? "").replace(",", ".").trim();
    let densityValue: number | null = null;
    if (densityText) {
      const parsed = Number(densityText);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setErr("РџР»РѕС‚РЅРѕСЃС‚СЊ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ С‡РёСЃР»РѕРј Р±РѕР»СЊС€Рµ 0.");
        return;
      }
      densityValue = parsed;
    }
    if (exactNameDuplicate) {
      setErr("РќРѕРјРµРЅРєР»Р°С‚СѓСЂР° СЃ С‚Р°РєРёРј РЅР°Р·РІР°РЅРёРµРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚. Р’С‹Р±РµСЂРёС‚Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ РїРѕР·РёС†РёСЋ РёР»Рё СѓРєР°Р¶РёС‚Рµ РґСЂСѓРіРѕРµ РёРјСЏ.");
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
    if (!confirm("РЈРґР°Р»РёС‚СЊ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂРЅСѓСЋ РїРѕР·РёС†РёСЋ?")) return;
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
        subtitle="Р•РґРёРЅРёС†Р° С…СЂР°РЅРµРЅРёСЏ вЂ” РІ РєР°РєРѕР№ РµРґРёРЅРёС†Рµ РјС‹ С…СЂР°РЅРёРј РєРѕР»РёС‡РµСЃС‚РІРѕ РІ Р±Р°Р·Рµ. Р•СЃР»Рё РїРѕСЃС‚Р°РІС‰РёРє РїРѕСЃС‚Р°РІР»СЏРµС‚ РІ РґСЂСѓРіРёС… РµРґРёРЅРёС†Р°С… вЂ” СЌС‚Рѕ СЂРµС€Р°РµС‚СЃСЏ РїСЂР°РІРёР»Р°РјРё РєРѕРЅРІРµСЂС‚Р°С†РёРё."
        right={<button className="btn" onClick={() => nav("/nsi/items")}>в†ђ РќР°Р·Р°Рґ</button>}
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}
      {!item ? <div style={{ padding: 8 }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div> : null}

      <div className="card nsi-item-form" style={{ marginTop: 12 }}>
        <div className="nsi-item-row-one">
          <label className="field">
            <small>РќР°Р·РІР°РЅРёРµ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹</small>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="item-edit-name-suggestions"
              autoComplete="off"
            />
            <datalist id="item-edit-name-suggestions">
              {nameSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            {exactNameDuplicate && <small style={{ color: "#fca5a5" }}>РўР°РєРѕРµ РЅР°Р·РІР°РЅРёРµ СѓР¶Рµ РµСЃС‚СЊ РІ СЃРїСЂР°РІРѕС‡РЅРёРєРµ.</small>}
          </label>
        </div>

        <div className="nsi-item-row-two">
          <label className="field">
            <small>РљР°С‚РµРіРѕСЂРёСЏ</small>
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
              <span>РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ Р•Р РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РєР°С‚РµРіРѕСЂРёРё</span>
            </span>
          </label>

          <label className="field">
            <small>Р•РґРёРЅРёС†Р° С…СЂР°РЅРµРЅРёСЏ (РІ Р±Р°Р·Рµ)</small>
            <select
              value={storageUom ?? ""}
              onChange={(e) => setStorageUom(toNum(e.target.value))}
              disabled={useDefaultUom && !!defUom}
            >
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
            </select>
          </label>

          <label className="field">
            <small>РџР»РѕС‚РЅРѕСЃС‚СЊ, РєРі/Р» (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)</small>
            <input
              type="number"
              min={0}
              step="0.000001"
              value={densityKgPerL}
              onChange={(e) => setDensityKgPerL(e.target.value)}
              placeholder="РЅР°РїСЂРёРјРµСЂ, 1.45"
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
              <span>РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РґСЂРѕР±РЅС‹Рµ С‡РёСЃР»Р°</span>
            </span>
          </label>

          <label className="field">
            <small>РћРєСЂСѓРіР»РµРЅРёРµ</small>
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
              <span>РђРєС‚РёРІРµРЅ</span>
            </span>
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>РџСЂРёРјРµСЂ:</small><br />
          <span className="badge">{example}</span>
        </div>

        <div className="row nsi-item-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/items")}>РћС‚РјРµРЅР°</button>
          <button className="btn primary" onClick={save} disabled={exactNameDuplicate}>РЎРѕС…СЂР°РЅРёС‚СЊ</button>
          <div style={{ flex: 1 }} />
          <button className="btn danger" onClick={remove}>РЈРґР°Р»РёС‚СЊ</button>
        </div>
      </div>
    </div>
  );
}




