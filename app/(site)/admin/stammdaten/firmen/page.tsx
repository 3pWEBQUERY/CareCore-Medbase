import { MasterPage, pageParams } from "@/app/components/master-page";
import { MasterTable } from "@/app/components/master-table";
import { listCompanies } from "@/lib/admin-master";

export const metadata = { title: "Zulassungsinhaberinnen" };

export default async function CompaniesAdmin({ searchParams }: PageProps<"/admin/stammdaten/firmen">) {
  const { q, page } = pageParams(await searchParams);
  const { rows, total, pageSize } = await listCompanies(q, page);
  return (
    <MasterPage
      title="Zulassungsinhaberinnen"
      text="Firmen mit Zulassungen in der Schweiz. Dubletten lassen sich zusammenführen."
      base="/admin/stammdaten/firmen"
      q={q}
      page={page}
      total={total}
      pageSize={pageSize}
    >
      <MasterTable
        kind="company"
        title="Firma"
        newLabel="Neue Firma"
        canMerge
        columns={["Name", "Website"]}
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "website", label: "Website", hint: "Optional, mit https://" },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          count: row.count,
          catalogHref: `/admin/arzneimittel?firma=${row.id}&status=alle`,
          values: { name: row.name, website: row.website ?? "" },
          cells: [
            <strong key="n">{row.name}</strong>,
            row.website ? (
              <a key="w" href={row.website} target="_blank" rel="noreferrer noopener">
                {row.website.replace(/^https:\/\//, "")}
              </a>
            ) : (
              <span key="w" className="muted">
                –
              </span>
            ),
          ],
        }))}
      />
    </MasterPage>
  );
}
