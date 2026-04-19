import { createRequire } from "node:module";

import type { JourneySearchResult } from "../journeys/types";

type NationalRailCountry = "england" | "scotland" | "wales";

interface NationalRailStationRecord {
  stationName: string;
  crsCode: string;
  constituentCountry: NationalRailCountry;
}

const NATIONAL_RAIL_PROVIDER = "national-rail" as const;
const SEARCH_RESULT_LIMIT = 8;
const COUNTRY_LABELS: Record<NationalRailCountry, string> = {
  england: "England",
  scotland: "Scotland",
  wales: "Wales",
};
const require = createRequire(import.meta.url);
const NATIONAL_RAIL_STATIONS = require("uk-railway-stations/stations.json") as NationalRailStationRecord[];

function normalizeStationSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getStationSearchScore(
  station: NationalRailStationRecord,
  normalizedQuery: string,
  uppercaseQuery: string,
  preferCodeMatches: boolean,
) {
  const normalizedLabel = normalizeStationSearchText(station.stationName);
  const labelMatchIndex = normalizedLabel.indexOf(normalizedQuery);
  const wordMatchIndex = normalizedLabel
    .split(" ")
    .findIndex((word) => word.startsWith(normalizedQuery));

  if (station.crsCode === uppercaseQuery) {
    return preferCodeMatches ? 5_000 : 750;
  }

  if (normalizedLabel === normalizedQuery) {
    return 4_000;
  }

  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 3_000 - normalizedLabel.length;
  }

  if (station.crsCode.startsWith(uppercaseQuery)) {
    return preferCodeMatches ? 2_500 : 250;
  }

  if (wordMatchIndex !== -1) {
    return 2_000 - wordMatchIndex * 10 - normalizedLabel.length;
  }

  if (labelMatchIndex !== -1) {
    return 1_000 - labelMatchIndex * 10 - normalizedLabel.length;
  }

  if (station.crsCode.includes(uppercaseQuery)) {
    return preferCodeMatches ? 500 : 100;
  }

  return -1;
}

function toJourneySearchResult(
  station: NationalRailStationRecord,
): JourneySearchResult {
  return {
    id: station.crsCode,
    label: station.stationName,
    secondaryLabel: `National Rail · ${COUNTRY_LABELS[station.constituentCountry]}`,
    provider: NATIONAL_RAIL_PROVIDER,
  };
}

export function searchNationalRailStations(query: string): JourneySearchResult[] {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeStationSearchText(trimmedQuery);

  if (!normalizedQuery) {
    return [];
  }

  const uppercaseQuery = trimmedQuery.toUpperCase();
  const preferCodeMatches =
    trimmedQuery === uppercaseQuery && /^[A-Z0-9]{1,3}$/.test(trimmedQuery);
  const matches = NATIONAL_RAIL_STATIONS.map((station) => ({
    station,
    score: getStationSearchScore(
      station,
      normalizedQuery,
      uppercaseQuery,
      preferCodeMatches,
    ),
  }))
    .filter((match) => match.score >= 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.station.stationName.localeCompare(right.station.stationName) ||
        left.station.crsCode.localeCompare(right.station.crsCode),
    )
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((match) => toJourneySearchResult(match.station));

  if (
    preferCodeMatches &&
    /^[A-Z]{3}$/.test(uppercaseQuery) &&
    !matches.some((match) => match.id === uppercaseQuery)
  ) {
    matches.unshift({
      id: uppercaseQuery,
      label: uppercaseQuery,
      secondaryLabel: "Manual CRS entry",
      provider: NATIONAL_RAIL_PROVIDER,
    });
  }

  return matches.slice(0, SEARCH_RESULT_LIMIT);
}
