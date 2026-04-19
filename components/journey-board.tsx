"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  SplitFlapText,
  getSplitFlapWidth,
} from "@/components/split-flap-text";
import {
  getBoardWidthRem,
  resolveBoardStationLayout,
  type BoardTickers,
} from "@/lib/journeys/board-layout";
import { JOURNEY_BOARD_ROW_COUNT } from "@/lib/journeys/constants";
import { getBoardOperatorLabel } from "@/lib/journeys/operator-display";
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
  originFull: string;
  originAbbreviated: string;
  destinationFull: string;
  destinationAbbreviated: string;
  operator: string;
  platform: string;
  status: string;
  statusTone: JourneySnapshotTone;
}

interface BoardIssue {
  id: string;
  route: string;
  headline: string;
  tone: JourneySnapshotTone;
}

const BASE_BOARD_TICKERS: BoardTickers = {
  time: 5,
  origin: 3,
  destination: 22,
  operator: 3,
  platform: 2,
  status: 7,
};
const TICKER_SWITCH_INTERVAL_MS = 10_000;
const BOARD_GAP_REM = 0.75;

function getBoardGridStyle(tickers: BoardTickers) {
  return {
    gridTemplateColumns: [
      getSplitFlapWidth(tickers.time),
      getSplitFlapWidth(tickers.origin),
      getSplitFlapWidth(tickers.destination),
      getSplitFlapWidth(tickers.operator),
      getSplitFlapWidth(tickers.platform),
      getSplitFlapWidth(tickers.status),
    ].join(" "),
  } satisfies CSSProperties;
}

function hasSameTickerLengths(
  left: BoardTickers,
  right: BoardTickers,
) {
  return (
    left.time === right.time &&
    left.origin === right.origin &&
    left.destination === right.destination &&
    left.operator === right.operator &&
    left.platform === right.platform &&
    left.status === right.status
  );
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

function toBoardRows(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
): BoardRow[] {
  if (!snapshot?.options.length) {
    return [];
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
        originFull: formatStationLabel(journey.origin.label),
        originAbbreviated: getStationAbbreviation(journey.origin),
        destinationFull: formatStationLabel(journey.destination.label),
        destinationAbbreviated: getStationAbbreviation(journey.destination),
        operator: getBoardOperatorLabel({
          operator: option.operator,
          operatorCode: option.operatorCode,
        }),
        platform: normalizeBoardValue(option.platform, "--"),
        status: normalizeBoardValue(optionStatus.value, "WAIT"),
        statusTone: optionStatus.tone,
      };
    });
}

function toBoardIssue(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
): BoardIssue | null {
  if (!snapshot || snapshot.options.length > 0) {
    return null;
  }

  return {
    id: journey.id,
    route: `${journey.origin.label} to ${journey.destination.label}`,
    headline: snapshot.headline,
    tone: snapshot.status === "error" ? "bad" : "warn",
  };
}

