// Navigation wie in CareCore: Module in der schmalen Leiste, die Seiten eines Moduls als Reiter oben auf der Seite.

export type IconName = "catalog" | "dashboard" | "products" | "media" | "masterData" | "import" | "users" | "log";

export type NavModule = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  // Seiten des Moduls (Reiter); die erste ist die Startseite des Moduls.
  tabs: { label: string; href: string }[];
  // Weitere Adressen, die zum Modul gehören (Unterseiten ohne eigenen Reiter).
  prefixes?: string[];
  role?: "admin" | "editor";
};

export const catalogModules: NavModule[] = [
  {
    id: "catalog",
    label: "Arzneimittel",
    icon: "catalog",
    href: "/",
    tabs: [
      { label: "Arzneimittel", href: "/" },
      { label: "Wirkstoffe", href: "/wirkstoffe" },
      { label: "Zulassungsinhaberinnen", href: "/firmen" },
      { label: "ATC-Klassifikation", href: "/atc" },
    ],
    prefixes: ["/arzneimittel"],
  },
];

export const adminModules: NavModule[] = [
  { id: "dashboard", label: "Übersicht", icon: "dashboard", href: "/admin", tabs: [], role: "editor" },
  {
    id: "products",
    label: "Arzneimittel verwalten",
    icon: "products",
    href: "/admin/arzneimittel",
    tabs: [],
    role: "editor",
  },
  { id: "media", label: "Bilder", icon: "media", href: "/admin/bilder", tabs: [], role: "editor" },
  {
    id: "master",
    label: "Stammdaten",
    icon: "masterData",
    href: "/admin/stammdaten",
    tabs: [
      { label: "Darreichungsformen", href: "/admin/stammdaten" },
      { label: "Wirkstoffe", href: "/admin/stammdaten/wirkstoffe" },
      { label: "Zulassungsinhaberinnen", href: "/admin/stammdaten/firmen" },
      { label: "ATC-Codes", href: "/admin/stammdaten/atc" },
    ],
    role: "editor",
  },
  { id: "import", label: "Swissmedic-Import", icon: "import", href: "/admin/import", tabs: [], role: "admin" },
  { id: "users", label: "Benutzer", icon: "users", href: "/admin/benutzer", tabs: [], role: "admin" },
  { id: "log", label: "Protokoll", icon: "log", href: "/admin/protokoll", tabs: [], role: "editor" },
];

const owns = (module: NavModule, pathname: string) => {
  if (module.href === "/")
    return (
      pathname === "/" ||
      module.tabs.some((tab) => tab.href !== "/" && pathname.startsWith(tab.href)) ||
      (module.prefixes ?? []).some((prefix) => pathname.startsWith(prefix))
    );
  if (module.href === "/admin") return pathname === "/admin";
  return pathname === module.href || pathname.startsWith(`${module.href}/`);
};

export function activeModule(pathname: string) {
  return [...catalogModules, ...adminModules].find((module) => owns(module, pathname)) ?? null;
}

export function activeTab(module: NavModule, pathname: string) {
  // Längster passender Reiter gewinnt („/admin/stammdaten/atc“ vor „/admin/stammdaten“).
  return [...module.tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) =>
      tab.href === "/"
        ? pathname === "/" || pathname.startsWith("/arzneimittel")
        : pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    );
}

export const visibleAdminModules = (role: string | null | undefined) =>
  role ? adminModules.filter((module) => module.role !== "admin" || role === "admin") : [];
