import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

type ItemColumnKey = "id" | "name" | "sku" | "category" | "storage_uom" | "density" | "source" | "active";
type ItemColumnDef = { key: ItemColumnKey; label: string; weight: number };

const COLUMN_VISIBILITY_STORAGE_KEY = "nsi_items_visible_columns_v1";
const ACTIONS_WEIGHT = 18;

const ITEM_COLUMNS: ItemColumnDef[] = [
  { key: "id", label: "ID", weight: 7 },
  { key: "name", label: "Название", weight: 30 },
  { key: "sku", label: "SKU", weight: 12 },
  { key: "category", label: "Категория", weight: 18 },
  { key: "storage_uom", label: "Единица хранения", weight: 12 },
  { key: "density", label: "Плотность, кг/л", weight: 12 },
  { key: "source", label: "Источник", weight: 11 },
  { key: "active", label: "Активен", weight: 10 },
];

const DEFAULT_VISIBLE_COLUMNS: Record<ItemColumnKey, boolean> = {
  id: true,
  name: true,
  sku: true,
  category: true,
  storage_uom: true,
  density: true,
  source: true,
  active: true,
};

function readStoredVisibleColumns(): Record<ItemColumnKey, boolean> {
  try {
    const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_VISIBLE_COLUMNS;
    const next: Record<ItemColumnKey, boolean> = { ...DEFAULT_VISIBLE_COLUMNS };
    ITEM_COLUMNS.forEach((c) => {
      if (typeof parsed[c.key] === "boolean") next[c.key] = parsed[c.key];
    });
    if (!ITEM_COLUMNS.some((c) => next[c.key])) {
      return DEFAULT_VISIBLE_COLUMNS;
    }
    return next;
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

export default function NsiItemsPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<number | "all">("all");
  const [onlyManualUom, setOnlyManualUom] = useState(false);
  const [visibleColumnsMap, setVisibleColumnsMap] = useState<Record<ItemColumnKey, boolean>>(() => readStoredVisibleColumns());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "—");

  const catById = useMemo(() => new Map<number, any>(cats.map((c: any) => [c.id, c])), [cats]);
  const catName = (id: number | null | undefined) => (id ? (catById.get(id)?.name ?? String(id)) : "—");
  const catDefaultUom = (id: number | null | undefined) => (id ? (catById.get(id)?.default_uom ?? null) : null);

  function itemStorageUomId(it: any): number | null {
    const v = it?.policy?.posting_uom; // единица хранения в базе
    return typeof v === "number" ? v : null;
  }

  function uomSource(it: any): "default" | "manual" | "none" {
    const defU = catDefaultUom(it.category);
    const su = itemStorageUomId(it);
    if (!defU || !su) return "none";
    return defU === su ? "default" : "manual";
  }

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [u, c, it] = await Promise.all([
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        requestJson<any[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
      ]);
      setUoms(u ?? []);
      setCats(c ?? []);
      setItems(it ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  useEffect(() => {
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumnsMap));
  }, [visibleColumnsMap]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const onPointerDown = (ev: MouseEvent) => {
      if (!columnsMenuRef.current) return;
      const target = ev.target as Node | null;
      if (target && columnsMenuRef.current.contains(target)) return;
      setColumnsMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [columnsMenuOpen]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it: any) => {
      if (catFilter !== "all" && it.category !== catFilter) return false;
      if (onlyManualUom && uomSource(it) !== "manual") return false;
      if (!qq) return true;
      const s = `${it.name ?? ""} ${catName(it.category)} ${it.sku ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [items, q, catFilter, onlyManualUom, cats]);

  const visibleColumns = useMemo(
    () => ITEM_COLUMNS.filter((c) => visibleColumnsMap[c.key]),
    [visibleColumnsMap]
  );
  const visibleColumnsCount = visibleColumns.length;
  const totalWeight = useMemo(
    () => visibleColumns.reduce((sum, c) => sum + c.weight, 0) + ACTIONS_WEIGHT,
    [visibleColumns]
  );

  function setColumnVisible(key: ItemColumnKey, nextValue: boolean) {
    setVisibleColumnsMap((prev) => {
      if (!nextValue) {
        const currentlyVisible = ITEM_COLUMNS.filter((c) => prev[c.key]).length;
        if (currentlyVisible <= 1 && prev[key]) return prev;
      }
      return { ...prev, [key]: nextValue };
    });
  }

  function renderCell(it: any, key: ItemColumnKey): React.ReactNode {
    const su = itemStorageUomId(it);
    const src = uomSource(it);
    if (key === "id") return <span className="mono-cell">{it.id}</span>;
    if (key === "name") return <span title={it.name ?? ""}>{it.name ?? "—"}</span>;
    if (key === "sku") return <span title={it.sku ?? ""}>{it.sku ?? "—"}</span>;
    if (key === "category") return <span title={catName(it.category)}>{catName(it.category)}</span>;
    if (key === "storage_uom") return <span className="badge">{uomCode(su)}</span>;
    if (key === "density") {
      const raw = it?.density_kg_per_l;
      return raw == null || raw === "" ? "—" : String(raw);
    }
    if (key === "source") {
      if (src === "default") return <span className="badge">по умолчанию</span>;
      if (src === "manual") return <span className="badge">вручную</span>;
      return "—";
    }
    if (key === "active") {
      return (
        <span
          className={`nsi-status-icon ${it.is_active ? "active" : "inactive"}`}
          title={it.is_active ? "Активная позиция" : "Неактивная позиция"}
          aria-label={it.is_active ? "Активная позиция" : "Неактивная позиция"}
        >
          {it.is_active ? "✓" : "✕"}
        </span>
      );
    }
    return "—";
  }

  async function remove(id: number) {
    if (!token) return;
    if (!confirm("Удалить номенклатурную позицию?")) return;
    setErr(null);
    try {
      await requestJson({ method: "DELETE", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${id}/`, token });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="НСИ: Номенклатура"
        subtitle="Единица хранения показывает, в какой единице мы храним количество в базе (например, болты — PCS). Категория влияет только на подсказку при создании."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={() => nav("/nsi/items/new")}>Создать позицию</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row nsi-items-filter-row">
          <label style={{ flex: 1, minWidth: 260 }}>
            <small>Поиск</small><br />
            <input value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%" }} placeholder="например: болт" />
          </label>
          <label>
            <small>Категория</small><br />
            <select value={catFilter === "all" ? "all" : String(catFilter)} onChange={(e) => {
              const v = e.target.value;
              setCatFilter(v === "all" ? "all" : toNum(v));
            }}>
              <option value="all">Все</option>
              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={onlyManualUom} onChange={(e) => setOnlyManualUom(e.target.checked)} />
            <small>только с ручной единицей</small>
          </label>
          <div className="nsi-items-columns-menu" ref={columnsMenuRef}>
            <button
              type="button"
              className="btn icon-btn"
              title="Поля таблицы"
              aria-label="Поля таблицы"
              aria-expanded={columnsMenuOpen}
              onClick={() => setColumnsMenuOpen((v) => !v)}
            >
              ⚙
            </button>
            {columnsMenuOpen && (
              <div className="nsi-items-columns-dropdown">
                <small><strong>Отображаемые поля</strong></small>
                {ITEM_COLUMNS.map((c) => {
                  const checked = visibleColumnsMap[c.key];
                  const isLastVisible = checked && visibleColumnsCount === 1;
                  return (
                    <label key={c.key} className="nsi-items-columns-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLastVisible}
                        onChange={(e) => setColumnVisible(c.key, e.target.checked)}
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                  <button className="btn btn-tight" type="button" onClick={() => setVisibleColumnsMap({ ...DEFAULT_VISIBLE_COLUMNS })}>
                    Все поля
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="table-wrap nsi-items-table-wrap" style={{ marginTop: 12 }}>
        <table className="compact-table nsi-items-table">
          <colgroup>
            {visibleColumns.map((c) => (
              <col key={c.key} style={{ width: `${(c.weight / totalWeight) * 100}%` }} />
            ))}
            <col style={{ width: `${(ACTIONS_WEIGHT / totalWeight) * 100}%` }} />
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th className="nsi-actions-col">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it: any) => (
              <tr key={it.id}>
                {visibleColumns.map((c) => (
                  <td key={c.key}>{renderCell(it, c.key)}</td>
                ))}
                <td className="nsi-actions-col">
                  <div className="row nsi-table-actions">
                    <button
                      className="btn btn-tight nsi-action-icon"
                      onClick={() => nav(`/nsi/items/${it.id}/edit`)}
                      title="Редактировать"
                      aria-label="Редактировать"
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-tight danger nsi-action-icon"
                      onClick={() => remove(it.id)}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="empty-row">
                  <small>Ничего не найдено.</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
