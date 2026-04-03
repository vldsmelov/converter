import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";

export default function PublicLandingPage() {
  return (
    <div className="container app-shell" style={{ paddingTop: 28 }}>
      <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <BrandLogo />
        </div>
        <p style={{ marginTop: 0 }}>
          Публичный доступ: быстрый расчет перевода ЕИ по уже настроенным данным системы.
        </p>

        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn primary" to="/calculator">
            Открыть калькулятор
          </Link>
          <Link className="btn" to="/help/general?from=/landing">
            Инструкция
          </Link>
          <Link className="btn" to="/feedback">
            Обратная связь
          </Link>
          <a className="btn" href="/app">
            Войти в систему
          </a>
        </div>

        <div style={{ marginTop: 12 }}>
          <small>
            Без авторизации доступен только расчет. Создание и изменение справочников и правил требует входа.
          </small>
        </div>
      </div>
    </div>
  );
}
