import Link from "next/link";
import { CaretRight, TreeStructure } from "@phosphor-icons/react/ssr";
import { atcTree } from "@/lib/catalog";
import { groupColor } from "@/lib/packshot";
import { formatCount } from "@/lib/text";

export const metadata = { title: "ATC-Klassifikation" };

// ATC-Baum: Hauptgruppen → therapeutische Untergruppen → … → Wirkstoff (Stufe 5 führt in den Katalog).
export default async function AtcPage({ searchParams }: PageProps<"/atc">) {
  const { code: raw } = await searchParams;
  const tree = await atcTree(typeof raw === "string" ? raw.toUpperCase() : "");
  const color = groupColor(tree.code || "X");
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Anatomisch-therapeutisch-chemische Klassifikation</p>
          <h1>{tree.current ? `${tree.code} – ${tree.current.name}` : tree.code ? tree.code : "ATC-Klassifikation"}</h1>
          <p>
            {tree.code
              ? "Untergruppen mit der Zahl der Arzneimittel im Handel."
              : "Die 14 Hauptgruppen der WHO-Klassifikation mit der Zahl der Arzneimittel im Handel."}
          </p>
        </div>
        {tree.code && (
          <div className="page-heading-actions">
            <Link className="primary-button" href={`/?atc=${tree.code}`}>
              Arzneimittel anzeigen
            </Link>
          </div>
        )}
      </div>
      {tree.code && (
        <nav className="atc-path" aria-label="ATC-Pfad">
          <Link href="/atc">Alle Gruppen</Link>
          {tree.path.map((step) => (
            <span key={step.code} style={{ display: "contents" }}>
              <CaretRight />
              <Link href={`/atc?code=${step.code}`}>
                <span className="mono">{step.code}</span> {step.name}
              </Link>
            </span>
          ))}
          <CaretRight />
          <strong className="mono">{tree.code}</strong>
        </nav>
      )}
      <section className="card">
        {tree.children.length ? (
          <ul className="atc-list">
            {tree.children.map((child) => (
              <li key={child.code}>
                <Link href={child.code.length >= 7 ? `/?atc=${child.code}` : `/atc?code=${child.code}`}>
                  <span className="atc-code" style={{ background: tree.code ? color : groupColor(child.code) }}>
                    {child.code}
                  </span>
                  <span>{child.name ?? <span className="muted">Ohne Bezeichnung</span>}</span>
                  <span className="count-pill">{formatCount(child.count)}</span>
                  <CaretRight />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <TreeStructure />
            <strong>Keine Untergruppen</strong>
            <p>In dieser Gruppe sind keine Arzneimittel im Handel erfasst.</p>
          </div>
        )}
      </section>
    </main>
  );
}
