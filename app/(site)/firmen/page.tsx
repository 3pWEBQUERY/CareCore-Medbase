import { DirectoryPage } from "@/app/components/directory-page";

export const metadata = { title: "Zulassungsinhaberinnen" };

export default async function CompaniesPage({ searchParams }: PageProps<"/firmen">) {
  return (
    <DirectoryPage
      kind="companies"
      base="/firmen"
      params={await searchParams}
      eyebrow="Verzeichnis"
      title="Zulassungsinhaberinnen"
      text="Firmen, die in der Schweiz Arzneimittel zugelassen haben."
      filterKey="firma"
    />
  );
}
