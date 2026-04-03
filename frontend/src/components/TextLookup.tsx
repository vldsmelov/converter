import React, { useEffect, useMemo, useRef, useState } from "react";

type TextLookupProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
};

export default function TextLookup(props: TextLookupProps) {
  const { value, onChange, options, placeholder, disabled, emptyText } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizedOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (options ?? [])
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "ru")),
    [options]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedOptions.slice(0, 100);
    return normalizedOptions
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 100);
  }, [normalizedOptions, search]);

  useEffect(() => {
    setSearch(value ?? "");
  }, [value]);

  useEffect(() => {
    setActiveIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered.length, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(nextValue: string) {
    const v = String(nextValue ?? "").trim();
    onChange(v);
    setSearch(v);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(filtered.length - 1, idx + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(0, idx - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[activeIndex];
      if (row) {
        choose(row);
      } else {
        onChange(search.trim());
        setOpen(false);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch(value ?? "");
    }
  }

  return (
    <div className="item-lookup" ref={rootRef}>
      <div className="item-lookup-input-wrap">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            onChange(next);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Начните вводить"}
          disabled={disabled}
        />
        {!!value && !disabled && (
          <button
            type="button"
            className="btn btn-tight item-lookup-clear"
            onClick={() => {
              onChange("");
              setSearch("");
              inputRef.current?.focus();
            }}
            title="Очистить выбор"
            aria-label="Очистить выбор"
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="item-lookup-menu">
          {filtered.length === 0 ? (
            <div className="item-lookup-empty">
              <small>{emptyText ?? "Ничего не найдено"}</small>
            </div>
          ) : (
            <div className="item-lookup-list">
              {filtered.map((row, idx) => (
                <button
                  key={`${row}-${idx}`}
                  type="button"
                  className={`item-lookup-option ${idx === activeIndex ? "active" : ""}`}
                  onClick={() => choose(row)}
                >
                  <span>{row}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
