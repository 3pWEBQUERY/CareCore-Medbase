import Link from "next/link";
import { X } from "@phosphor-icons/react/ssr";
import { withParams } from "./pagination";

// Gesetzte Filter als Chips; ein Klick entfernt den Filter.
export function ActiveFilters({
  base,
  params,
  labels,
}: {
  base: string;
  params: Record<string, string | undefined>;
  labels: { key: string; label: string }[];
}) {
  if (!labels.length) return null;
  return (
    <div className="active-filters">
      {labels.map(({ key, label }) => (
        <Link
          key={key}
          className="filter-chip"
          href={withParams(
            base,
            params,
            key === "form"
              ? { form: undefined, gruppe: undefined, seite: undefined }
              : { [key]: undefined, seite: undefined },
          )}
          aria-label={`Filter entfernen: ${label}`}
        >
          {label} <X />
        </Link>
      ))}
    </div>
  );
}
