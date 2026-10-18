import assert from "node:assert/strict";
import { test } from "node:test";
import { findByPlate, groupByVehicle, plateKey, stripPlate, suggestSameVehicle, type Vehicle } from "../src/lib/vehicles";

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

const d = (id: string, vehicle_id: string | null) => ({ id, vehicle_id });

test("groupByVehicle: ομάδα μόνο με 2+ έγγραφα, κρατά τη σειρά", () => {
  const res = groupByVehicle([d("1", "v1"), d("2", null), d("3", "v2"), d("4", "v1"), d("5", "v1")]);
  assert.equal(res.length, 3);
  assert.deepEqual(res[0].items.map((i) => i.id), ["1", "4", "5"]);
  assert.equal(res[0].vehicleId, "v1");
  assert.equal(res[1].vehicleId, null); // χωρίς όχημα
  assert.equal(res[2].vehicleId, null); // όχημα με ένα μόνο έγγραφο: κανονική κάρτα
});

const v = (id: string, plate: string, model: string | null): Vehicle => ({ id, kind: "motorcycle", plate, model });

test("findByPlate: ίδια πινακίδα με διαφορετική γραφή", () => {
  const vehicles = [v("1", "ΙΝΖ-852", "Yamaha Tracer 700")];
  assert.equal(findByPlate(vehicles, "INZ 0852")?.id, "1");
  assert.equal(findByPlate(vehicles, "ΖΧΑ-1234"), undefined);
});

test("suggestSameVehicle: ίδιο μοντέλο, άλλη πινακίδα -> πρόταση, αμφίσημο -> τίποτα", () => {
  const one = [v("1", "ΙΝΖ-852", "Yamaha Tracer 700")];
  assert.equal(suggestSameVehicle(one, "ΙΝΖ-999", "yamaha tracer-700")?.id, "1");
  assert.equal(suggestSameVehicle(one, "ΙΝΖ-852", "Yamaha Tracer 700"), undefined); // ίδια πινακίδα: δεν χρειάζεται πρόταση
  assert.equal(suggestSameVehicle(one, "ΙΝΖ-999", null), undefined);
  assert.equal(suggestSameVehicle([...one, v("2", "ΡΡΡ-111", "Yamaha Tracer 700")], "ΙΝΖ-999", "Yamaha Tracer 700"), undefined);
});
