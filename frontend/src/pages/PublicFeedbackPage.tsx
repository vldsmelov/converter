import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, requestJson } from "../api/request";
import BrandLogo from "../components/BrandLogo";
import PageHeader from "../components/PageHeader";

type FeedbackCreateResponse = {
  id: number;
  created_at: string;
};

type FeedbackKind = "bug" | "suggestion" | "question" | "other";

function detectPagePath() {
  try {
    return window.sessionStorage.getItem("last_app_path") || "";
  } catch {
    return "";
  }
}

export default function PublicFeedbackPage() {
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [pagePath, setPagePath] = useState(() => detectPagePath());
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<FeedbackCreateResponse | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 2 && message.trim().length > 5, [title, message]);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setErr(null);
    setOk(null);
    try {
      const created = await requestJson<FeedbackCreateResponse>({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/feedback/`,
        body: {
          kind,
          title: title.trim(),
          message: message.trim(),
          page_path: pagePath.trim(),
          sender_name: senderName.trim(),
          sender_email: senderEmail.trim(),
        },
      });
      setOk(created);
      setTitle("");
      setMessage("");
      setPagePath(detectPagePath());
      setSenderName("");
      setSenderEmail("");
    } catch (e: any) {
      if (e instanceof ApiError) {
        try {
          const body = JSON.parse(e.bodyText);
          setErr(typeof body?.detail === "string" ? body.detail : e.message);
        } catch {
          setErr(e.message);
        }
      } else {
        setErr(e?.message ?? String(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container app-shell" style={{ paddingTop: 16 }}>
      <div className="card feedback-card">
        <div className="row" style={{ marginBottom: 8 }}>
          <BrandLogo compact />
        </div>
        <PageHeader
          title="Обратная связь"
          subtitle="Сообщите об ошибке, предложении или вопросе. Авторизация не требуется."
          right={
            <>
              <Link className="btn btn-tight" to="/help/feedback_form?from=/feedback">Инструкция</Link>
              <a className="btn btn-tight" href="/app">Войти в систему</a>
            </>
          }
        />

        {err && <div className="error-banner">{err}</div>}
        {ok && (
          <div className="card" style={{ marginTop: 10 }}>
            <small>Сообщение отправлено. Номер: #{ok.id}</small>
          </div>
        )}

        <div className="card" style={{ marginTop: 10 }}>
          <div className="feedback-grid">
            <label className="field">
              <small>Тип сообщения</small>
              <select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
                <option value="suggestion">Предложение</option>
                <option value="bug">Ошибка</option>
                <option value="question">Вопрос</option>
                <option value="other">Другое</option>
              </select>
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <small>Тема</small>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Коротко о сути" />
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <small>Описание</small>
              <textarea
                className="feedback-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Что произошло, как воспроизвести, что ожидали увидеть"
              />
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <small>Страница (опционально)</small>
              <input value={pagePath} onChange={(e) => setPagePath(e.target.value)} placeholder="/calculator" />
            </label>

            <label className="field">
              <small>Имя (опционально)</small>
              <input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </label>

            <label className="field">
              <small>Эл. почта (опционально)</small>
              <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="name@example.com" />
            </label>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={submit} disabled={!canSubmit || submitting}>
              {submitting ? "Отправляю..." : "Отправить"}
            </button>
            <Link className="btn" to="/">К калькулятору</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
