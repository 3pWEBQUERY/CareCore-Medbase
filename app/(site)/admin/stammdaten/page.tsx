import { MasterPage } from "@/app/components/master-page";
import { MasterTable } from "@/app/components/master-table";
import { listForms } from "@/lib/admin-master";
import { ILLUSTRATIONS } from "@/lib/packshot";
import { FORM_GROUPS, formGroupLabel } from "@/lib/reference-data";

export const metadata = { title: "Darreichungsformen" };

export default async function FormsPage() {
  const forms = await listForms();
  return (
    <MasterPage
      title="Darreichungsformen"
      text="Gruppe und Abbildung bestimmen Filter und Symbolbild. Die Schlüsselwörter erkennt der Swissmedic-Import in der Bezeichnung (Reihenfolge = Priorität)."
      base="/admin/stammdaten"
      searchable={false}
    >
      <MasterTable
        kind="form"
        title="Darreichungsform"
        newLabel="Neue Darreichungsform"
        columns={["Reihenfolge", "Bezeichnung", "Gruppe", "Abbildung", "Schlüsselwörter"]}
        fields={[
          { name: "name", label: "Bezeichnung", required: true },
          { name: "group", label: "Gruppe", type: "select", options: FORM_GROUPS },
          { name: "illustration", label: "Abbildung (Symbolbild)", type: "select", options: ILLUSTRATIONS },
          { name: "keywords", label: "Schlüsselwörter", hint: "Kommagetrennt, z. B. «filmtablette, lactab»" },
          {
            name: "sortOrder",
            label: "Reihenfolge",
            type: "number",
            hint: "Kleinere Zahl = wird beim Import zuerst geprüft",
          },
        ]}
        rows={forms.map((form) => ({
          id: String(form.id),
          count: form.count,
          catalogHref: `/admin/arzneimittel?form=${form.id}&status=alle`,
          values: {
            name: form.name,
            group: form.group,
            illustration: form.illustration,
            keywords: form.keywords.join(", "),
            sortOrder: String(form.sortOrder),
          },
          cells: [
            <span key="s" className="mono muted">
              {form.sortOrder}
            </span>,
            <strong key="n">{form.name}</strong>,
            formGroupLabel(form.group),
            ILLUSTRATIONS.find((entry) => entry.value === form.illustration)?.label ?? form.illustration,
            <span key="k" className="muted" style={{ fontSize: 12 }}>
              {form.keywords.join(", ") || "–"}
            </span>,
          ],
        }))}
      />
    </MasterPage>
  );
}
