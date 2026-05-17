import type { BoardTickers } from "@/lib/journeys/board-layout";
import type { JourneyLocation } from "@/lib/journeys/types";

export const BASE_BOARD_TICKERS: BoardTickers = {
  time: 5,
  origin: 3,
  destination: 3,
  operator: 3,
  platform: 2,
  status: 10,
};

function formatStationLabel(label: string) {
  const normalized = label
    .replace(/\bSt\./gi, "St")
    .replace(/\s+International\b/gi, "")
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
