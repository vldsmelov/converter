import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

export default function NsiItemEditPage() {
  const { id } = useParams();
  const itemId = Number(id);
  const { token } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [item, setItem] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [useDefaultUom, setUseDefaultUom] = useState(false);
  const [storageUom, setStorageUom] = useState<number | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [allowFractional, setAllowFractional] = useState(true);
  const [roundingPrecision, setRoundingPrecision] = useState(3);

  const prevCatId = useRef<number | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  const catById = useMemo(() => new Map<number, any>(cats.map((c: any) => [c.id, c])), [cats]);
  const catName = (id: number | null | undefined) => (id ? (catById.get(id)?.name ?? String(id)) : "—");
  const catDefaultUom = (id: number | null | undefined) => (id ? (catById.get(id)?.default_uom ?? null) : null);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [u, c, it] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${itemId}/`, token }),
      ]);
      setUoms(u ?? []);
      setCats(c ?? []);
      setItem(it);

      setName(it.name ?? "");
      setCategoryId(it.category ?? null);
      prevCatId.current = it.category ?? null;

      const su = typeof it?.policy?.posting_uom === "number" ? it.policy.posting_uom : null;
      setStorageUom(su);

      setIsActive(!!it.is_active);
      setAllowFractional(!!it.policy?.allow_fractional);
      setRoundingPrecision(Number(it.policy?.rounding_precision ?? 3));

      const defU = it.category ? (c ?? []).find((x: any) => x.id === it.category)?.default_uom ?? null : null;
      setUseDefaultUom(!!defU && !!su && defU === su);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, itemId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDefaultUom]);

  const sourceLabel = useMemo(() => {
    if (!categoryId) return "—";
    const defU = catDefaultUom(categoryId);
    if (!defU) return "вручную";
    if (useDefaultUom) return "по умолчанию";
    return defU === storageUom ? "по умолчанию" : "вручную";
  }, [categoryId, useDefaultUom, storageUom, cats]);

  const example = useMemo(() => {
    return `«${name || "…"}» — категория «${catName(categoryId)}», храним в базе: ${uomCode(storageUom)} (${sourceLabel})`;
  }, [name, categoryId, storageUom, sourceLabel, cats, uoms]);

  async function save() {
    if (!token) return;
    if (!categoryId) { setErr("Выберите категорию."); return; }
    if (!storageUom) { setErr("Выберите единицу хранения."); return; }
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

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ flex: 1 }}>
            <small>Название товара</small><br />
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <small>Категория</small><br />
            <select value={categoryId ?? ""} onChange={(e) => onCategoryChange(toNum(e.target.value))}>
              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={useDefaultUom && !!defUom}
              disabled={!defUom}
              onChange={(e) => setUseDefaultUom(e.target.checked)}
            />
            <small>Использовать ЕИ по умолчанию категории</small>
          </label>

          <div style={{ flex: 1 }} />

          <label>
            <small>Единица хранения (в базе)</small><br />
            <select
              value={storageUom ?? ""}
              onChange={(e) => setStorageUom(toNum(e.target.value))}
              disabled={useDefaultUom && !!defUom}
            >
              {uoms.map((u: any) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </label>

          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <small>активен</small>
          </label>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={allowFractional} onChange={(e) => setAllowFractional(e.target.checked)} />
            <small>дробные</small>
          </label>
          <label>
            <small>Округление</small><br />
            <input type="number" value={roundingPrecision} onChange={(e) => setRoundingPrecision(toNum(e.target.value))} />
          </label>
          <div style={{ flex: 1 }} />
          <span className="badge">{sourceLabel}</span>
        </div>

        <div style={{ marginTop: 10 }}>
          <small>Пример:</small><br />
          <span className="badge">{example}</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/nsi/items")}>Отмена</button>
          <button className="btn primary" onClick={save}>Сохранить</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={remove}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
