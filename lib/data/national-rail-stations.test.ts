import assert from "node:assert/strict";
import test from "node:test";

import { searchNationalRailStations } from "./national-rail-stations";

test("returns exact CRS matches first", () => {
  const [result] = searchNationalRailStations("STP");

  assert.equal(result?.id, "STP");
  assert.equal(result?.label, "London St Pancras International");
});

test("finds stations outside the old seeded list", () => {
  const [result] = searchNationalRailStations("York");

  assert.equal(result?.id, "YRK");
  assert.equal(result?.label, "York");
});

test("prefers leading station-name matches over incidental substrings", () => {
  const [result] = searchNationalRailStations("der");

  assert.equal(result?.id, "DBY");
  assert.equal(result?.label, "Derby");
});
