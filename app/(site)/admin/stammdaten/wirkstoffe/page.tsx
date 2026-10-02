import { MasterPage, pageParams } from "@/app/components/master-page";
import { MasterTable } from "@/app/components/master-table";
import { listSubstances } from "@/lib/admin-master";

export const metadata = { title: "Wirkstoffe" };

export default async function SubstancesAdmin({ searchParams }: PageProps<"/admin/stammdaten/wirkstoffe">) {
  const { q, page } = pageParams(await searchParams);
  const { rows, total, pageSize } = await listSubstances(q, page);
  return (
    <MasterPage
      title="Wirkstoffe"
      text="Deutsche und lateinische Bezeichnung. Dubletten lassen sich zusammenführen."
      base="/admin/stammdaten/wirkstoffe"
      q={q}
      page={page}
      total={total}
      pageSize={pageSize}
    >
      <MasterTable
        kind="substance"
        title="Wirkstoff"
        newLabel="Neuer Wirkstoff"
        canMerge
        columns={["Bezeichnung", "Lateinisch (Swissmedic)"]}
        fields={[
          { name: "name", label: "Bezeichnung", required: true },
          {
            name: "latinName",
            label: "Lateinische Bezeichnung",
            hint: "Wie in der Swissmedic-Liste, z. B. «paracetamolum»",
          },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          count: row.count,
          catalogHref: `/admin/arzneimittel?wirkstoff=${row.id}&status=alle`,
          values: { name: row.name, latinName: row.latinName ?? "" },
          cells: [
            <strong key="n">{row.name}</strong>,
            <span key="l" className="muted" style={{ fontStyle: "italic" }}>
              {row.latinName ?? "–"}
            </span>,
          ],
        }))}
      />
    </MasterPage>
  );
}
