import assert from "node:assert/strict";
import test from "node:test";

import { __testing } from "./national-rail-timetable";

const STP_TO_BDM = {
  id: "journey-1",
  name: "London St Pancras International to Bedford",
  provider: "national-rail" as const,
  origin: {
    id: "STP",
    label: "London St Pancras International",
  },
  destination: {
    id: "BDM",
    label: "Bedford",
  },
};

const REF_XML = `<?xml version="1.0" encoding="utf-8"?>
<PportTimetableRef xmlns="http://www.thalesgroup.com/rtti/XmlRefData/v4">
  <LocationRef tpl="STPX" crs="STP" locname="London St Pancras (Intl)" />
  <LocationRef tpl="BEDFDM" crs="BDM" locname="Bedford" />
  <LocationRef tpl="LTN" crs="LTN" locname="Luton" />
</PportTimetableRef>`;

const TIMETABLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<PportTimetable xmlns="http://www.thalesgroup.com/rtti/XmlTimetable/v8">
  <Journey rid="202604240000001" uid="P00001" trainId="1A01" ssd="2026-04-24" toc="TL">
    <OR tpl="STPX" ptd="10:10" plat="1" />
    <IP tpl="LTN" pta="10:35" ptd="10:36" />
    <DT tpl="BEDFDM" pta="10:55" />
  </Journey>
  <Journey rid="202604240000002" uid="P00002" trainId="1A02" ssd="2026-04-24" toc="TL">
    <OR tpl="STPX" ptd="12:15" plat="2" />
    <DT tpl="BEDFDM" pta="12:55" />
  </Journey>
</PportTimetable>`;

test("selects latest PPTimetable run and latest run files", () => {
  const latestRun = __testing.pickLatestRun([
    "PPTimetable/20260423020459_ref_v1.xml.gz",
    "PPTimetable/20260423020459_v8.xml.gz",
    "PPTimetable/20260424020459_ref_v1.xml.gz",
    "PPTimetable/20260424020459_ref_v4.xml.gz",
    "PPTimetable/20260424020459_ref_v99.xml.gz",
    "PPTimetable/20260424020459_v4.xml.gz",
    "PPTimetable/20260424020459_v8.xml.gz",
    "PPTimetable/readme.txt",
  ]);

  assert.equal(latestRun, "20260424020459");

  const latestFiles = __testing.pickLatestFilesForRun(
    [
      "PPTimetable/20260424020459_ref_v4.xml.gz",
      "PPTimetable/20260424020459_ref_v99.xml.gz",
      "PPTimetable/20260424020459_v7.xml.gz",
      "PPTimetable/20260424020459_v8.xml.gz",
    ],
    "20260424020459",
  );

  assert.equal(latestFiles.referenceName, "PPTimetable/20260424020459_ref_v99.xml.gz");
  assert.equal(latestFiles.timetableName, "PPTimetable/20260424020459_v8.xml.gz");
});

test("matches scheduled journeys by CRS using tpl references and filters by time window", () => {
  const refMap = __testing.parseReferenceMap(REF_XML);
  const journeys = __testing.parseJourneys(TIMETABLE_XML, refMap);
  const options = __testing.collectOptionsForJourney(
    STP_TO_BDM,
    journeys,
    new Date("2026-04-24T10:00:00"),
    1,
  );

  assert.equal(options.length, 1);
  assert.equal(options[0].id, "202604240000001");
  assert.equal(options[0].scheduledDeparture, "10:10");
  assert.equal(options[0].scheduledArrival, "10:55");
  assert.equal(options[0].platform, "1");
  assert.equal(options[0].operatorCode, "TL");
});

test("returns both journeys when time window expands", () => {
  const refMap = __testing.parseReferenceMap(REF_XML);
  const journeys = __testing.parseJourneys(TIMETABLE_XML, refMap);
  const options = __testing.collectOptionsForJourney(
    STP_TO_BDM,
    journeys,
    new Date("2026-04-24T10:00:00"),
    3,
  );

  assert.equal(options.length, 2);
  assert.equal(options[0].scheduledDeparture, "10:10");
  assert.equal(options[1].scheduledDeparture, "12:15");
});
