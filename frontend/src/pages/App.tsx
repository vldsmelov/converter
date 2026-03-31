import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import BrandLogo from "../components/BrandLogo";
import { resolveHelpTopic } from "../lib/help";
import AdminConsolePage from "./AdminConsolePage";
import CreateInvoicePage from "./CreateInvoicePage";
import FeedbackInboxPage from "./FeedbackInboxPage";
import HelpPage from "./HelpPage";
import InvoiceDetailPage from "./InvoiceDetailPage";
import InvoicesPage from "./InvoicesPage";
import NsiItemCategoriesPage from "./NsiItemCategoriesPage";
import NsiItemCategoryCreatePage from "./NsiItemCategoryCreatePage";
import NsiItemCategoryEditPage from "./NsiItemCategoryEditPage";
import NsiItemCreatePage from "./NsiItemCreatePage";
import NsiItemEditPage from "./NsiItemEditPage";
import NsiItemsPage from "./NsiItemsPage";
import NsiPackageCreatePage from "./NsiPackageCreatePage";
import NsiPackageEditPage from "./NsiPackageEditPage";
import NsiPackagesPage from "./NsiPackagesPage";
import NsiRulesPage from "./NsiRulesPage";
import NsiRulesWizardPage from "./NsiRulesWizardPage";
import NsiUomCreatePage from "./NsiUomCreatePage";
import NsiUomEditPage from "./NsiUomEditPage";
import NsiUomsPage from "./NsiUomsPage";
import PublicFeedbackPage from "./PublicFeedbackPage";
import QuickCalculatorPage from "./QuickCalculatorPage";

type NavLinkItem = {
  to: string;
  label: string;
};

const INVOICE_LINKS: NavLinkItem[] = [
  { to: "/app", label: "Реестр накладных" },
  { to: "/create", label: "Создать накладную" },
];

const DIRECTORY_LINKS: NavLinkItem[] = [
  { to: "/nsi/items", label: "Номенклатура" },
  { to: "/nsi/item-categories", label: "Категории" },
  { to: "/nsi/uoms", label: "Единицы измерения" },
  { to: "/nsi/packages", label: "Упаковки" },
  { to: "/nsi/rules", label: "Правила конвертации" },
];

export default function App() {
  const { keycloak, token } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("ui_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const isAdmin = useMemo(() => realmRoles.includes("system.admin"), [realmRoles]);
  const canReadFeedback = useMemo(
    () => isAdmin || realmRoles.includes("documents.feedback.read"),
    [isAdmin, realmRoles]
  );
  const currentHelpTopic = useMemo(() => resolveHelpTopic(location.pathname), [location.pathname]);
  const helpUrl = useMemo(
    () => `/help/${currentHelpTopic}?from=${encodeURIComponent(location.pathname)}`,
    [currentHelpTopic, location.pathname]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("ui_theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("last_app_path", location.pathname);
    } catch {
      // ignore storage errors
    }
  }, [location.pathname]);

  function openAdminPanel() {
    const w = window.open("/admin/console", "admin_console", "popup=yes,width=1320,height=900");
    if (!w) window.location.assign("/admin/console");
  }

  return (
    <div className="container app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <Link to="/app" className="brand-link" aria-label="Главная">
            <BrandLogo />
          </Link>

          <div className="nav-cluster">
            <div className="nav-dropdown">
              <button type="button" className="nav-pill dropdown-trigger">
                Накладные
              </button>
              <div className="nav-dropdown-menu">
                {INVOICE_LINKS.map((l) => (
                  <Link key={l.to} to={l.to} className="nav-dropdown-item">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            <Link className="btn primary nav-cta" to="/nsi/items/new">
              Добавить номенклатуру
            </Link>

            <div className="nav-dropdown">
              <button type="button" className="nav-pill dropdown-trigger">
                Справочники
              </button>
              <div className="nav-dropdown-menu">
                {DIRECTORY_LINKS.map((l) => (
                  <Link key={l.to} to={l.to} className="nav-dropdown-item">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            <Link className="nav-pill" to="/calculator">
              Калькулятор
            </Link>
          </div>
        </div>

        <div className="topbar-right">
          {isAdmin && (
            <>
              <a className="nav-pill" href={`${import.meta.env.VITE_DOCS_BASE_URL}/api/docs/`} target="_blank" rel="noreferrer">
                Docs API
              </a>
              <a className="nav-pill" href={`${import.meta.env.VITE_NSI_BASE_URL}/api/docs/`} target="_blank" rel="noreferrer">
                NSI API
              </a>
            </>
          )}

          <Link className="btn btn-tight" to={helpUrl}>Инструкция</Link>
          <Link className="btn btn-tight" to={canReadFeedback ? "/feedback/inbox" : "/feedback"}>
            Обратная связь
          </Link>

          {isAdmin && (
            <button
              className="btn btn-tight"
              onClick={openAdminPanel}
              title="Открыть админ-панель в отдельном окне"
              aria-label="Открыть админ-панель"
            >
              Админ панель
            </button>
          )}

          <button
            className="btn icon-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>

          <small className="topbar-user">{keycloak.tokenParsed?.preferred_username}</small>
          <button className="btn" onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
            Выйти
          </button>
        </div>
      </header>

      <div className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<InvoicesPage />} />
          <Route path="/create" element={<CreateInvoicePage />} />
          <Route path="/calculator" element={<QuickCalculatorPage token={token} />} />
          <Route path="/feedback" element={<PublicFeedbackPage />} />
          <Route path="/help" element={<Navigate to="/help/general" replace />} />
          <Route path="/help/:topic" element={<HelpPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />

          <Route path="/nsi/uoms" element={<NsiUomsPage />} />
          <Route path="/nsi/uoms/new" element={<NsiUomCreatePage />} />
          <Route path="/nsi/uoms/:id/edit" element={<NsiUomEditPage />} />

          <Route path="/nsi/items" element={<NsiItemsPage />} />
          <Route path="/nsi/items/new" element={<NsiItemCreatePage />} />
          <Route path="/nsi/items/:id/edit" element={<NsiItemEditPage />} />

          <Route path="/nsi/item-categories" element={<NsiItemCategoriesPage />} />
          <Route path="/nsi/item-categories/new" element={<NsiItemCategoryCreatePage />} />
          <Route path="/nsi/item-categories/:id/edit" element={<NsiItemCategoryEditPage />} />

          <Route path="/nsi/packages" element={<NsiPackagesPage />} />
          <Route path="/nsi/packages/new" element={<NsiPackageCreatePage />} />
          <Route path="/nsi/packages/:id/edit" element={<NsiPackageEditPage />} />

          <Route path="/nsi/rules" element={<NsiRulesPage />} />
          <Route path="/nsi/rules/new" element={<NsiRulesWizardPage />} />
          <Route path="/nsi/rules/:scope/:id/edit" element={<NsiRulesWizardPage />} />

          <Route path="/feedback/inbox" element={<FeedbackInboxPage />} />
          <Route path="/admin/console" element={<AdminConsolePage />} />
        </Routes>
      </div>

      <footer className="app-footer">
        <small>by Модуль Цифровизация Проектных Задач</small>
      </footer>
    </div>
  );
}
