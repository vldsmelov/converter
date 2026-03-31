function up(v: unknown): string {
  return String(v ?? "").toUpperCase();
}

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function uomCategoryLabel(code: unknown, withCode = false): string {
  const c = up(code);
  const map: Record<string, string> = {
    COUNT: "Количество",
    MASS: "Масса",
    LENGTH: "Длина",
    VOLUME: "Объем",
  };
  const label = map[c] ?? (c || "-");
  if (!withCode || !c || label === c) return label;
  return `${label} (${c})`;
}

export function uomLabel(code: unknown, withCode = false): string {
  const c = up(code);
  const map: Record<string, string> = {
    PCS: "Штука",
    BAG: "Мешок",
    KG: "Килограмм",
    G: "Грамм",
    TON: "Тонна",
    L: "Литр",
    ML: "Миллилитр",
    M: "Метр",
    CM: "Сантиметр",
    MM: "Миллиметр",
    M2: "Квадратный метр",
    M3: "Кубический метр",
  };
  const label = map[c] ?? (c || "-");
  if (!withCode || !c || label === c) return label;
  return `${label} (${c})`;
}

export function ruleTypeLabel(ruleType: unknown, withCode = false): string {
  const t = norm(ruleType);
  const map: Record<string, string> = {
    pcs_weight: "По весу штуки",
    kg_per_m: "По линейной массе",
    density: "По плотности",
  };
  const label = map[t] ?? (String(ruleType ?? "").trim() || "-");
  if (!withCode || !t || label === t) return label;
  return `${label} (${t})`;
}

export function ruleParamLabel(paramKey: unknown, withCode = false): string {
  const p = norm(paramKey);
  const map: Record<string, string> = {
    kg_per_pc: "Вес 1 штуки (кг)",
    kg_per_m: "Линейная масса (кг/м)",
    density_kg_per_l: "Плотность (кг/л)",
    multiplier: "Коэффициент пересчета",
  };
  const label = map[p] ?? (String(paramKey ?? "").trim() || "-");
  if (!withCode || !p || label === p) return label;
  return `${label} (${p})`;
}

export function conditionLabel(key: unknown): string {
  const k = norm(key);
  const map: Record<string, string> = {
    supplier_code: "Поставщик",
    barcode: "Штрихкод",
    effective_from: "Действует с",
    effective_to: "Действует по",
  };
  return map[k] ?? String(key ?? "");
}
