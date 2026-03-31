import React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import PageHeader from "../components/PageHeader";
import { HELP_ARTICLES, HelpTopic } from "../lib/help";

const ORDERED_TOPICS: HelpTopic[] = [
  "calculator",
  "invoices",
  "invoice_create",
  "invoice_detail",
  "nsi_uoms",
  "nsi_categories",
  "nsi_items",
  "nsi_packages",
  "nsi_rules",
  "nsi_rule_wizard",
  "admin_console",
  "feedback_form",
  "feedback_inbox",
  "general",
];

export default function HelpPage() {
  const nav = useNavigate();
  const location = useLocation();
  const params = useParams<{ topic?: string }>();
  const q = new URLSearchParams(location.search);
  const from = q.get("from") || "";

  const topic = params.topic as HelpTopic | undefined;
  const article = (topic && HELP_ARTICLES[topic]) ? HELP_ARTICLES[topic] : HELP_ARTICLES.general;
  const fromPath = from.startsWith("/") ? from : "";

  return (
    <div className="container app-shell" style={{ paddingTop: 16 }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <BrandLogo compact />
        </div>
        <PageHeader
          title={article.title}
          subtitle={article.summary}
          right={
            <>
              {fromPath && (
                <button className="btn btn-tight" onClick={() => nav(fromPath)}>
                  Назад к странице
                </button>
              )}
              <Link className="btn btn-tight" to="/feedback">Обратная связь</Link>
              <a className="btn btn-tight" href="/app">Войти в систему</a>
            </>
          }
        />

        <div className="help-grid" style={{ marginTop: 10 }}>
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Как работать</h4>
            <ol className="help-list">
              {article.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="card">
            <h4 style={{ marginTop: 0 }}>Подсказки</h4>
            <ul className="help-list">
              {article.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card" style={{ marginTop: 10 }}>
          <h4 style={{ marginTop: 0 }}>Все инструкции</h4>
          <div className="help-links">
            {ORDERED_TOPICS.map((k) => (
              <Link key={k} className="btn btn-tight" to={`/help/${k}${fromPath ? `?from=${encodeURIComponent(fromPath)}` : ""}`}>
                {HELP_ARTICLES[k].title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
