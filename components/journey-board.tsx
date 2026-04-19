"use client";

import type { CSSProperties } from "react";

import {
  SPLIT_FLAP_CELL,
  SplitFlapText,
  getSplitFlapWidth,
  getSplitFlapWidthRem,
} from "@/components/split-flap-text";
import { JOURNEY_BOARD_ROW_COUNT } from "@/lib/journeys/constants";
import type {
  JourneySnapshot,
  JourneySnapshotTone,
  SavedJourney,
} from "@/lib/journeys/types";

interface JourneyBoardProps {
  journeys: SavedJourney[];
  snapshots: Record<string, JourneySnapshot>;
  refreshing: boolean;
  onRemove: (journeyId: string) => void;
}

interface BoardRow {
  id: string;
  journeyId: string;
  time: string;
  destination: string;
  platform: string;
  status: string;
  statusTone: JourneySnapshotTone;
  removable: boolean;
}

const BOARD_TICKERS = {
  time: 5,
  destination: 22,
  platform: 2,
  status: 7,
} as const;
const BOARD_GAP_REM = 0.75;
const BOARD_COLUMNS = [
  getSplitFlapWidth(BOARD_TICKERS.time),
  getSplitFlapWidth(BOARD_TICKERS.destination),
  getSplitFlapWidth(BOARD_TICKERS.platform),
  getSplitFlapWidth(BOARD_TICKERS.status),
  `${SPLIT_FLAP_CELL.heightRem}rem`,
].join(" ");
const BOARD_GRID_STYLE = {
  gridTemplateColumns: BOARD_COLUMNS,
} satisfies CSSProperties;
const BOARD_MIN_WIDTH_REM =
  Object.values(BOARD_TICKERS).reduce<number>(
    (width, length) => width + getSplitFlapWidthRem(length),
    SPLIT_FLAP_CELL.heightRem,
  ) +
  Object.keys(BOARD_TICKERS).length * BOARD_GAP_REM;
const BOARD_MIN_WIDTH_STYLE = {
  minWidth: `${BOARD_MIN_WIDTH_REM}rem`,
} satisfies CSSProperties;
const BOARD_ACTION_STYLE = {
  height: `${SPLIT_FLAP_CELL.heightRem}rem`,
} satisfies CSSProperties;

function getBoardField(snapshot: JourneySnapshot | undefined, label: string) {
  return snapshot?.boardFields.find((field) => field.label === label);
}

function formatStationLabel(label: string) {
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

function normalizeBoardValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "--" ? trimmed : fallback;
}

function getStatusFallback(snapshot: JourneySnapshot) {
  const headline = snapshot.headline.toUpperCase();

  if (headline.includes("CANCEL")) {
    return { value: "CANCEL", tone: "bad" as const };
  }

  if (headline.includes("DELAY")) {
    return { value: "DELAYED", tone: "warn" as const };
  }

  if (headline.includes("NO ")) {
    return { value: "NO SVC", tone: "warn" as const };
  }

  switch (snapshot.status) {
    case "ok":
      return { value: "ON TIME", tone: "good" as const };
    case "warning":
      return { value: "CHECK", tone: "warn" as const };
    case "error":
      return { value: "ALERT", tone: "bad" as const };
    case "unconfigured":
      return { value: "SET UP", tone: "warn" as const };
  }

  return { value: "WAIT", tone: "warn" as const };
}

function getOptionStatus(
  snapshot: JourneySnapshot | undefined,
  option:
    | {
        expectedDeparture?: string;
        scheduledDeparture?: string;
      }
    | undefined,
) {
  const fallbackStatus = snapshot ? getStatusFallback(snapshot) : undefined;
  const expectedDeparture = option?.expectedDeparture?.trim();
  const scheduledDeparture = option?.scheduledDeparture?.trim();

  if (!expectedDeparture || expectedDeparture === scheduledDeparture) {
    return fallbackStatus ?? { value: "LOADING", tone: "warn" as const };
  }

  if (/^\d{2}:\d{2}$/.test(expectedDeparture)) {
    return { value: expectedDeparture, tone: "warn" as const };
  }

  if (expectedDeparture.toUpperCase() === "ON TIME") {
    return { value: "ON TIME", tone: "good" as const };
  }

  if (expectedDeparture.toUpperCase() === "CANCELLED") {
    return { value: "CANCEL", tone: "bad" as const };
  }

  return {
    value: expectedDeparture.toUpperCase(),
    tone: fallbackStatus?.tone ?? "warn",
  };
}

