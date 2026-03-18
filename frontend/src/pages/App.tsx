import React, { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import InvoicesPage from "./InvoicesPage";
import InvoiceDetailPage from "./InvoiceDetailPage";
import CreateInvoicePage from "./CreateInvoicePage";
import NsiUomsPage from "./NsiUomsPage";
import NsiUomCreatePage from "./NsiUomCreatePage";
import NsiUomEditPage from "./NsiUomEditPage";
import NsiItemsPage from "./NsiItemsPage";
import NsiItemCreatePage from "./NsiItemCreatePage";
import NsiItemEditPage from "./NsiItemEditPage";
import NsiItemCategoriesPage from "./NsiItemCategoriesPage";
import NsiItemCategoryCreatePage from "./NsiItemCategoryCreatePage";
import NsiItemCategoryEditPage from "./NsiItemCategoryEditPage";
import NsiPackagesPage from "./NsiPackagesPage";
import NsiPackageCreatePage from "./NsiPackageCreatePage";
import NsiPackageEditPage from "./NsiPackageEditPage";
import NsiRulesPage from "./NsiRulesPage";
import NsiRulesWizardPage from "./NsiRulesWizardPage";
import AdminConsolePage from "./AdminConsolePage";
import QuickCalculatorPage from "./QuickCalculatorPage";

export default function App() {
  const { keycloak, token } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("ui_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const realmRoles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const isAdmin = realmRoles.includes("system.admin");

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
          <h2 style={{ margin: 0 }}>{"\u041a\u043e\u043d\u0432\u0435\u0440\u0442\u0435\u0440"}</h2>
          <Link to="/">{"\u041d\u0430\u043a\u043b\u0430\u0434\u043d\u044b\u0435"}</Link>
          <Link to="/create">{"\u0421\u043e\u0437\u0434\u0430\u0442\u044c"}</Link>
          <Link to="/calculator">{"\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440"}</Link>
          <span className="badge">{"\u041d\u0421\u0418"}</span>
          <Link to="/nsi/uoms">{"\u0415\u0418"}</Link>
          <Link to="/nsi/item-categories">{"\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438"}</Link>
          <Link to="/nsi/items">{"\u041d\u043e\u043c\u0435\u043d\u043a\u043b\u0430\u0442\u0443\u0440\u0430"}</Link>
          <Link to="/nsi/packages">{"\u0423\u043f\u0430\u043a\u043e\u0432\u043a\u0438"}</Link>
          <Link to="/nsi/rules">{"\u041f\u0440\u0430\u0432\u0438\u043b\u0430"}</Link>
          <a href={import.meta.env.VITE_DOCS_BASE_URL + "/api/docs/"} target="_blank" rel="noreferrer">
            Docs API
          </a>
          <a href={import.meta.env.VITE_NSI_BASE_URL + "/api/docs/"} target="_blank" rel="noreferrer">
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
              {"\u0410\u0434\u043c\u0438\u043d \u043f\u0430\u043d\u0435\u043b\u044c"}
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
          <small>{keycloak.tokenParsed?.preferred_username}</small>
          <button className="btn" onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
            {"\u0412\u044b\u0439\u0442\u0438"}
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
        <small>{"by \u041c\u043e\u0434\u0443\u043b\u044c \u0426\u0438\u0444\u0440\u043e\u0432\u0438\u0437\u0430\u0446\u0438\u044f \u041f\u0440\u043e\u0435\u043a\u0442\u043d\u044b\u0445 \u0417\u0430\u0434\u0430\u0447"}</small>
      </footer>
    </div>
  );
}