function EmptyRow({ tickers }: { tickers: BoardTickers }) {
  const boardGridStyle = getBoardGridStyle(tickers);

  return (
    <div className="grid items-center gap-3" style={boardGridStyle}>
      <SplitFlapText
        value=""
        length={tickers.time}
        align="right"
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={tickers.origin}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={tickers.destination}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={tickers.operator}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={tickers.platform}
        tone="neutral"
        switchable={false}
      />
      <SplitFlapText
        value=""
        length={tickers.status}
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [tickerCycle, setTickerCycle] = useState(0);
  const [boardTickers, setBoardTickers] = useState(BASE_BOARD_TICKERS);
  const [boardInsetRem, setBoardInsetRem] = useState(0);
  const [useStationAbbreviations, setUseStationAbbreviations] = useState(false);
  const rows = journeys.flatMap((journey) =>
    toBoardRows(journey, snapshots[journey.id]),
  );
  const issues = journeys.flatMap((journey) => {
    const issue = toBoardIssue(journey, snapshots[journey.id]);
    return issue ? [issue] : [];
  });
  const emptyRowCount = Math.max(JOURNEY_BOARD_ROW_COUNT - rows.length, 0);
  const boardGridStyle = getBoardGridStyle(boardTickers);
  const boardMinWidthRem = getBoardWidthRem(boardTickers, BOARD_GAP_REM);
  const boardWidthStyle = {
    minWidth: `${boardMinWidthRem}rem`,
    paddingInline: `${boardInsetRem}rem`,
  } satisfies CSSProperties;
  const stationLayoutSignature = rows
    .map(
      (row) =>
        `${row.originFull}:${row.originAbbreviated}:${row.destinationFull}:${row.destinationAbbreviated}`,
    )
    .join("|");
  const stationLayoutRows = JSON.stringify(
    rows.map((row) => ({
      originFull: row.originFull,
      originAbbreviated: row.originAbbreviated,
      destinationFull: row.destinationFull,
      destinationAbbreviated: row.destinationAbbreviated,
    })),
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickerCycle((currentTickerCycle) => currentTickerCycle + 1);
    }, TICKER_SWITCH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const boardElement = boardRef.current;

    if (!boardElement) {
      return;
    }

    function updateBoardLayout() {
      const nextBoardElement = boardRef.current;

      if (!nextBoardElement) {
        return;
      }

      const rootFontSize =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const nextLayout = resolveBoardStationLayout({
        availableRem: nextBoardElement.clientWidth / rootFontSize,
        baseTickers: BASE_BOARD_TICKERS,
        rows: JSON.parse(stationLayoutRows),
        gapRem: BOARD_GAP_REM,
      });

      setBoardTickers((currentTickers) =>
        hasSameTickerLengths(currentTickers, nextLayout.tickers)
          ? currentTickers
          : nextLayout.tickers,
      );
      setBoardInsetRem((currentInsetRem) =>
        currentInsetRem === nextLayout.insetRem
          ? currentInsetRem
          : nextLayout.insetRem,
      );
      setUseStationAbbreviations((currentValue) =>
        currentValue === nextLayout.useStationAbbreviations
          ? currentValue
          : nextLayout.useStationAbbreviations,
      );
    }

    updateBoardLayout();

    const resizeObserver = new ResizeObserver(() => {
      updateBoardLayout();
    });

    resizeObserver.observe(boardElement);

    return () => resizeObserver.disconnect();
  }, [stationLayoutRows, stationLayoutSignature]);

  return (
    <section className="rounded-[1.15rem] border border-[#4a4b4e] bg-[linear-gradient(180deg,#232427,#17181a)] p-4">
      <div className="overflow-x-auto" ref={boardRef}>
        <div className="w-full space-y-3" style={boardWidthStyle}>
          {issues.length ? (
            <div className="space-y-1 px-[0.15rem] text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(247,244,238,0.7)]">
              {issues.map((issue) => (
                <div key={issue.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={[
                      "font-medium",
                      issue.tone === "bad"
                        ? "text-[var(--bad)]"
                        : issue.tone === "good"
                          ? "text-[var(--good)]"
                          : "text-[var(--warn)]",
                    ].join(" ")}
                  >
                    {issue.route}
                  </span>
                  <span>{issue.headline}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div
            className="grid items-center gap-3 px-[0.15rem]"
            style={boardGridStyle}
          >
            <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
              Time
            </div>
            <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
              Orig
            </div>
            <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
              {useStationAbbreviations ? "Dest" : "Destination"}
            </div>
            <div className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]">
              Op
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
                style={boardGridStyle}
              >
                <SplitFlapText
                  value={row.time}
                  length={boardTickers.time}
                  align="right"
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={
                    useStationAbbreviations
                      ? row.originAbbreviated
                      : row.originFull
                  }
                  length={boardTickers.origin}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={
                    useStationAbbreviations
                      ? row.destinationAbbreviated
                      : row.destinationFull
                  }
                  length={boardTickers.destination}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.operator}
                  length={boardTickers.operator}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.platform}
                  length={boardTickers.platform}
                  tone="neutral"
                  cycle={tickerCycle}
                />
                <SplitFlapText
                  value={row.status}
                  length={boardTickers.status}
                  tone={row.statusTone}
                  cycle={tickerCycle}
                />
              </div>
            ))}

            {Array.from({ length: emptyRowCount }).map((_, index) => (
              <EmptyRow key={`empty-row-${index}`} tickers={boardTickers} />
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
