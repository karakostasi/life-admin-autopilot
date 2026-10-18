import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByPlate, plateKey, stripPlate } from "../src/lib/vehicles";

test("plateKey: ελληνικά/λατινικά, κενά, παύλες, τόνοι", () => {
  assert.equal(plateKey("ΙΝΖ-852"), plateKey("INZ 852"));
  assert.equal(plateKey("ινζ852"), plateKey("ΙΝΖ-852"));
  assert.equal(plateKey("ΙΝΖ 852"), plateKey("ΙΝΖ 0852"));
  assert.notEqual(plateKey("ΙΝΖ 852"), plateKey("ΙΝΖ 8520"));
  assert.equal(plateKey("  "), null);
  assert.equal(plateKey(null), null);
  assert.notEqual(plateKey("ΙΝΖ-852"), plateKey("ΙΝΖ-853"));
});

test("stripPlate: βγάζει την πινακίδα από τον τίτλο", () => {
  assert.equal(stripPlate("ΚΤΕΟ ΖΧΑ-1234", "ΖΧΑ-1234"), "ΚΤΕΟ");
  assert.equal(stripPlate("ΚΤΕΟ ΖΧΑ 1234", "ΖΧΑ-1234"), "ΚΤΕΟ");
  assert.equal(stripPlate("Ασφάλεια Μοτοσυκλέτας - Interamerican", "ΙΝΖ-852"), "Ασφάλεια Μοτοσυκλέτας - Interamerican");
  assert.equal(stripPlate("ΖΧΑ-1234", "ΖΧΑ-1234"), "ΖΧΑ-1234"); // δεν αφήνει κενό τίτλο
});

const d = (id: string, identifier: string | null) => ({ id, identifier });

test("groupByPlate: ομάδα μόνο με 2+ έγγραφα, κρατά τη σειρά", () => {
  const res = groupByPlate([d("1", "ΙΝΖ-852"), d("2", null), d("3", "ΖΧΑ-1234"), d("4", "INZ 852"), d("5", "ΙΝΖ852")]);
  assert.equal(res.length, 3);
  assert.deepEqual(res[0].items.map((i) => i.id), ["1", "4", "5"]);
  assert.equal(res[0].plate, "ΙΝΖ-852");
  assert.equal(res[1].plate, null); // χωρίς πινακίδα
  assert.equal(res[2].plate, null); // πινακίδα με ένα μόνο έγγραφο: δεν είναι ομάδα
});
