import assert from "node:assert/strict";
import test from "node:test";

import { getBoardOperatorLabel } from "./operator-display.ts";

test("prefers explicit operator codes", () => {
  assert.equal(
    getBoardOperatorLabel({
      operator: "Greater Anglia",
      operatorCode: "ga",
    }),
    "GA",
  );
});

test("uses known compact abbreviations for common operators", () => {
  assert.equal(getBoardOperatorLabel({ operator: "East Midlands Railway" }), "EMR");
  assert.equal(getBoardOperatorLabel({ operator: "Thameslink" }), "TL");
});

test("derives short labels when no known abbreviation exists", () => {
  assert.equal(getBoardOperatorLabel({ operator: "Great Western Railway" }), "GWR");
  assert.equal(getBoardOperatorLabel({ operator: "c2c" }), "C2C");
});
