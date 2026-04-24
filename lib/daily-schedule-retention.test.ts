import assert from "node:assert/strict";
import test from "node:test";

import {
  retainLatestEHSnapshot,
  retainLatestPPTimetable,
} from "./daily-schedule-retention.ts";

test("retainLatestPPTimetable keeps the newest batch and deletes older batches", () => {
  const result = retainLatestPPTimetable([
    "PPTimetable/20260423020459_ref_v1.xml.gz",
    "PPTimetable/20260423020459_ref_v2.xml.gz",
    "PPTimetable/20260423020459_v4.xml.gz",
    "PPTimetable/20260424020459_ref_v1.xml.gz",
    "PPTimetable/20260424020459_ref_v2.xml.gz",
    "PPTimetable/20260424020459_v4.xml.gz",
    "PPTimetable/20260424020459_v8.xml.gz",
  ]);

  assert.deepEqual(result, {
    prefix: "PPTimetable",
    latestRunKey: "20260424020459",
    keep: [
      "PPTimetable/20260424020459_ref_v1.xml.gz",
      "PPTimetable/20260424020459_ref_v2.xml.gz",
      "PPTimetable/20260424020459_v4.xml.gz",
      "PPTimetable/20260424020459_v8.xml.gz",
    ],
    remove: [
      "PPTimetable/20260423020459_ref_v1.xml.gz",
      "PPTimetable/20260423020459_ref_v2.xml.gz",
      "PPTimetable/20260423020459_v4.xml.gz",
    ],
    ignored: [],
  });
});

test("retainLatestPPTimetable ignores malformed names", () => {
  const result = retainLatestPPTimetable([
    "PPTimetable/20260424020459_ref_v1.xml.gz",
    "PPTimetable/not-a-batch.xml.gz",
    "PPTimetable/20260424020459",
    "PPTimetable/20260424020459_v4.txt",
  ]);

  assert.deepEqual(result, {
    prefix: "PPTimetable",
    latestRunKey: "20260424020459",
    keep: ["PPTimetable/20260424020459_ref_v1.xml.gz"],
    remove: [],
    ignored: [
      "PPTimetable/20260424020459",
      "PPTimetable/20260424020459_v4.txt",
      "PPTimetable/not-a-batch.xml.gz",
    ],
  });
});

test("retainLatestEHSnapshot keeps the newest snapshot", () => {
  const result = retainLatestEHSnapshot([
    "EHSnapshot/EHSnapshot_260408_1530.txt",
    "EHSnapshot/EHSnapshot_260416_1130.txt",
    "EHSnapshot/EHSnapshot_260331_1930.txt",
  ]);

  assert.deepEqual(result, {
    prefix: "EHSnapshot",
    latestRunKey: "202604161130",
    keep: ["EHSnapshot/EHSnapshot_260416_1130.txt"],
    remove: [
      "EHSnapshot/EHSnapshot_260331_1930.txt",
      "EHSnapshot/EHSnapshot_260408_1530.txt",
    ],
    ignored: [],
  });
});

test("retention returns an empty result when a prefix has no matching schedules", () => {
  const result = retainLatestEHSnapshot([
    "EHSnapshot/readme.txt",
    "EHSnapshot/EHSnapshot_latest.txt",
  ]);

  assert.deepEqual(result, {
    prefix: "EHSnapshot",
    latestRunKey: null,
    keep: [],
    remove: [],
    ignored: [
      "EHSnapshot/EHSnapshot_latest.txt",
      "EHSnapshot/readme.txt",
    ],
  });
});
