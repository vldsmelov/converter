import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import App from "./pages/App";
import QuickCalculatorPage from "./pages/QuickCalculatorPage";
import "./styles.css";

const isPublicCalculator = window.location.pathname.startsWith("/calculator");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPublicCalculator ? (
      <BrowserRouter>
        <Routes>
          <Route path="/calculator" element={<QuickCalculatorPage publicMode />} />
          <Route path="*" element={<Navigate to="/calculator" replace />} />
        </Routes>
      </BrowserRouter>
    ) : (
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    )}
  </React.StrictMode>
);
