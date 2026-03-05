import React from "react";
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
import NsiRulesPage from "./NsiRulesPage";
import NsiRulesWizardPage from "./NsiRulesWizardPage";

export default function App() {
  const { keycloak } = useAuth();

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="row" style={{ gap: 16 }}>
          <h2 style={{ margin: 0 }}>Конвертер</h2>
          <Link to="/">Накладные</Link>
          <Link to="/create">Создать</Link>
          <span className="badge">НСИ</span>
          <Link to="/nsi/uoms">ЕИ</Link>
          <Link to="/nsi/item-categories">Категории</Link>
          <Link to="/nsi/items">Номенклатура</Link>
          <Link to="/nsi/packages">Упаковки</Link>
          <Link to="/nsi/rules">Правила</Link>
          <a href={import.meta.env.VITE_DOCS_BASE_URL + "/api/docs/"} target="_blank" rel="noreferrer">
            Docs API
          </a>
          <a href={import.meta.env.VITE_NSI_BASE_URL + "/api/docs/"} target="_blank" rel="noreferrer">
            NSI API
          </a>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <small>{keycloak.tokenParsed?.preferred_username}</small>
          <button className="btn" onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
            Выйти
          </button>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<InvoicesPage />} />
        <Route path="/create" element={<CreateInvoicePage />} />
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
        <Route path="/nsi/rules" element={<NsiRulesPage />} />
        <Route path="/nsi/rules/new" element={<NsiRulesWizardPage />} />
      </Routes>
    </div>
  );
}
