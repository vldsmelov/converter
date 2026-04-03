import logoSrc from "../assets/brand-logo.png";

export default function BrandLogo(props: { compact?: boolean }) {
  return (
    <div className={`brand-logo ${props.compact ? "compact" : ""}`} aria-label="Стройтрест Алабуга">
      <img src={logoSrc} alt="Стройтрест Алабуга" />
    </div>
  );
}
