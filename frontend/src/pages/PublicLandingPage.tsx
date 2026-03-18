import React from "react";
import { Link } from "react-router-dom";

export default function PublicLandingPage() {
  return (
    <div className="container app-shell" style={{ paddingTop: 28 }}>
      <div className="card" style={{ maxWidth: 820, margin: "0 auto" }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Конвертер</h2>
        <p style={{ marginTop: 0 }}>
          Публичный доступ: быстрый расчёт перевода ЕИ по уже настроенным данным системы.
        </p>

        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn primary" to="/calculator">
            Открыть калькулятор
          </Link>
          <a className="btn" href="/">
            Войти в систему
          </a>
        </div>

        <div style={{ marginTop: 12 }}>
          <small>
            Без авторизации доступен только расчёт. Создание/изменение справочников и правил требует входа.
          </small>
        </div>
      </div>
    </div>
  );
}

