import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "./retain-latest-schedules";

test("parseArgs ignores blank arguments", () => {
  assert.deepEqual(parseArgs(["", "--bucket", "example-bucket"]), {
    apply: false,
    bucketName: "example-bucket",
    prefixes: ["PPTimetable", "EHSnapshot"],
  });
});
