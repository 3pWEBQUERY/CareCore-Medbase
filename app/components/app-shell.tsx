"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretDown,
  Key,
  MagnifyingGlass,
  Pill,
  SignIn,
  SignOut,
  SquaresFour,
  UserCircle,
} from "@phosphor-icons/react/ssr";
import { logout } from "@/app/actions/auth";
import { ModuleIcon } from "./icons";
import { activeModule, activeTab, catalogModules, visibleAdminModules, type NavModule } from "./navigation";
import { SearchDialog } from "./search-dialog";
import { ToastProvider } from "./toast";

export type ShellUser = { displayName: string; username: string; role: "admin" | "editor" } | null;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

// Tooltip rechts neben einem Knopf der Leiste; per Portal, damit die scrollende Leiste ihn nicht abschneidet.
function RailTooltip({ label }: { label: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const trigger = anchor.current?.parentElement;
    if (!trigger) return;
    const show = () => {
      const rect = trigger.getBoundingClientRect();
      setPosition({ top: rect.top + rect.height / 2, left: rect.right + 12 });
    };
    const hide = () => setPosition(null);
    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", hide);
    trigger.addEventListener("focus", show);
    trigger.addEventListener("blur", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      trigger.removeEventListener("mouseenter", show);
      trigger.removeEventListener("mouseleave", hide);
      trigger.removeEventListener("focus", show);
      trigger.removeEventListener("blur", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);
  return (
    <>
      <span ref={anchor} hidden />
      {position &&
        createPortal(
          <span className="sidebar-tooltip" role="tooltip" style={position}>
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}

function RailLink({ module, active }: { module: NavModule; active: boolean }) {
  return (
    <Link
      href={module.href}
      className={`sidebar-button ${active ? "active" : ""}`}
      aria-label={module.label}
      aria-current={active ? "page" : undefined}
    >
      <ModuleIcon name={module.icon} />
      <RailTooltip label={module.label} />
    </Link>
  );
}

function UserMenu({ user }: { user: NonNullable<ShellUser> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="user-menu" ref={ref}>
      <button className="user-chip" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="avatar" aria-hidden="true">
          {initials(user.displayName)}
        </span>
        <span>
          <small>{user.role === "admin" ? "Administration" : "Redaktion"}</small>
          <strong>{user.displayName}</strong>
        </span>
        <CaretDown aria-hidden="true" />
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          <header>
            <strong>{user.displayName}</strong>
            <small>@{user.username}</small>
          </header>
          <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>
            <SquaresFour /> Verwaltung
          </Link>
          <Link href="/admin/konto" role="menuitem" onClick={() => setOpen(false)}>
            <Key /> Konto und Passwort
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" style={{ width: "100%" }}>
              <SignOut /> Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const current = activeModule(pathname);
  const tab = current ? activeTab(current, pathname) : undefined;
  const adminModules = visibleAdminModules(user?.role);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mobileItems: NavModule[] = user
    ? [catalogModules[0], adminModules[0], adminModules[1], adminModules[2]].filter(Boolean)
    : catalogModules;

  return (
    <ToastProvider>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Hauptnavigation">
          <div className="sidebar-head">
            <Link href="/" className="brand-mark" aria-label="CareCore Medbase, Startseite">
              <Pill weight="regular" />
            </Link>
          </div>
          <nav className="sidebar-scroll">
            {catalogModules.map((item) => (
              <RailLink key={item.id} module={item} active={current?.id === item.id} />
            ))}
            {adminModules.length > 0 && <span className="sidebar-group-label">Admin</span>}
            {adminModules.map((item) => (
              <RailLink key={item.id} module={item} active={current?.id === item.id} />
            ))}
          </nav>
          <div className="sidebar-footer">
            {user ? (
              <form action={logout}>
                <button className="sidebar-button" type="submit" aria-label="Abmelden">
                  <SignOut />
                  <RailTooltip label="Abmelden" />
                </button>
              </form>
            ) : (
              <Link className="sidebar-button" href="/anmelden" aria-label="Anmelden">
                <SignIn />
                <RailTooltip label="Anmelden zur Verwaltung" />
              </Link>
            )}
          </div>
        </aside>

        <div className="main-column">
          <header className="topbar">
            <div className="topbar-context">
              <span className="topbar-icon">{current ? <ModuleIcon name={current.icon} /> : <Pill />}</span>
              <span>
                <small>CareCore Medbase{current && current.id !== "catalog" ? " · Verwaltung" : ""}</small>
                <strong>{tab?.label ?? current?.label ?? "Arzneimittel der Schweiz"}</strong>
              </span>
            </div>
            <div className="top-actions">
              <button
                className="search-trigger"
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Arzneimittel suchen"
              >
                <MagnifyingGlass />
                <span>Arzneimittel suchen…</span>
                <kbd>⌘ K</kbd>
              </button>
              {user ? (
                <UserMenu user={user} />
              ) : (
                <Link className="secondary-button" href="/anmelden">
                  <SignIn /> Anmelden
                </Link>
              )}
            </div>
          </header>
          <header className="mobile-top">
            <Link href="/" className="mobile-brand">
              <span className="brand-mark">
                <Pill />
              </span>
              <strong>Medbase</strong>
            </Link>
            <div className="top-actions">
              <button className="icon-button" type="button" aria-label="Suchen" onClick={() => setSearchOpen(true)}>
                <MagnifyingGlass />
              </button>
              {user ? (
                <Link className="icon-button" href="/admin/konto" aria-label="Konto">
                  <UserCircle />
                </Link>
              ) : (
                <Link className="icon-button" href="/anmelden" aria-label="Anmelden">
                  <SignIn />
                </Link>
              )}
            </div>
          </header>

          {current && current.tabs.length > 1 && (
            <nav className="page-tabs" aria-label={`${current.label}: Seiten`}>
              {current.tabs.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={item === tab ? "active" : ""}
                  aria-current={item === tab ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          {children}
          <footer className="site-footer">
            <span>CareCore Medbase · Arzneimittel der Schweiz</span>
            <span>
              Quelle der Zulassungsdaten: Swissmedic, Liste der zugelassenen Packungen. Keine Fachinformation –
              massgebend ist die von Swissmedic genehmigte Arzneimittelinformation.
            </span>
          </footer>
        </div>

        <nav className="mobile-nav" aria-label="Navigation">
          {mobileItems.map((item) => (
            <Link key={item.id} href={item.href} className={current?.id === item.id ? "active" : ""}>
              <ModuleIcon name={item.icon} />
              {item.id === "catalog" ? "Katalog" : item.id === "products" ? "Verwalten" : item.label}
            </Link>
          ))}
        </nav>
        {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      </div>
    </ToastProvider>
  );
}
