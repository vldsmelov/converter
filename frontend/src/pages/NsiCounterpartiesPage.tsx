import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

type Counterparty = {
  id: number;
  name: string;
  is_active: boolean;
};

export default function NsiCounterpartiesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Counterparty[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);
  const [savingNew, setSavingNew] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const data = await requestJson<any[]>({
        method: "GET",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/counterparties/`,
        token,
      });
      setRows((data ?? []).map((r: any) => ({
        id: Number(r.id),
        name: String(r.name ?? ""),
        is_active: !!r.is_active,
      })));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(qq));
  }, [rows, q]);

  function openCreateModal() {
    setNewName("");
    setNewIsActive(true);
    setModalOpen(true);
  }

  async function createRow() {
    if (!token) return;
    const name = newName.trim();
    if (!name) {
      setErr("Укажите название контрагента.");
      return;
    }
    setErr(null);
    setSavingNew(true);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/counterparties/`,
        token,
        body: { name, is_active: newIsActive },
      });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSavingNew(false);
    }
  }

  function startEdit(row: Counterparty) {
    setEditId(row.id);
    setEditName(row.name);
    setEditIsActive(row.is_active);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditIsActive(true);
  }

  async function saveEdit() {
    if (!token || !editId) return;
    const name = editName.trim();
    if (!name) {
      setErr("Укажите название контрагента.");
      return;
    }
    setErr(null);
    try {
      await requestJson({
        method: "PUT",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/counterparties/${editId}/`,
        token,
        body: { name, is_active: editIsActive },
      });
      cancelEdit();
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function removeRow(id: number) {
    if (!token) return;
    if (!confirm("Удалить контрагента?")) return;
    setErr(null);
    try {
      await requestJson({
        method: "DELETE",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/counterparties/${id}/`,
        token,
      });
      if (editId === id) cancelEdit();
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div className="card">
      <PageHeader
        title="НСИ: Контрагенты"
        subtitle="Справочник поставщиков для вариантов правил перевода."
        right={
          <>
            <button className="btn" onClick={load}>Обновить</button>
            <button className="btn primary" onClick={openCreateModal}>Создать контрагента</button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 12 }}>
        <label style={{ width: "100%" }}>
          <small>Поиск</small><br />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%" }}
            placeholder="например: Компания А"
          />
        </label>
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="compact-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Активен</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const editing = editId === r.id;
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {editing ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%" }} />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <label className="row" style={{ gap: 6 }}>
                        <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                        <small>{editIsActive ? "да" : "нет"}</small>
                      </label>
                    ) : (
                      <span className={`badge ${r.is_active ? "status-ok" : "status-bad"}`}>{r.is_active ? "да" : "нет"}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {editing ? (
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="btn btn-tight" onClick={cancelEdit}>Отмена</button>
                        <button className="btn btn-tight primary" onClick={saveEdit}>Сохранить</button>
                      </div>
                    ) : (
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="btn btn-tight" onClick={() => startEdit(r)}>Редактировать</button>
                        <button className="btn btn-tight danger" onClick={() => removeRow(r.id)}>Удалить</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  <small>Контрагенты не найдены.</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h4 style={{ marginTop: 0 }}>Новый контрагент</h4>
            <div className="row">
              <label style={{ flex: 1 }}>
                <small>Название</small><br />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
                <small>Активен</small>
              </label>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn" onClick={() => setModalOpen(false)} disabled={savingNew}>Отмена</button>
              <button className="btn primary" onClick={createRow} disabled={savingNew}>
                {savingNew ? "Сохраняем..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
