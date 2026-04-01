import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { conditionLabel, ruleParamLabel, ruleTypeLabel, uomCategoryLabel } from "../lib/ruLabels";

type Uom = any;
type UomCat = any;
type Item = any;
type ItemCat = any;
type GlobalRule = any;
type CatPkg = any;
type Rule = any;
type RuleTab = "global" | "category" | "item";

type GlobalColumnKey = "id" | "from_uom" | "to_uom" | "multiplier" | "status";
type CategoryColumnKey = "id" | "category" | "rule" | "status";
type ItemColumnKey = "id" | "item" | "type" | "conditions" | "params" | "status";
type ColumnDef<T extends string> = { key: T; label: string; weight: number };

const ACTIONS_WEIGHT = 18;
const GLOBAL_COLUMNS_STORAGE_KEY = "nsi_rules_global_visible_columns_v1";
const CATEGORY_COLUMNS_STORAGE_KEY = "nsi_rules_category_visible_columns_v1";
const ITEM_COLUMNS_STORAGE_KEY = "nsi_rules_item_visible_columns_v1";

const GLOBAL_COLUMNS: Array<ColumnDef<GlobalColumnKey>> = [
  { key: "id", label: "ID", weight: 8 },
  { key: "from_uom", label: "Из ЕИ", weight: 22 },
  { key: "to_uom", label: "В ЕИ", weight: 22 },
  { key: "multiplier", label: "Коэффициент", weight: 18 },
  { key: "status", label: "Статус", weight: 12 },
];

const CATEGORY_COLUMNS: Array<ColumnDef<CategoryColumnKey>> = [
  { key: "id", label: "ID", weight: 8 },
  { key: "category", label: "Категория", weight: 26 },
  { key: "rule", label: "Правило", weight: 38 },
  { key: "status", label: "Статус", weight: 12 },
];

const ITEM_COLUMNS: Array<ColumnDef<ItemColumnKey>> = [
  { key: "id", label: "ID", weight: 7 },
  { key: "item", label: "Номенклатура", weight: 24 },
  { key: "type", label: "Тип", weight: 12 },
  { key: "conditions", label: "Условия", weight: 21 },
  { key: "params", label: "Параметры", weight: 17 },
  { key: "status", label: "Статус", weight: 8 },
];

const DEFAULT_GLOBAL_COLUMNS: Record<GlobalColumnKey, boolean> = {
  id: true,
  from_uom: true,
  to_uom: true,
  multiplier: true,
  status: true,
};

const DEFAULT_CATEGORY_COLUMNS: Record<CategoryColumnKey, boolean> = {
  id: true,
  category: true,
  rule: true,
  status: true,
};

const DEFAULT_ITEM_COLUMNS: Record<ItemColumnKey, boolean> = {
  id: true,
  item: true,
  type: true,
  conditions: true,
  params: true,
  status: true,
};

function parseRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

function up(v: unknown): string {
  return String(v ?? "").toUpperCase();
}

function readStoredVisibleColumns<T extends string>(
  storageKey: string,
  columns: Array<ColumnDef<T>>,
  defaults: Record<T, boolean>
): Record<T, boolean> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...defaults };
    const next: Record<T, boolean> = { ...defaults };
    columns.forEach((c) => {
      const v = (parsed as Record<string, unknown>)[c.key];
      if (typeof v === "boolean") next[c.key] = v;
    });
    if (!columns.some((c) => next[c.key])) return { ...defaults };
    return next;
  } catch {
    return { ...defaults };
  }
}

