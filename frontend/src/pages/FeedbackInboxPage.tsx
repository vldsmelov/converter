import React, { useEffect, useMemo, useState } from "react";
import { requestJson } from "../api/request";
import { useAuth } from "../auth/AuthProvider";
import PageHeader from "../components/PageHeader";

type FeedbackRow = {
  id: number;
  kind: "bug" | "suggestion" | "question" | "other";
  title: string;
  message: string;
  page_path: string;
  sender_name: string;
  sender_email: string;
  status: "new" | "in_progress" | "done";
  admin_note: string;
  created_at: string;
  updated_at: string;
};

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "-";
  return new Date(v).toLocaleString();
}

function feedbackKindLabel(v: FeedbackRow["kind"]) {
  if (v === "bug") return "Ошибка";
  if (v === "suggestion") return "Предложение";
  if (v === "question") return "Вопрос";
  if (v === "other") return "Другое";
  return v;
}

function feedbackStatusLabel(v: FeedbackRow["status"]) {
  if (v === "new") return "Новый";
  if (v === "in_progress") return "В работе";
  if (v === "done") return "Закрыт";
  return v;
}

export default function FeedbackInboxPage() {
  const { token, keycloak } = useAuth();
  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const canRead = useMemo(
    () => realmRoles.includes("system.admin") || realmRoles.includes("documents.feedback.read"),
    [realmRoles]
  );
  const canWrite = useMemo(
    () => realmRoles.includes("system.admin") || realmRoles.includes("documents.feedback.write"),
    [realmRoles]
  );

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [statusDraft, setStatusDraft] = useState<Record<number, FeedbackRow["status"]>>({});
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  async function load() {
    if (!token || !canRead) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await requestJson<FeedbackRow[]>({
        method: "GET",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/feedback/`,
        token,
      });
      setRows(data ?? []);
      setStatusDraft(Object.fromEntries((data ?? []).map((x) => [x.id, x.status])));
      setNoteDraft(Object.fromEntries((data ?? []).map((x) => [x.id, x.admin_note ?? ""])));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canRead]);

  async function saveRow(row: FeedbackRow) {
    if (!token || !canWrite) return;
    setSavingId(row.id);
    setErr(null);
    try {
      await requestJson({
        method: "PATCH",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/feedback/${row.id}/`,
        token,
        body: {
          status: statusDraft[row.id] ?? row.status,
          admin_note: noteDraft[row.id] ?? "",
        },
      });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  if (!canRead) {
    return (
      <div className="card">
        <PageHeader title="Обратная связь" subtitle="Недостаточно прав для просмотра входящих сообщений." />
      </div>
    );
  }

  return (
    <div className="card">
      <PageHeader
        title="Входящие: обратная связь"
        subtitle={`Всего сообщений: ${rows.length}`}
        right={<button className="btn btn-tight" onClick={load} disabled={loading}>{loading ? "Загрузка..." : "Обновить"}</button>}
      />

      {err && <div className="error-banner">{err}</div>}

      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="compact-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Создано</th>
              <th>Тип</th>
              <th>Тема</th>
              <th>Сообщение</th>
              <th>Страница</th>
              <th>Контакт</th>
              <th>Статус</th>
              <th>Заметка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.id}</td>
                <td><small>{fmtDateTime(r.created_at)}</small></td>
                <td><span className="badge">{feedbackKindLabel(r.kind)}</span></td>
                <td>{r.title}</td>
                <td style={{ minWidth: 240, whiteSpace: "pre-wrap" }}>{r.message}</td>
                <td><small>{r.page_path || "-"}</small></td>
                <td>
                  <small>{r.sender_name || "-"}</small>
                  <div><small>{r.sender_email || "-"}</small></div>
                </td>
                <td>
                  <select
                    value={statusDraft[r.id] ?? r.status}
                    onChange={(e) => setStatusDraft((prev) => ({ ...prev, [r.id]: e.target.value as FeedbackRow["status"] }))}
                    disabled={!canWrite}
                  >
                    <option value="new">{feedbackStatusLabel("new")}</option>
                    <option value="in_progress">{feedbackStatusLabel("in_progress")}</option>
                    <option value="done">{feedbackStatusLabel("done")}</option>
                  </select>
                </td>
                <td style={{ minWidth: 220 }}>
                  <textarea
                    className="feedback-note"
                    value={noteDraft[r.id] ?? ""}
                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    disabled={!canWrite}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  {canWrite && (
                    <button className="btn btn-tight" onClick={() => saveRow(r)} disabled={savingId === r.id}>
                      {savingId === r.id ? "Сохраняю..." : "Сохранить"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10}><small>Сообщений пока нет.</small></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
