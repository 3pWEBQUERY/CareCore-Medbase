import { MasterPage, pageParams } from "@/app/components/master-page";
import { MasterTable } from "@/app/components/master-table";
import { listAtc } from "@/lib/admin-master";

export const metadata = { title: "ATC-Codes" };

export default async function AtcAdmin({ searchParams }: PageProps<"/admin/stammdaten/atc">) {
  const { q, page } = pageParams(await searchParams);
  const { rows, total, pageSize } = await listAtc(q, page);
  return (
    <MasterPage
      title="ATC-Codes"
      text="Bezeichnungen der ATC-Klassifikation. Codes ohne Eintrag erscheinen im Katalog ohne Namen."
      base="/admin/stammdaten/atc"
      q={q}
      page={page}
      total={total}
      pageSize={pageSize}
    >
      <MasterTable
        kind="atc"
        title="ATC-Code"
        newLabel="Neuer ATC-Code"
        columns={["Code", "Stufe", "Bezeichnung"]}
        fields={[
          {
            name: "code",
            label: "Code",
            required: true,
            createOnly: true,
            mono: true,
            hint: "z. B. N02BE01 – nach dem Anlegen nicht mehr änderbar",
          },
          { name: "name", label: "Bezeichnung", required: true },
        ]}
        rows={rows.map((row) => ({
          id: row.code,
          count: row.count,
          catalogHref: `/admin/arzneimittel?atc=${row.code}&status=alle`,
          values: { code: row.code, name: row.name },
          cells: [
            <strong key="c" className="mono">
              {row.code}
            </strong>,
            row.level,
            row.name,
          ],
        }))}
      />
    </MasterPage>
  );
}
