"use client";

import { useEffect, useState, type CSSProperties } from "react";

import {
  SplitFlapText,
  getSplitFlapWidth,
  getSplitFlapWidthRem,
} from "@/components/split-flap-text";
import { JOURNEY_BOARD_ROW_COUNT } from "@/lib/journeys/constants";
import type {
  JourneyLocation,
  JourneySnapshot,
  JourneySnapshotTone,
  SavedJourney,
} from "@/lib/journeys/types";

interface JourneyBoardProps {
  journeys: SavedJourney[];
  snapshots: Record<string, JourneySnapshot>;
  refreshing: boolean;
  onClear: () => void;
}

interface BoardRow {
  id: string;
  time: string;
  origin: string;
  destination: string;
  platform: string;
  status: string;
  statusTone: JourneySnapshotTone;
}

const BOARD_TICKERS = {
  time: 5,
  origin: 3,
  destination: 25,
  platform: 2,
  status: 7,
} as const;
const TICKER_SWITCH_INTERVAL_MS = 10_000;
const BOARD_GAP_REM = 0.75;
const BOARD_COLUMNS = [
  getSplitFlapWidth(BOARD_TICKERS.time),
  getSplitFlapWidth(BOARD_TICKERS.origin),
  getSplitFlapWidth(BOARD_TICKERS.destination),
  getSplitFlapWidth(BOARD_TICKERS.platform),
  getSplitFlapWidth(BOARD_TICKERS.status),
].join(" ");
const BOARD_GRID_STYLE = {
  gridTemplateColumns: BOARD_COLUMNS,
} satisfies CSSProperties;
const BOARD_MIN_WIDTH_REM =
  Object.values(BOARD_TICKERS).reduce<number>(
    (width, length) => width + getSplitFlapWidthRem(length),
    0,
  ) +
  (Object.keys(BOARD_TICKERS).length - 1) * BOARD_GAP_REM;
const BOARD_MIN_WIDTH_STYLE = {
  minWidth: `${BOARD_MIN_WIDTH_REM}rem`,
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

function getStationAbbreviation(location: JourneyLocation) {
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
    time: normalizeBoardValue(
      departureField?.value,
      snapshot ? "--:--" : "LOAD",
    ),
    origin: getStationAbbreviation(journey.origin),
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
        time: normalizeBoardValue(
          option.scheduledDeparture ?? option.expectedDeparture,
          "--:--",
        ),
        origin: getStationAbbreviation(journey.origin),
        destination: formatStationLabel(journey.destination.label),
        platform: normalizeBoardValue(option.platform, "--"),
        status: normalizeBoardValue(optionStatus.value, "WAIT"),
        statusTone: optionStatus.tone,
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
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.origin}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.destination}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.platform}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={BOARD_TICKERS.status}
        tone="neutral"
        switchable={false}
      />
    </div>
  );
}

export function JourneyBoard({
  journeys,
  snapshots,
  refreshing,
  onClear,
}: JourneyBoardProps) {
  const [tickerCycle, setTickerCycle] = useState(0);
  const rows = journeys.flatMap((journey) =>
    toBoardRows(journey, snapshots[journey.id]),
  );
  const emptyRowCount = Math.max(JOURNEY_BOARD_ROW_COUNT - rows.length, 0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickerCycle((currentTickerCycle) => currentTickerCycle + 1);
    }, TICKER_SWITCH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="rounded-[1.15rem] border border-[#4a4b4e] bg-[linear-gradient(180deg,#232427,#17181a)] p-4">
      <div className="overflow-x-auto">
        <div className="mx-auto w-fit space-y-3" style={BOARD_MIN_WIDTH_STYLE}>
          <div
            className="grid items-center gap-3 px-[0.15rem]"
            style={BOARD_GRID_STYLE}
          >
            <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
              Time
            </div>
            <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
              Orig
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
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.origin}
                  length={BOARD_TICKERS.origin}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.destination}
                  length={BOARD_TICKERS.destination}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.platform}
                  length={BOARD_TICKERS.platform}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.status}
                  length={BOARD_TICKERS.status}
                  tone={row.statusTone}
                  cycle={tickerCycle}
                />
              </div>
            ))}

            {Array.from({ length: emptyRowCount }).map((_, index) => (
              <EmptyRow key={`empty-row-${index}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(247,244,238,0.48)]">
          <span
            className={[
              "h-2 w-2 rounded-full",
              refreshing ? "animate-pulse bg-[var(--board-header)]" : "bg-[var(--good)]",
            ].join(" ")}
          />
          <span>{refreshing ? "Updating" : "Live"}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!journeys.length}
          className="h-8 rounded-[0.45rem] border border-[#0d0e10] bg-[linear-gradient(180deg,#2f3136,#1e2023)] px-3 text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(247,244,238,0.75)] transition hover:text-[var(--board-header)] disabled:cursor-not-allowed disabled:text-[rgba(247,244,238,0.28)]"
        >
          Clear board
        </button>
      </div>
    </section>
  );
}
