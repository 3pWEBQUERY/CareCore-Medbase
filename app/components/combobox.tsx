"use client";

import { useEffect, useId, useRef, useState } from "react";

type Item = { value: string; label: string; hint?: string | null };

// Eingabefeld mit Vorschlägen aus /api/admin/vorschlaege. Freie Eingabe bleibt möglich (z. B. neue Firma).
export function Combobox({
  id,
  kind,
  value,
  onChange,
  onSelect,
  placeholder,
  invalid,
  className = "input",
  ariaLabel,
}: {
  id?: string;
  kind: "firma" | "wirkstoff" | "atc" | "arzneimittel";
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: Item) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.trim().length < 1) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/vorschlaege?typ=${kind}&q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { items: Item[] };
          setItems(data.items);
          setActive(0);
          setOpen(data.items.length > 0);
        }
      } catch {
        // abgebrochen
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, kind]);

  const choose = (item: Item) => {
    typed.current = false;
    setOpen(false);
    if (onSelect) onSelect(item);
    else onChange(item.value);
  };

  return (
    <div className="combobox">
      <input
        id={id}
        className={className}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onChange={(event) => {
          typed.current = true;
          onChange(event.target.value);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, items.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && items[active]) {
            event.preventDefault();
            choose(items[active]);
          } else if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul className="combobox-list" id={listId} role="listbox">
          {items.map((item, index) => (
            <li
              key={`${item.value}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
            >
              {item.label}
              {item.hint && <small>{item.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
