import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

type NavLinkItem = { to: string; label: string };

const INVOICE_LINKS: NavLinkItem[] = [
  { to: "/app", label: "Реестр накладных" },
  { to: "/create", label: "Создать накладную" },
];

const DIRECTORY_LINKS: NavLinkItem[] = [
  { to: "/nsi/items", label: "Номенклатура" },
  { to: "/nsi/item-categories", label: "Категории" },
  { to: "/nsi/counterparties", label: "Контрагенты" },
  { to: "/nsi/uoms", label: "Единицы измерения" },
  { to: "/nsi/packages", label: "Упаковки" },
  { to: "/nsi/rules", label: "Правила конвертации" },
];

function MenuLink(props: { to: string; label: string; forceReload?: boolean; className?: string }) {
  if (props.forceReload) {
    return (
      <a href={props.to} className={props.className}>
        {props.label}
      </a>
    );
  }
  return (
    <Link to={props.to} className={props.className}>
      {props.label}
    </Link>
  );
}

export default function SiteTopbar(props: {
  publicMode?: boolean;
  userMenuLabel?: string;
  isAdmin?: boolean;
  canReadFeedback?: boolean;
  theme?: "dark" | "light";
  helpUrl?: string;
  onToggleTheme?: () => void;
  onOpenAdminPanel?: () => void;
  onLogout?: () => void;
}) {
  const isPublic = !!props.publicMode;
  const forceReload = isPublic;
  const userMenuLabel = props.userMenuLabel || "Пользователь";

  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <div className="topbar-left">
          {isPublic ? (
            <a href="/" className="brand-link" aria-label="Главная">
              <BrandLogo />
            </a>
          ) : (
            <Link to="/app" className="brand-link" aria-label="Главная">
              <BrandLogo />
            </Link>
          )}

          <div className="nav-cluster">
            <MenuLink className="btn nav-cta" to="/nsi/items/new" label="Добавить номенклатуру" forceReload={forceReload} />

            <div className="nav-dropdown">
              <button type="button" className="nav-pill dropdown-trigger">
                Накладные
              </button>
              <div className="nav-dropdown-menu">
                {INVOICE_LINKS.map((l) => (
                  <MenuLink key={l.to} to={l.to} label={l.label} className="nav-dropdown-item" forceReload={forceReload} />
                ))}
              </div>
            </div>

            <div className="nav-dropdown">
              <button type="button" className="nav-pill dropdown-trigger">
                Справочники
              </button>
              <div className="nav-dropdown-menu">
                {DIRECTORY_LINKS.map((l) => (
                  <MenuLink key={l.to} to={l.to} label={l.label} className="nav-dropdown-item" forceReload={forceReload} />
                ))}
              </div>
            </div>

            <MenuLink className="nav-pill" to="/calculator" label="Калькулятор" forceReload={false} />
          </div>
        </div>

        <div className="topbar-right">
          {isPublic ? (
            <a className="btn" href="/app">
              Войти
            </a>
          ) : (
            <div className="nav-dropdown">
              <button type="button" className="nav-pill dropdown-trigger user-menu-trigger">
                {userMenuLabel}
              </button>
              <div className="nav-dropdown-menu user-menu">
                <Link className="nav-dropdown-item" to={props.helpUrl ?? "/help/general"}>
                  Инструкция
                </Link>
                <Link className="nav-dropdown-item" to={props.canReadFeedback ? "/feedback/inbox" : "/feedback"}>
                  Обратная связь
                </Link>
                <button
                  className="nav-dropdown-item nav-dropdown-action"
                  type="button"
                  onClick={props.onToggleTheme}
                >
                  {props.theme === "dark" ? "Светлая тема" : "Темная тема"}
                </button>

                {props.isAdmin && (
                  <>
                    <button className="nav-dropdown-item nav-dropdown-action" type="button" onClick={props.onOpenAdminPanel}>
                      Админ панель
                    </button>
                    <a className="nav-dropdown-item" href={`${import.meta.env.VITE_DOCS_BASE_URL}/api/docs/`} target="_blank" rel="noreferrer">
                      Docs API
                    </a>
                    <a className="nav-dropdown-item" href={`${import.meta.env.VITE_NSI_BASE_URL}/api/docs/`} target="_blank" rel="noreferrer">
                      NSI API
                    </a>
                  </>
                )}

                <button className="nav-dropdown-item nav-dropdown-action danger-link" type="button" onClick={props.onLogout}>
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
