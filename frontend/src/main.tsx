import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import App from "./pages/App";
import HelpPage from "./pages/HelpPage";
import PublicFeedbackPage from "./pages/PublicFeedbackPage";
import QuickCalculatorPage from "./pages/QuickCalculatorPage";
import PublicLandingPage from "./pages/PublicLandingPage";
import "./styles.css";

const pathname = window.location.pathname;
const isPublicRoute =
  pathname === "/" ||
  pathname.startsWith("/calculator") ||
  pathname.startsWith("/landing") ||
  pathname === "/feedback" ||
  pathname === "/help" ||
  pathname.startsWith("/help/");

function PublicApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QuickCalculatorPage publicMode />} />
        <Route path="/landing" element={<PublicLandingPage />} />
        <Route path="/calculator" element={<QuickCalculatorPage publicMode />} />
        <Route path="/feedback" element={<PublicFeedbackPage />} />
        <Route path="/help" element={<Navigate to="/help/general" replace />} />
        <Route path="/help/:topic" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PrivateApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPublicRoute ? <PublicApp /> : <PrivateApp />}
  </React.StrictMode>
);
