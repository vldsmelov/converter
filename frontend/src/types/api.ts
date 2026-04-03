export type Id = number;

export type ApiListEnvelope<T> = {
  results?: T[];
  next?: string | null;
  previous?: string | null;
  count?: number;
} | T[];

export type UomCategoryCode = "MASS" | "VOLUME" | "LENGTH" | "COUNT" | string;

export type NsiUomCategoryDto = {
  id: Id;
  code: UomCategoryCode;
  name: string;
};

export type NsiUomDto = {
  id: Id;
  code: string;
  name: string;
  category: Id;
  factor_to_base?: string;
  precision?: number;
};

export type NsiItemCategoryDto = {
  id: Id;
  name: string;
  default_uom?: Id | null;
  is_active?: boolean;
};

export type NsiItemPolicyDto = {
  storage_uom?: Id | null;
  posting_uom?: Id | null;
  allow_fractional?: boolean;
  rounding_precision?: number | null;
};

export type NsiPackageSpecDto = {
  id: Id;
  status?: "active" | "archived" | string;
  package_uom: Id;
  content_qty: string;
  content_uom: Id;
  supplier_code?: string;
  barcode?: string;
  effective_from?: string | null;
  effective_to?: string | null;
};

export type NsiItemDto = {
  id: Id;
  sku?: string | null;
  name: string;
  category?: Id | null;
  density_kg_per_l?: string | number | null;
  is_active?: boolean;
  policy?: NsiItemPolicyDto;
  packages?: NsiPackageSpecDto[];
};

export type NsiCounterpartyDto = {
  id: Id;
  name: string;
  active?: boolean;
};

export type NsiRuleDto = {
  id: Id;
  item?: Id | null;
  from_category?: Id | null;
  to_category?: Id | null;
  rule_type: string;
  conditions?: Record<string, unknown>;
  params?: Record<string, unknown>;
  status?: "active" | "archived" | string;
  version?: number;
};

export type ConvertStepDto = {
  kind?: string;
  description?: string;
  from_qty?: string;
  from_uom?: string;
  to_qty?: string;
  to_uom?: string;
  meta?: Record<string, unknown>;
};

export type ConvertResponseDto = {
  item_id: Id;
  from?: { qty?: string; uom?: string };
  to?: { qty?: string; uom?: string };
  posting_qty?: string;
  posting_uom_code?: string;
  steps?: ConvertStepDto[];
  warnings?: string[];
};

export type DocsConvertedLineDto = {
  posting_qty: string;
  posting_uom_code: string;
  steps?: ConvertStepDto[];
  warnings?: string[];
  calculated_at?: string;
};

export type DocsInvoiceLineDto = {
  line_no: number;
  item_id: Id;
  qty: string;
  uom_code: string;
  to_uom_code?: string;
  context?: Record<string, unknown>;
  barcode?: string;
  supplier_code?: string;
  converted?: DocsConvertedLineDto;
};

export type DocsInvoiceFileDto = {
  id: Id;
  file_type: "xlsx" | "pdf" | string;
  file_name?: string;
  content_type?: string;
  size?: number;
  created_at?: string;
  download_url?: string;
  presigned_url?: string | null;
};

export type DocsInvoiceDto = {
  id: Id;
  number: string;
  supplier?: string;
  doc_date?: string | null;
  status: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
  lines: DocsInvoiceLineDto[];
  files: DocsInvoiceFileDto[];
};

