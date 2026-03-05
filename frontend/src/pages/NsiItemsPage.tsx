import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";
import { toNum } from "./nsi_utils";

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
        <div className="row">
          <label style={{ flex: 1 }}>
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
        </div>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Категория</th>
            <th>Единица хранения</th>
            <th>Источник</th>
            <th>Активен</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it: any) => {
            const su = itemStorageUomId(it);
            const src = uomSource(it);
            return (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>{it.name}</td>
                <td>{catName(it.category)}</td>
                <td><span className="badge">{uomCode(su)}</span></td>
                <td>
                  {src === "default" ? <span className="badge">по умолчанию</span> :
                   src === "manual" ? <span className="badge">вручную</span> : "—"}
                </td>
                <td>{String(it.is_active)}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => nav(`/nsi/items/${it.id}/edit`)} style={{ marginRight: 8 }}>
                    Редактировать
                  </button>
                  <button className="btn" onClick={() => remove(it.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><td colSpan={7}><small>Ничего не найдено.</small></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
