import React, { useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "../api/request";

type ItemLookupOption = {
  id: number;
  sku?: string | null;
  name: string;
  category?: number | null;
  is_active?: boolean;
  policy?: {
    storage_uom?: number | null;
    posting_uom?: number | null;
  };
};

type LookupResponse = {
  results?: ItemLookupOption[];
  total?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

export default function ItemLookup(props: {
  token?: string;
  value: number | null;
  onChange: (item: ItemLookupOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const token = props.token;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ItemLookupOption | null>(null);
  const [options, setOptions] = useState<ItemLookupOption[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const limit = 20;

  const searchDebounced = useMemo(() => search.trim(), [search]);

  function labelFor(item: ItemLookupOption | null): string {
    if (!item) return "";
    const sku = String(item.sku ?? "").trim();
    return sku ? `${item.name} (${sku})` : item.name;
  }

  function normalizeIncoming(item: any): ItemLookupOption | null {
    if (!item || typeof item.id !== "number") return null;
    return {
      id: item.id,
      sku: item.sku ?? null,
      name: String(item.name ?? `#${item.id}`),
      category: item.category ?? null,
      is_active: item.is_active,
      policy: item.policy ?? {},
    };
  }

  async function fetchById(itemId: number) {
    const row = await requestJson<any>({
      method: "GET",
      url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/${itemId}/`,
      token,
    });
    const normalized = normalizeIncoming(row);
    if (!normalized) return;
    setSelected(normalized);
    if (!open) setSearch(labelFor(normalized));
  }

  async function runLookup(nextOffset: number, append: boolean) {
    const qs = new URLSearchParams();
    qs.set("q", searchDebounced);
    qs.set("limit", String(limit));
    qs.set("offset", String(nextOffset));

    const result = await requestJson<LookupResponse>({
      method: "GET",
      url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/items/lookup/?${qs.toString()}`,
      token,
    });

    const rows = Array.isArray(result?.results) ? result.results : [];
    setOptions((prev) => (append ? [...prev, ...rows] : rows));
    setOffset(nextOffset);
    setHasMore(Boolean(result?.has_more));
    setActiveIndex(rows.length > 0 ? 0 : -1);
  }

  async function reloadLookup() {
    setLoading(true);
    try {
      await runLookup(0, false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await runLookup(offset + limit, true);
    } finally {
      setLoadingMore(false);
    }
  }

  function choose(item: ItemLookupOption | null) {
    setSelected(item);
    setSearch(labelFor(item));
    setOpen(false);
    setOptions([]);
    setHasMore(false);
    setOffset(0);
    setActiveIndex(-1);
    props.onChange(item);
  }

  useEffect(() => {
    if (props.value === null) {
      setSelected(null);
      if (!open) setSearch("");
      return;
    }
    if (selected?.id === props.value) return;
    fetchById(props.value).catch(() => {
      setSelected(null);
      if (!open) setSearch("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, token]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      reloadLookup().catch(() => {
        setOptions([]);
        setHasMore(false);
        setActiveIndex(-1);
      });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchDebounced, token]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
      setSearch(labelFor(selected));
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selected]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(options.length - 1, idx + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(0, idx - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = options[activeIndex];
      if (row) choose(row);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch(labelFor(selected));
    }
  }

  return (
    <div className="item-lookup" ref={rootRef}>
      <div className="item-lookup-input-wrap">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (!search.trim()) setSearch("");
          }}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder ?? "Начните вводить название или SKU"}
          disabled={props.disabled}
        />
        {props.value !== null && !props.disabled && (
          <button
            type="button"
            className="btn btn-tight item-lookup-clear"
            onClick={() => {
              choose(null);
              inputRef.current?.focus();
            }}
            title="Очистить выбор"
            aria-label="Очистить выбор"
          >
            ×
          </button>
        )}
      </div>

      {open && !props.disabled && (
        <div className="item-lookup-menu">
          {loading ? (
            <div className="item-lookup-empty"><small>Поиск...</small></div>
          ) : options.length === 0 ? (
            <div className="item-lookup-empty"><small>Ничего не найдено</small></div>
          ) : (
            <>
              <div className="item-lookup-list">
                {options.map((row, idx) => (
                  <button
                    key={`${row.id}-${idx}`}
                    type="button"
                    className={`item-lookup-option ${idx === activeIndex ? "active" : ""}`}
                    onClick={() => choose(row)}
                  >
                    <span>{row.name}</span>
                    <small>
                      #{row.id}
                      {row.sku ? ` • ${row.sku}` : ""}
                      {row.is_active === false ? " • archived" : ""}
                    </small>
                  </button>
                ))}
              </div>
              {hasMore && (
                <div className="item-lookup-footer">
                  <button type="button" className="btn btn-tight" onClick={() => void loadMore()} disabled={loadingMore}>
                    {loadingMore ? "Загрузка..." : "Показать еще"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

