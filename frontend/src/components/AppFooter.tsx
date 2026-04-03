import BrandLogo from "./BrandLogo";

const BITRIX_LINK =
  "https://team.alabuga.ru/company/structure.php?set_filter_structure=Y&structure_UF_DEPARTMENT=8304&filter=Y&set_filter=Y";
const MAX_CONTACT_LINK =
  "https://max.ru/u/f9LHodD0cOIizG7PTlm17qfwGncgtuvYXFUPqRTINgmzO7zIPoh0XBtE7VY";
const STROY_LINK = "https://career.alabuga.ru/stroy";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-surface">
        <div className="app-footer-col app-footer-col-left">
          <span className="app-footer-text">Created by «Цифровизация проектных задач»</span>
          <a
            className="app-footer-icon-link"
            href={BITRIX_LINK}
            target="_blank"
            rel="noreferrer"
            aria-label="Перейти в Битрикс"
            title="Перейти в Битрикс"
          >
            <span className="app-footer-icon">B24</span>
          </a>
        </div>

        <a
          className="app-footer-center-link"
          href={STROY_LINK}
          target="_blank"
          rel="noreferrer"
          aria-label="Перейти на сайт Стройтрест Алабуга"
          title="Перейти на сайт Стройтрест Алабуга"
        >
          <BrandLogo compact />
        </a>

        <div className="app-footer-col app-footer-col-right">
          <span className="app-footer-text">По вопросам системы писать сюда</span>
          <a
            className="app-footer-icon-link"
            href={MAX_CONTACT_LINK}
            target="_blank"
            rel="noreferrer"
            aria-label="Открыть MAX"
            title="Открыть MAX"
          >
            <span className="app-footer-icon">MAX</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
