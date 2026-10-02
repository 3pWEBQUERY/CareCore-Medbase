import Link from "next/link";
import type { ReactNode } from "react";

export function StatusPage({
  code,
  title,
  text,
  children,
}: {
  code: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <main className="status-page">
      <section className="status-page-card" role="alert">
        <span className="status-page-code">{code}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className="status-page-actions">
          {children}
          <Link className="secondary-button" href="/">
            Zum Katalog
          </Link>
        </div>
      </section>
    </main>
  );
}
