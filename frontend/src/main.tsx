import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import App from "./pages/App";
import QuickCalculatorPage from "./pages/QuickCalculatorPage";
import PublicLandingPage from "./pages/PublicLandingPage";
import "./styles.css";

const pathname = window.location.pathname;
const isPublicRoute = pathname.startsWith("/calculator") || pathname.startsWith("/landing");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPublicRoute ? (
      <BrowserRouter>
        <Routes>
          <Route path="/landing" element={<PublicLandingPage />} />
          <Route path="/calculator" element={<QuickCalculatorPage publicMode />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
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