function buildFallbackRow(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
): BoardRow {
  const liveField = getBoardField(snapshot, "LIVE");
  const statusField = getBoardField(snapshot, "STAT");
  const platformField = getBoardField(snapshot, "PLAT");
  const departureField = getBoardField(snapshot, "DEP");
  const fallbackStatus = snapshot ? getStatusFallback(snapshot) : undefined;

  return {
    id: journey.id,
    journeyId: journey.id,
    time: normalizeBoardValue(
      departureField?.value,
      snapshot ? "--:--" : "LOAD",
    ),
    destination: formatStationLabel(journey.destination.label),
    platform: normalizeBoardValue(platformField?.value, "--"),
    status: normalizeBoardValue(
      liveField?.value ?? statusField?.value ?? fallbackStatus?.value,
      snapshot ? "WAIT" : "LOADING",
    ),
    statusTone:
      liveField?.tone ??
      statusField?.tone ??
      fallbackStatus?.tone ??
      (snapshot ? "neutral" : "warn"),
    removable: true,
  };
}

function toBoardRows(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
): BoardRow[] {
  if (!snapshot?.options.length) {
    return [buildFallbackRow(journey, snapshot)];
  }

  return snapshot.options
    .slice(0, JOURNEY_BOARD_ROW_COUNT)
    .map((option, index) => {
      const optionStatus = getOptionStatus(snapshot, option);

      return {
        id: `${journey.id}-${option.id}-${index}`,
        journeyId: journey.id,
        time: normalizeBoardValue(
          option.scheduledDeparture ?? option.expectedDeparture,
          "--:--",
        ),
        destination: formatStationLabel(journey.destination.label),
        platform: normalizeBoardValue(option.platform, "--"),
        status: normalizeBoardValue(optionStatus.value, "WAIT"),
        statusTone: optionStatus.tone,
        removable: index === 0,
      };
    });
}

function EmptyRow() {
  return (
    <div className="grid items-center gap-3" style={BOARD_GRID_STYLE}>
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.time}
        align="right"
        tone="neutral"
      />
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.destination}
        tone="neutral"
      />
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.platform}
        tone="neutral"
      />
      <SplitFlapText value="" length={BOARD_TICKERS.status} tone="neutral" />
      <div
        className="rounded-[0.45rem] border border-[#0d0e10] bg-[linear-gradient(180deg,#2f3136,#1e2023)]"
        style={BOARD_ACTION_STYLE}
      />
    </div>
  );
}

export function JourneyBoard({
  journeys,
  snapshots,
  refreshing,
  onRemove,
}: JourneyBoardProps) {
  const rows = journeys.flatMap((journey) =>
    toBoardRows(journey, snapshots[journey.id]),
  );
  const emptyRowCount = Math.max(JOURNEY_BOARD_ROW_COUNT - rows.length, 0);

  return (
    <section className="rounded-[1.7rem] border-[8px] border-[#bcb7af] bg-[linear-gradient(180deg,#d8d3cc,#a7a39d)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
      <div className="rounded-[1.15rem] border border-[#4a4b4e] bg-[linear-gradient(180deg,#232427,#17181a)] p-4">
        <div className="overflow-x-auto">
          <div className="space-y-3" style={BOARD_MIN_WIDTH_STYLE}>
            <div
              className="grid items-center gap-3 px-[0.15rem]"
              style={BOARD_GRID_STYLE}
            >
              <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
                Time
              </div>
              <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
                Destination
              </div>
              <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
                Pl
              </div>
              <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
                Status
              </div>
              <div />
            </div>

            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center gap-3"
                  style={BOARD_GRID_STYLE}
                >
                  <SplitFlapText
                    value={row.time}
                    length={BOARD_TICKERS.time}
                    align="right"
                    tone="neutral"
                  />
                  <SplitFlapText
                    value={row.destination}
                    length={BOARD_TICKERS.destination}
                    tone="neutral"
                  />
                  <SplitFlapText
                    value={row.platform}
                    length={BOARD_TICKERS.platform}
                    tone="neutral"
                  />
                  <SplitFlapText
                    value={row.status}
                    length={BOARD_TICKERS.status}
                    tone={row.statusTone}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(row.journeyId)}
                    aria-label="Remove journey"
                    className={[
                      "rounded-[0.45rem] border border-[#0d0e10] bg-[linear-gradient(180deg,#2f3136,#1e2023)] text-[0.95rem] transition",
                      row.removable
                        ? "text-[rgba(247,244,238,0.75)] hover:text-[var(--board-header)]"
                        : "cursor-default text-transparent",
                    ].join(" ")}
                    style={BOARD_ACTION_STYLE}
                    disabled={!row.removable}
                  >
                    ×
                  </button>
                </div>
              ))}

              {Array.from({ length: emptyRowCount }).map((_, index) => (
                <EmptyRow key={`empty-row-${index}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(247,244,238,0.48)]">
          <span
            className={[
              "h-2 w-2 rounded-full",
              refreshing ? "animate-pulse bg-[var(--board-header)]" : "bg-[var(--good)]",
            ].join(" ")}
          />
          <span>{refreshing ? "Updating" : "Live"}</span>
        </div>
      </div>
    </section>
  );
}
