import { Prohibit, ShieldCheck, Warning } from "@phosphor-icons/react/ssr";

const CATEGORY_TITLES: Record<string, string> = {
  A: "Abgabekategorie A: einmalige Abgabe auf Verschreibung",
  B: "Abgabekategorie B: Abgabe auf Verschreibung",
  C: "Abgabekategorie C: Abgabe nach Fachberatung durch Medizinalpersonen (bis 2018)",
  D: "Abgabekategorie D: Abgabe nach Fachberatung",
  E: "Abgabekategorie E: Abgabe ohne Fachberatung",
};

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className={`badge badge-cat badge-cat-${category}`} title={CATEGORY_TITLES[category]}>
      {category}
    </span>
  );
}

export function ProductBadges({
  category,
  slListed,
  narcoticList,
  status,
  source,
  showSource = false,
}: {
  category: string | null;
  slListed: boolean;
  narcoticList: string | null;
  status: string;
  source?: string;
  showSource?: boolean;
}) {
  return (
    <>
      <CategoryBadge category={category} />
      {slListed && (
        <span
          className="badge badge-sl"
          title="In der Spezialitätenliste (SL) des BAG, von der Grundversicherung vergütet"
        >
          <ShieldCheck /> SL
        </span>
      )}
      {narcoticList && (
        <span className="badge badge-btm" title={`Betäubungsmittel, Verzeichnis ${narcoticList}`}>
          BetmG {narcoticList}
        </span>
      )}
      {status === "ausser_handel" && (
        <span className="badge badge-muted">
          <Prohibit /> Ausser Handel
        </span>
      )}
      {status === "entwurf" && <span className="badge badge-warn">Entwurf</span>}
      {showSource && source === "beispiel" && (
        <span className="badge badge-warn" title="Von Hand erfasster Beispieldatensatz, nicht amtlich geprüft">
          <Warning /> Beispiel
        </span>
      )}
    </>
  );
}
