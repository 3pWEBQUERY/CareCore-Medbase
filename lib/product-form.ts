// Leere Werte des Bearbeitungsformulars; auf Server und Client nutzbar.
import type { PackageInput, ProductInput } from "./admin-products.ts";

export const emptyPackage = (): PackageInput => ({
  packageCode: "",
  gtin: "",
  pharmacode: "",
  quantity: "",
  unit: "",
  dispensingCategory: "",
  exFactoryPrice: "",
  publicPrice: "",
  slListed: false,
  status: "aktiv",
});

export function emptyProduct(): ProductInput {
  return {
    name: "",
    descriptionLine: "",
    authorizationNumber: "",
    dosageNumber: "",
    company: "",
    dosageFormId: "",
    atcCode: "",
    atcName: "",
    dispensingCategory: "",
    narcoticList: "",
    slListed: false,
    productType: "",
    remedyCode: "",
    composition: "",
    indication: "",
    notes: "",
    firstAuthorizedOn: "",
    authorizationValidUntil: "",
    status: "aktiv",
    substances: [{ name: "", amount: "", unit: "" }],
    packages: [emptyPackage()],
  };
}
