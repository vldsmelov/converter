import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AdminConsolePage from "./AdminConsolePage";
import CreateInvoicePage from "./CreateInvoicePage";
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
import QuickCalculatorPage from "./QuickCalculatorPage";

type NavLinkItem = {
  to: string;
  label: string;
};

const PRIMARY_LINKS: NavLinkItem[] = [
  { to: "/", label: "Накладные" },
  { to: "/create", label: "Создать" },
  { to: "/calculator", label: "Калькулятор" },
];

const NSI_LINKS: NavLinkItem[] = [
  { to: "/nsi/uoms", label: "ЕИ" },
  { to: "/nsi/item-categories", label: "Категории" },
  { to: "/nsi/items", label: "Номенклатура" },
  { to: "/nsi/packages", label: "Упаковки" },
  { to: "/nsi/rules", label: "Правила" },
];

export default function App() {
  const { keycloak, token } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("ui_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const isAdmin = useMemo(() => realmRoles.includes("system.admin"), [realmRoles]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("ui_theme", theme);
  }, [theme]);

  function openAdminPanel() {
    const w = window.open("/admin/console", "admin_console", "popup=yes,width=1320,height=900");
    if (!w) window.location.assign("/admin/console");
  }

  return (
    <div className="container app-shell">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="row" style={{ gap: 16 }}>
          <h2 style={{ margin: 0 }}>Конвертер</h2>

          {PRIMARY_LINKS.map((l) => (
            <Link key={l.to} to={l.to}>{l.label}</Link>
          ))}

          <span className="badge">НСИ</span>

          {NSI_LINKS.map((l) => (
            <Link key={l.to} to={l.to}>{l.label}</Link>
          ))}

          <a href={`${import.meta.env.VITE_DOCS_BASE_URL}/api/docs/`} target="_blank" rel="noreferrer">
            Docs API
          </a>
          <a href={`${import.meta.env.VITE_NSI_BASE_URL}/api/docs/`} target="_blank" rel="noreferrer">
            NSI API
          </a>
        </div>

        <div className="row" style={{ gap: 8 }}>
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
            {theme === "dark" ? "☀" : "☾"}
          </button>

          <small>{keycloak.tokenParsed?.preferred_username}</small>
          <button className="btn" onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
            Выйти
          </button>
        </div>
      </div>

      <div className="app-main">
        <Routes>
          <Route path="/" element={<InvoicesPage />} />
          <Route path="/create" element={<CreateInvoicePage />} />
          <Route path="/calculator" element={<QuickCalculatorPage token={token} />} />
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

          <Route path="/admin/console" element={<AdminConsolePage />} />
        </Routes>
      </div>

      <footer className="app-footer">
        <small>by Модуль Цифровизация Проектных Задач</small>
      </footer>
    </div>
  );
}

