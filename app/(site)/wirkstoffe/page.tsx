import { DirectoryPage } from "@/app/components/directory-page";

export const metadata = { title: "Wirkstoffe" };

export default async function SubstancesPage({ searchParams }: PageProps<"/wirkstoffe">) {
  return (
    <DirectoryPage
      kind="substances"
      base="/wirkstoffe"
      params={await searchParams}
      eyebrow="Verzeichnis"
      title="Wirkstoffe"
      text="Alle Wirkstoffe der Arzneimittel im Handel, mit lateinischer Bezeichnung nach Swissmedic."
      filterKey="wirkstoff"
    />
  );
}
