import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { gtinCheckDigit, isValidGtin, swissGtin } from "../lib/gtin.ts";
import { renderPackshot } from "../lib/packshot.ts";
import { DOSAGE_FORMS } from "../lib/reference-data.ts";
import { detectForm, readWorkbook, splitDesignation } from "../lib/swissmedic-import.ts";
import { normalize, slugify } from "../lib/text.ts";

test("GTIN: Prüfziffer und Schweizer Aufbau", () => {
  assert.equal(gtinCheckDigit("400638133393"), "1");
  assert.equal(isValidGtin("4006381333931"), true);
  assert.equal(isValidGtin("4006381333932"), false);
  assert.equal(swissGtin("99999", "1"), "7680999990013");
  assert.equal(isValidGtin(swissGtin("48913", "023")!), true);
  assert.equal(swissGtin("x", "1"), null);
});

test("Normalisierung wie in der Datenbank", () => {
  assert.equal(normalize("Lösung Äther Straße"), "losung ather strasse");
  assert.equal(slugify("Dafalgan 500 mg, Tabletten"), "dafalgan-500-mg-tabletten");
  assert.equal(slugify("???"), "arzneimittel");
});

test("Bezeichnung zerlegen", () => {
  assert.deepEqual(splitDesignation("Dafalgan 500 mg, Tabletten"), {
    name: "Dafalgan",
    line: "500 mg, Tabletten",
    formText: "Tabletten",
  });
  assert.deepEqual(splitDesignation("Bepanthen Plus, Creme"), {
    name: "Bepanthen Plus",
    line: "Creme",
    formText: "Creme",
  });
  assert.equal(splitDesignation("Vitamin D3 Streuli 4000 IE/ml, Tropfen").name, "Vitamin D3 Streuli");
});

test("Darreichungsform erkennen (spezifisch vor allgemein)", () => {
  const forms = DOSAGE_FORMS.map((form, index) => ({ id: index, name: form.name, keywords: form.keywords }));
  const name = (text: string) => forms[detectForm(forms, text, text)!].name;
  assert.equal(name("Augentropfen"), "Augentropfen");
  assert.equal(name("Tropfen zum Einnehmen"), "Tropfen");
  assert.equal(name("Filmtabletten"), "Filmtabletten");
  assert.equal(name("Pulver zur Herstellung einer Injektionslösung"), "Injektionslösung");
  assert.equal(name("Unbekannt"), "Andere Darreichungsform");
});

test("Symbolbild maskiert Text", () => {
  const svg = renderPackshot({ name: 'A<script>"&', line: "1 mg", illustration: "dropper", atcCode: "N02" });
  assert.ok(svg.startsWith("<svg"));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("A&lt;script&gt;&quot;&amp;"));
});

test("Swissmedic-Datei lesen", async () => {
  const { records, skipped } = await readWorkbook(
    await readFile(new URL("./fixtures/swissmedic-sample.xlsx", import.meta.url)),
  );
  assert.equal(skipped, 0);
  assert.equal(records.length, 5);
  const morphine = records.find((record) => record.authorization === "20002")!;
  assert.equal(morphine.narcotic, "a");
  assert.equal(morphine.category, "A");
  assert.equal(morphine.validUntil, "2030-12-31");
  assert.deepEqual(records.find((record) => record.authorization === "30003")!.substances, [
    "menthae piperitae aetheroleum",
    "carvi aetheroleum",
  ]);
});
