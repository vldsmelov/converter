import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AppFooter from "../components/AppFooter";
import SiteTopbar from "../components/SiteTopbar";
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
import NsiCounterpartiesPage from "./NsiCounterpartiesPage";
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
  const userMenuLabel = String(keycloak.tokenParsed?.preferred_username ?? "").trim() || "Пользователь";

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
    <>
      <SiteTopbar
        userMenuLabel={userMenuLabel}
        isAdmin={isAdmin}
        canReadFeedback={canReadFeedback}
        helpUrl={helpUrl}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onOpenAdminPanel={openAdminPanel}
        onLogout={() => keycloak.logout({ redirectUri: window.location.origin })}
      />

      <div className="container app-shell">
        <div className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/calculator" replace />} />
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
            <Route path="/nsi/counterparties" element={<NsiCounterpartiesPage />} />

            <Route path="/nsi/packages" element={<NsiPackagesPage />} />
            <Route path="/nsi/packages/new" element={<NsiPackageCreatePage />} />
            <Route path="/nsi/packages/:id/edit" element={<NsiPackageEditPage />} />

            <Route path="/nsi/rules" element={<NsiRulesPage />} />
            <Route path="/nsi/rules/new" element={<NsiRulesWizardPage />} />
            <Route path="/nsi/rules/:scope/:id/edit" element={<NsiRulesWizardPage />} />

            <Route path="/feedback/inbox" element={<FeedbackInboxPage />} />
            <Route path="/admin/console" element={<AdminConsolePage />} />
            <Route path="*" element={<Navigate to="/calculator" replace />} />
          </Routes>
        </div>

        <AppFooter />
      </div>
    </>
  );
}
