import {
  resolveBoardStationLayout,
  type BoardStationRow,
  type BoardTickers,
  type ResolvedBoardLayout,
} from "@/lib/journeys/board-layout";
import type { JourneyLocation, SavedJourney } from "@/lib/journeys/types";

export const BASE_BOARD_TICKERS: BoardTickers = {
  time: 5,
  origin: 3,
  destination: 22,
  operator: 3,
  platform: 2,
  status: 7,
};

export function formatStationLabel(label: string) {
  const normalized = label
    .replace(/\bSt\./gi, "St")
    .replace(/\s+International\b/gi, "")
    .replace(/\s+Underground Station\b/gi, "")
    .replace(/\s+Rail Station\b/gi, "")
    .replace(/\s+Station\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || label;
}

export function getStationAbbreviation(location: JourneyLocation) {
  const id = location.id.trim().toUpperCase();

  if (/^[A-Z0-9]{1,3}$/.test(id)) {
    return id;
  }

  const words = formatStationLabel(location.label)
    .replace(/['’]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const abbreviation =
    words.length > 1 ? words.map((word) => word[0]).join("") : words[0];

  return (abbreviation ?? id.replace(/[^A-Z0-9]/g, "")).slice(0, 3);
}

export function toBoardStationRow(
  journey: Pick<SavedJourney, "origin" | "destination">,
): BoardStationRow {
  return {
    originFull: formatStationLabel(journey.origin.label),
    originAbbreviated: getStationAbbreviation(journey.origin),
    destinationFull: formatStationLabel(journey.destination.label),
    destinationAbbreviated: getStationAbbreviation(journey.destination),
  };
}

export function resolveSharedBoardLayout({
  availableRem,
  journeys,
  gapRem,
}: {
  availableRem: number;
  journeys: Pick<SavedJourney, "origin" | "destination">[];
  gapRem: number;
}): ResolvedBoardLayout {
  return resolveBoardStationLayout({
    availableRem,
    baseTickers: BASE_BOARD_TICKERS,
    rows: journeys.map(toBoardStationRow),
    gapRem,
  });
}