export default function NsiRulesPage() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [uoms, setUoms] = useState<Uom[]>([]);
  const [uomCats, setUomCats] = useState<UomCat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemCats, setItemCats] = useState<ItemCat[]>([]);

  const [globalRules, setGlobalRules] = useState<GlobalRule[]>([]);
  const [catPkgs, setCatPkgs] = useState<CatPkg[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  const [activeTab, setActiveTab] = useState<RuleTab>("global");
  const [qGlobal, setQGlobal] = useState("");
  const [qCategory, setQCategory] = useState("");
  const [qItem, setQItem] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [globalColumns, setGlobalColumns] = useState<Record<GlobalColumnKey, boolean>>(
    () => readStoredVisibleColumns(GLOBAL_COLUMNS_STORAGE_KEY, GLOBAL_COLUMNS, DEFAULT_GLOBAL_COLUMNS)
  );
  const [categoryColumns, setCategoryColumns] = useState<Record<CategoryColumnKey, boolean>>(
    () => readStoredVisibleColumns(CATEGORY_COLUMNS_STORAGE_KEY, CATEGORY_COLUMNS, DEFAULT_CATEGORY_COLUMNS)
  );
  const [itemColumns, setItemColumns] = useState<Record<ItemColumnKey, boolean>>(
    () => readStoredVisibleColumns(ITEM_COLUMNS_STORAGE_KEY, ITEM_COLUMNS, DEFAULT_ITEM_COLUMNS)
  );
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [expandedItemGroups, setExpandedItemGroups] = useState<Record<string, boolean>>({});
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const uomById = useMemo(() => new Map<number, any>(uoms.map((u: any) => [u.id, u])), [uoms]);
  const uomCatsById = useMemo(() => new Map<number, any>(uomCats.map((c: any) => [c.id, c])), [uomCats]);
  const uomCode = (id: number | null | undefined) => (id ? (uomById.get(id)?.code ?? String(id)) : "-");

  const itemCatById = useMemo(() => new Map<number, any>(itemCats.map((c: any) => [c.id, c])), [itemCats]);
  const itemCatName = (id: number | null | undefined) => (id ? (itemCatById.get(id)?.name ?? String(id)) : "-");

  const itemById = useMemo(() => new Map<number, any>(items.map((i: any) => [i.id, i])), [items]);
  const itemRules = useMemo(() => rules.filter((r: any) => !!r.item), [rules]);

  useEffect(() => {
    window.localStorage.setItem(GLOBAL_COLUMNS_STORAGE_KEY, JSON.stringify(globalColumns));
  }, [globalColumns]);

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_COLUMNS_STORAGE_KEY, JSON.stringify(categoryColumns));
  }, [categoryColumns]);

  useEffect(() => {
    window.localStorage.setItem(ITEM_COLUMNS_STORAGE_KEY, JSON.stringify(itemColumns));
  }, [itemColumns]);

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

  function formatRuleParams(rule: any): string {
    const params = rule?.params ?? {};
    const pairs = Object.entries(params).map(([k, v]) => `${ruleParamLabel(k)}=${v}`);
    return pairs.length > 0 ? pairs.join(", ") : "-";
  }

  function formatRuleConditions(rule: any): string {
    const conditions = rule?.conditions ?? {};
    const pairs = Object.entries(conditions).map(([k, v]) => `${conditionLabel(k)}=${v}`);
    return pairs.length > 0 ? pairs.join(", ") : "общие";
  }

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const [uRaw, ucRaw, itRaw, icRaw, grRaw, cpRaw, rlRaw] = await Promise.all([
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uoms/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/uom-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/item-categories/`, token }),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/`, token }).catch(() => []),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/`, token }).catch(() => []),
        requestJson<any>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/`, token }),
      ]);

      setUoms(parseRows(uRaw));
      setUomCats(parseRows(ucRaw));
      setItems(parseRows(itRaw));
      setItemCats(parseRows(icRaw));
      setGlobalRules(parseRows(grRaw));
      setCatPkgs(parseRows(cpRaw));
      setRules(parseRows(rlRaw));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token]);

  async function removeGlobalRule(id: number) {
    if (!token) return;
    if (!confirm("Удалить глобальное правило?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/global-uom-rules/${id}/`,
        token,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function removeCategoryRule(id: number) {
    if (!token) return;
    if (!confirm("Удалить правило категории?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/category-packages/${id}/`,
        token,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function removeItemRule(id: number) {
    if (!token) return;
    if (!confirm("Удалить правило номенклатуры?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/rules/${id}/`,
        token,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  function renderStatus(status: unknown) {
    const isActive = String(status ?? "").toLowerCase() === "active";
    return (
      <span
        className={`nsi-status-icon ${isActive ? "active" : "inactive"}`}
        title={isActive ? "Активно" : "Неактивно"}
        aria-label={isActive ? "Активно" : "Неактивно"}
      >
        {isActive ? "✓" : "✕"}
      </span>
    );
  }

  const filteredGlobal = useMemo(() => {
    const qq = qGlobal.trim().toLowerCase();
    if (!qq) return globalRules;
    return globalRules.filter((r: any) => {
      const s = `${r.id ?? ""} ${uomCode(r.from_uom)} ${uomCode(r.to_uom)} ${r.multiplier ?? ""} ${r.status ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [globalRules, qGlobal, uomById]);

  const filteredCategory = useMemo(() => {
    const qq = qCategory.trim().toLowerCase();
    if (!qq) return catPkgs;
    return catPkgs.filter((p: any) => {
      const ruleText = `1 ${uomCode(p.package_uom)} ${p.content_qty ?? ""} ${uomCode(p.content_uom)}`;
      const s = `${p.id ?? ""} ${itemCatName(p.category)} ${ruleText} ${p.status ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [catPkgs, qCategory, itemCatById, uomById]);

  function getUomCategoryCodeByUomId(uomId: number | null | undefined): string {
    if (!uomId) return "";
    const uom = uomById.get(uomId);
    const rawCode =
      uom?.category_code ??
      uom?.category?.code ??
      uomCatsById.get(uom?.category)?.code ??
      uom?.category ??
      "";
    return up(rawCode);
  }

  function itemCategoryPairMeta(r: any): { key: string; label: string } {
    const fromCode = getUomCategoryCodeByUomId(r.from_uom) || "?";
    const toCode = getUomCategoryCodeByUomId(r.to_uom) || "?";
    const label = `${uomCategoryLabel(fromCode)} -> ${uomCategoryLabel(toCode)}`;
    return { key: `${fromCode}->${toCode}`, label };
  }

  const filteredItem = useMemo(() => {
    const qq = qItem.trim().toLowerCase();
    if (!qq) return itemRules;
    return itemRules.filter((r: any) => {
      const itemName = String(itemById.get(r.item)?.name ?? r.item ?? "");
      const pairMeta = itemCategoryPairMeta(r);
      const s = `${r.id ?? ""} ${itemName} ${ruleTypeLabel(r.rule_type)} ${pairMeta.label} ${formatRuleConditions(r)} ${formatRuleParams(r)} ${r.status ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [itemRules, qItem, itemById, uomById, uomCatsById]);

  const groupedItemRules = useMemo(() => {
    const byItem = new Map<string, { key: string; itemName: string; categoryMap: Map<string, { key: string; label: string; rules: Rule[] }> }>();

    for (const r of filteredItem) {
      const itemKey = String(r.item ?? "—");
      const itemName = String(itemById.get(r.item)?.name ?? r.item ?? "—");
      const pairMeta = itemCategoryPairMeta(r);
      let itemGroup = byItem.get(itemKey);
      if (!itemGroup) {
        itemGroup = { key: itemKey, itemName, categoryMap: new Map() };
        byItem.set(itemKey, itemGroup);
      }
      let pairGroup = itemGroup.categoryMap.get(pairMeta.key);
      if (!pairGroup) {
        pairGroup = { key: pairMeta.key, label: pairMeta.label, rules: [] };
        itemGroup.categoryMap.set(pairMeta.key, pairGroup);
      }
      pairGroup.rules.push(r);
    }

    return Array.from(byItem.values())
      .map((itemGroup) => ({
        key: itemGroup.key,
        itemName: itemGroup.itemName,
        totalRules: Array.from(itemGroup.categoryMap.values()).reduce((acc, g) => acc + g.rules.length, 0),
        categories: Array.from(itemGroup.categoryMap.values()).sort((a, b) => a.label.localeCompare(b.label, "ru")),
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName, "ru"));
  }, [filteredItem, itemById, uomById, uomCatsById]);

  const visibleGlobalColumns = useMemo(
    () => GLOBAL_COLUMNS.filter((c) => globalColumns[c.key]),
    [globalColumns]
  );
  const visibleCategoryColumns = useMemo(
    () => CATEGORY_COLUMNS.filter((c) => categoryColumns[c.key]),
    [categoryColumns]
  );
  const visibleItemColumns = useMemo(
    () => ITEM_COLUMNS.filter((c) => itemColumns[c.key]),
    [itemColumns]
  );

  const totalGlobalWeight = useMemo(
    () => visibleGlobalColumns.reduce((sum, c) => sum + c.weight, 0) + ACTIONS_WEIGHT,
    [visibleGlobalColumns]
  );
  const totalCategoryWeight = useMemo(
    () => visibleCategoryColumns.reduce((sum, c) => sum + c.weight, 0) + ACTIONS_WEIGHT,
    [visibleCategoryColumns]
  );
  const totalItemWeight = useMemo(
    () => visibleItemColumns.reduce((sum, c) => sum + c.weight, 0) + ACTIONS_WEIGHT,
    [visibleItemColumns]
  );

  function setGlobalColumnVisible(key: GlobalColumnKey, nextValue: boolean) {
    setGlobalColumns((prev) => {
      if (!nextValue) {
        const visibleCount = GLOBAL_COLUMNS.filter((c) => prev[c.key]).length;
        if (visibleCount <= 1 && prev[key]) return prev;
      }
      return { ...prev, [key]: nextValue };
    });
  }

  function setCategoryColumnVisible(key: CategoryColumnKey, nextValue: boolean) {
    setCategoryColumns((prev) => {
      if (!nextValue) {
        const visibleCount = CATEGORY_COLUMNS.filter((c) => prev[c.key]).length;
        if (visibleCount <= 1 && prev[key]) return prev;
      }
      return { ...prev, [key]: nextValue };
    });
  }

  function setItemColumnVisible(key: ItemColumnKey, nextValue: boolean) {
    setItemColumns((prev) => {
      if (!nextValue) {
        const visibleCount = ITEM_COLUMNS.filter((c) => prev[c.key]).length;
        if (visibleCount <= 1 && prev[key]) return prev;
      }
      return { ...prev, [key]: nextValue };
    });
  }

  function resetColumnsForActiveTab() {
    if (activeTab === "global") setGlobalColumns({ ...DEFAULT_GLOBAL_COLUMNS });
    if (activeTab === "category") setCategoryColumns({ ...DEFAULT_CATEGORY_COLUMNS });
    if (activeTab === "item") setItemColumns({ ...DEFAULT_ITEM_COLUMNS });
  }

  function toggleItemGroup(groupKey: string) {
    setExpandedItemGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  }

  function renderGlobalCell(r: any, key: GlobalColumnKey): React.ReactNode {
    if (key === "id") return <span className="mono-cell">{r.id}</span>;
    if (key === "from_uom") return <span className="badge">{uomCode(r.from_uom)}</span>;
    if (key === "to_uom") return <span className="badge">{uomCode(r.to_uom)}</span>;
    if (key === "multiplier") return <span className="mono-cell">{r.multiplier}</span>;
    return renderStatus(r.status);
  }

  function renderCategoryCell(r: any, key: CategoryColumnKey): React.ReactNode {
    if (key === "id") return <span className="mono-cell">{r.id}</span>;
    if (key === "category") return <span title={itemCatName(r.category)}>{itemCatName(r.category)}</span>;
    if (key === "rule") {
      return (
        <span className="multiline-cell">
          <span className="badge">1 {uomCode(r.package_uom)}</span> = <b>{r.content_qty}</b> {uomCode(r.content_uom)}
        </span>
      );
    }
    return renderStatus(r.status);
  }

  function renderItemCell(r: any, key: ItemColumnKey): React.ReactNode {
    if (key === "id") return <span className="mono-cell">{r.id}</span>;
    if (key === "item") {
      const itemName = itemById.get(r.item)?.name ?? r.item;
      return <span title={String(itemName ?? "")}>{String(itemName ?? "-")}</span>;
    }
    if (key === "type") return <span className="badge">{ruleTypeLabel(r.rule_type)}</span>;
    if (key === "conditions") return <span className="multiline-cell">{formatRuleConditions(r)}</span>;
    if (key === "params") return <span className="multiline-cell">{formatRuleParams(r)}</span>;
    return renderStatus(r.status);
  }

  return (
    <div className="card">
      <PageHeader
        title="НСИ: Правила"
        subtitle="Список правил конвертации по уровням: глобальные, категории и номенклатура."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={() => nav("/nsi/rules/new")}>
              Создать новое правило
            </button>
          </>
        }
      />

      <div className="row" style={{ marginTop: 12 }}>
        <button className={activeTab === "global" ? "btn primary" : "btn"} onClick={() => setActiveTab("global")}>Глобальные</button>
        <button className={activeTab === "category" ? "btn primary" : "btn"} onClick={() => setActiveTab("category")}>Правила категорий</button>
        <button className={activeTab === "item" ? "btn primary" : "btn"} onClick={() => setActiveTab("item")}>Правила номенклатуры</button>
      </div>

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      {activeTab === "global" && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Глобальные правила</h4>
          <div className="card" style={{ marginTop: 8 }}>
            <div className="row nsi-rules-filter-row">
              <label style={{ flex: 1, minWidth: 260 }}>
                <small>Поиск</small><br />
                <input value={qGlobal} onChange={(e) => setQGlobal(e.target.value)} style={{ width: "100%" }} placeholder="ID, ЕИ, коэффициент, статус" />
              </label>
              <div className="nsi-rules-columns-menu" ref={columnsMenuRef}>
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
                  <div className="nsi-rules-columns-dropdown">
                    <small><strong>Отображаемые поля</strong></small>
                    {GLOBAL_COLUMNS.map((c) => {
                      const checked = globalColumns[c.key];
                      const isLastVisible = checked && visibleGlobalColumns.length === 1;
                      return (
                        <label key={c.key} className="nsi-rules-columns-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isLastVisible}
                            onChange={(e) => setGlobalColumnVisible(c.key, e.target.checked)}
                          />
                          <span>{c.label}</span>
                        </label>
                      );
                    })}
                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                      <button className="btn btn-tight" type="button" onClick={resetColumnsForActiveTab}>Все поля</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="table-wrap nsi-rules-table-wrap" style={{ marginTop: 8 }}>
            <table className="compact-table nsi-rules-table">
              <colgroup>
                {visibleGlobalColumns.map((c) => (
                  <col key={c.key} style={{ width: `${(c.weight / totalGlobalWeight) * 100}%` }} />
                ))}
                <col style={{ width: `${(ACTIONS_WEIGHT / totalGlobalWeight) * 100}%` }} />
              </colgroup>
              <thead>
                <tr>
                  {visibleGlobalColumns.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th className="nsi-actions-col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredGlobal.map((r: any) => (
                  <tr key={r.id}>
                    {visibleGlobalColumns.map((c) => <td key={c.key}>{renderGlobalCell(r, c.key)}</td>)}
                    <td className="nsi-actions-col">
                      <div className="row nsi-table-actions">
                        <button
                          className="btn btn-tight nsi-action-icon"
                          onClick={() => nav(`/nsi/rules/global/${r.id}/edit`)}
                          title="Редактировать"
                          aria-label="Редактировать"
                        >
                          ✎
                        </button>
                        <button
                          className="btn btn-tight danger nsi-action-icon"
                          onClick={() => removeGlobalRule(r.id)}
                          title="Удалить"
                          aria-label="Удалить"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredGlobal.length === 0 && (
                  <tr>
                    <td colSpan={visibleGlobalColumns.length + 1} className="empty-row"><small>Ничего не найдено.</small></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "category" && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Правила категорий</h4>
          <div className="card" style={{ marginTop: 8 }}>
            <div className="row nsi-rules-filter-row">
              <label style={{ flex: 1, minWidth: 260 }}>
                <small>Поиск</small><br />
                <input value={qCategory} onChange={(e) => setQCategory(e.target.value)} style={{ width: "100%" }} placeholder="ID, категория, ЕИ, статус" />
              </label>
              <div className="nsi-rules-columns-menu" ref={columnsMenuRef}>
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
                  <div className="nsi-rules-columns-dropdown">
                    <small><strong>Отображаемые поля</strong></small>
                    {CATEGORY_COLUMNS.map((c) => {
                      const checked = categoryColumns[c.key];
                      const isLastVisible = checked && visibleCategoryColumns.length === 1;
                      return (
                        <label key={c.key} className="nsi-rules-columns-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isLastVisible}
                            onChange={(e) => setCategoryColumnVisible(c.key, e.target.checked)}
                          />
                          <span>{c.label}</span>
                        </label>
                      );
                    })}
                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                      <button className="btn btn-tight" type="button" onClick={resetColumnsForActiveTab}>Все поля</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="table-wrap nsi-rules-table-wrap" style={{ marginTop: 8 }}>
            <table className="compact-table nsi-rules-table">
              <colgroup>
                {visibleCategoryColumns.map((c) => (
                  <col key={c.key} style={{ width: `${(c.weight / totalCategoryWeight) * 100}%` }} />
                ))}
                <col style={{ width: `${(ACTIONS_WEIGHT / totalCategoryWeight) * 100}%` }} />
              </colgroup>
              <thead>
                <tr>
                  {visibleCategoryColumns.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th className="nsi-actions-col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategory.map((p: any) => (
                  <tr key={p.id}>
                    {visibleCategoryColumns.map((c) => <td key={c.key}>{renderCategoryCell(p, c.key)}</td>)}
                    <td className="nsi-actions-col">
                      <div className="row nsi-table-actions">
                        <button
                          className="btn btn-tight nsi-action-icon"
                          onClick={() => nav(`/nsi/rules/category/${p.id}/edit`)}
                          title="Редактировать"
                          aria-label="Редактировать"
                        >
                          ✎
                        </button>
                        <button
                          className="btn btn-tight danger nsi-action-icon"
                          onClick={() => removeCategoryRule(p.id)}
                          title="Удалить"
                          aria-label="Удалить"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCategory.length === 0 && (
                  <tr>
                    <td colSpan={visibleCategoryColumns.length + 1} className="empty-row"><small>Ничего не найдено.</small></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "item" && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 0 }}>Правила номенклатуры</h4>
          <div className="card" style={{ marginTop: 8 }}>
            <div className="row nsi-rules-filter-row">
              <label style={{ flex: 1, minWidth: 260 }}>
                <small>Поиск</small><br />
                <input value={qItem} onChange={(e) => setQItem(e.target.value)} style={{ width: "100%" }} placeholder="ID, номенклатура, тип, условия, параметры" />
              </label>
              <div className="nsi-rules-columns-menu" ref={columnsMenuRef}>
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
                  <div className="nsi-rules-columns-dropdown">
                    <small><strong>Отображаемые поля</strong></small>
                    {ITEM_COLUMNS.map((c) => {
                      const checked = itemColumns[c.key];
                      const isLastVisible = checked && visibleItemColumns.length === 1;
                      return (
                        <label key={c.key} className="nsi-rules-columns-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isLastVisible}
                            onChange={(e) => setItemColumnVisible(c.key, e.target.checked)}
                          />
                          <span>{c.label}</span>
                        </label>
                      );
                    })}
                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                      <button className="btn btn-tight" type="button" onClick={resetColumnsForActiveTab}>Все поля</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="table-wrap nsi-rules-table-wrap" style={{ marginTop: 8 }}>
            <table className="compact-table nsi-rules-table">
              <colgroup>
                {visibleItemColumns.map((c) => (
                  <col key={c.key} style={{ width: `${(c.weight / totalItemWeight) * 100}%` }} />
                ))}
                <col style={{ width: `${(ACTIONS_WEIGHT / totalItemWeight) * 100}%` }} />
              </colgroup>
              <thead>
                <tr>
                  {visibleItemColumns.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th className="nsi-actions-col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {groupedItemRules.map((group) => {
                  const expanded = !!expandedItemGroups[group.key];
                  return (
                    <React.Fragment key={group.key}>
                      <tr className={`nsi-rules-group-row ${expanded ? "expanded" : ""}`}>
                        <td colSpan={visibleItemColumns.length + 1}>
                          <button
                            type="button"
                            className="nsi-rules-group-toggle"
                            onClick={() => toggleItemGroup(group.key)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                          >
                            {expanded ? "▾" : "▸"}
                          </button>
                          <strong>{group.itemName}</strong>
                          <small className="nsi-rules-group-meta">
                            правил: {group.totalRules}, категорий: {group.categories.length}
                          </small>
                        </td>
                      </tr>
                      {expanded && group.categories.map((catGroup) => (
                        <React.Fragment key={`${group.key}_${catGroup.key}`}>
                          <tr className="nsi-rules-subgroup-row">
                            <td colSpan={visibleItemColumns.length + 1}>
                              <span className="badge">{catGroup.label}</span>
                              <small className="nsi-rules-subgroup-meta">правил: {catGroup.rules.length}</small>
                            </td>
                          </tr>
                          {catGroup.rules.map((r: any) => (
                            <tr key={r.id}>
                              {visibleItemColumns.map((c) => <td key={c.key}>{renderItemCell(r, c.key)}</td>)}
                              <td className="nsi-actions-col">
                                <div className="row nsi-table-actions">
                                  <button
                                    className="btn btn-tight nsi-action-icon"
                                    onClick={() => nav(`/nsi/rules/item/${r.id}/edit`)}
                                    title="Редактировать"
                                    aria-label="Редактировать"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    className="btn btn-tight danger nsi-action-icon"
                                    onClick={() => removeItemRule(r.id)}
                                    title="Удалить"
                                    aria-label="Удалить"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  );
                })}
                {groupedItemRules.length === 0 && (
                  <tr>
                    <td colSpan={visibleItemColumns.length + 1} className="empty-row"><small>Ничего не найдено.</small></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
