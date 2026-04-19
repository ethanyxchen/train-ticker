"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  SplitFlapText,
  getSplitFlapWidth,
} from "@/components/split-flap-text";
import {
  getBoardWidthRem,
  shouldUseCompactBoardLayout,
  type ResolvedBoardLayout,
  type BoardTickers,
} from "@/lib/journeys/board-layout";
import { getStationAbbreviation } from "@/lib/journeys/board-display";
import { JOURNEY_BOARD_ROW_COUNT } from "@/lib/journeys/constants";
import { getBoardOperatorLabel } from "@/lib/journeys/operator-display";
import type {
  JourneySnapshot,
  JourneySnapshotTone,
  SavedJourney,
} from "@/lib/journeys/types";

interface JourneyBoardProps {
  journey: SavedJourney;
  snapshot: JourneySnapshot | undefined;
  layout: ResolvedBoardLayout;
  refreshing: boolean;
  introCycle?: number;
  onRemove: () => void;
}

interface BoardRow {
  id: string;
  time: string;
  origin: string;
  destination: string;
  operator: string;
  platform: string;
  status: string;
  statusTone: JourneySnapshotTone;
}

interface BoardIssue {
  id: string;
  headline: string;
  subheadline: string;
  tone: JourneySnapshotTone;
}

type BoardColumn = {
  key: keyof BoardTickers;
  label: string;
  align?: "left" | "right";
};

const TICKER_SWITCH_INTERVAL_MS = 10_000;
const BOARD_GAP_REM = 0.75;
const BOARD_COLUMNS: readonly BoardColumn[] = [
  { key: "time", label: "Time", align: "right" },
  { key: "origin", label: "Orig" },
  { key: "destination", label: "Dest" },
  { key: "operator", label: "Op" },
  { key: "platform", label: "Pl" },
  { key: "status", label: "Status" },
];
const COMPACT_BOARD_COLUMNS: readonly [readonly BoardColumn[], readonly BoardColumn[]] = [
  BOARD_COLUMNS.slice(0, 3),
  BOARD_COLUMNS.slice(3),
];

function getBoardGridStyle(
  tickers: BoardTickers,
  columns: readonly BoardColumn[],
) {
  return {
    gridTemplateColumns: columns
      .map((column) => getSplitFlapWidth(tickers[column.key]))
      .join(" "),
  } satisfies CSSProperties;
}

function getBoardField(snapshot: JourneySnapshot | undefined, label: string) {
  return snapshot?.boardFields.find((field) => field.label === label);
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
  if (!snapshot) {
    return {
      id: journey.id,
      time: "",
      origin: "",
      destination: "",
      operator: "",
      platform: "",
      status: "",
      statusTone: "neutral",
    };
  }

  const liveField = getBoardField(snapshot, "LIVE");
  const statusField = getBoardField(snapshot, "STAT");
  const platformField = getBoardField(snapshot, "PLAT");
  const departureField = getBoardField(snapshot, "DEP");
  const fallbackStatus = getStatusFallback(snapshot);

  return {
    id: journey.id,
    time: normalizeBoardValue(
      departureField?.value,
      "--:--",
    ),
    origin: getStationAbbreviation(journey.origin),
    destination: getStationAbbreviation(journey.destination),
    operator: "--",
    platform: normalizeBoardValue(platformField?.value, "--"),
    status: normalizeBoardValue(
      liveField?.value ?? statusField?.value ?? fallbackStatus?.value,
      "WAIT",
    ),
    statusTone:
      liveField?.tone ??
      statusField?.tone ??
      fallbackStatus?.tone ??
      "neutral",
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
        destination: getStationAbbreviation(journey.destination),
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
  snapshot: JourneySnapshot | undefined,
): BoardIssue | null {
  if (!snapshot || snapshot.options.length > 0) {
    return null;
  }

  return {
    id: snapshot.journeyId,
    headline: snapshot.headline,
    subheadline: snapshot.subheadline,
    tone: snapshot.status === "error" ? "bad" : "warn",
  };
}

function BoardHeader({
  tickers,
  columns,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
}) {
  const boardGridStyle = getBoardGridStyle(tickers, columns);

  return (
    <div className="grid items-center gap-3 px-[0.15rem]" style={boardGridStyle}>
      {columns.map((column) => (
        <div
          key={column.key}
          className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]"
        >
          {column.label}
        </div>
      ))}
    </div>
  );
}

function BoardGridRow({
  tickers,
  columns,
  row,
  cycle,
  animateOnMount = false,
  switchable = true,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
  row?: BoardRow;
  cycle?: number;
  animateOnMount?: boolean;
  switchable?: boolean;
}) {
  const boardGridStyle = getBoardGridStyle(tickers, columns);

  return (
    <div className="grid items-center gap-3" style={boardGridStyle}>
      {columns.map((column) => (
        <SplitFlapText
          key={column.key}
          value={row ? row[column.key] : ""}
          length={tickers[column.key]}
          align={column.align}
          tone={column.key === "status" && row ? row.statusTone : "neutral"}
          cycle={row ? cycle : undefined}
          animateOnMount={row ? animateOnMount : false}
          switchable={switchable}
        />
      ))}
    </div>
  );
}

function EmptyRow({
  tickers,
  compact,
}: {
  tickers: BoardTickers;
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="space-y-2">
        <BoardGridRow
          tickers={tickers}
          columns={COMPACT_BOARD_COLUMNS[0]}
          switchable={false}
        />
        <BoardGridRow
          tickers={tickers}
          columns={COMPACT_BOARD_COLUMNS[1]}
          switchable={false}
        />
      </div>
    );
  }

  return (
    <BoardGridRow
      tickers={tickers}
      columns={BOARD_COLUMNS}
      switchable={false}
    />
  );
}

export function JourneyBoard({
  journey,
  snapshot,
  layout,
  refreshing,
  introCycle,
  onRemove,
}: JourneyBoardProps) {
  const [tickerCycle, setTickerCycle] = useState(0);
  const [compact, setCompact] = useState(false);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const rows = toBoardRows(journey, snapshot);
  const issue = toBoardIssue(snapshot);
  const emptyRowCount = Math.max(JOURNEY_BOARD_ROW_COUNT - rows.length, 0);
  const boardTickers = layout.tickers;
  const boardMinWidthRem = getBoardWidthRem(boardTickers, BOARD_GAP_REM);
  const boardWidthStyle = {
    minWidth: `${boardMinWidthRem}rem`,
    paddingInline: `${layout.insetRem}rem`,
  } satisfies CSSProperties;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickerCycle((currentTickerCycle) => currentTickerCycle + 1);
    }, TICKER_SWITCH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useLayoutEffect(() => {
    const boardViewportElement = boardViewportRef.current;

    if (!boardViewportElement) {
      return;
    }

    function updateCompactLayout() {
      const nextBoardViewportElement = boardViewportRef.current;

      if (!nextBoardViewportElement) {
        return;
      }

      const rootFontSize =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const nextCompact = shouldUseCompactBoardLayout(
        nextBoardViewportElement.clientWidth / rootFontSize,
        boardTickers,
        BOARD_GAP_REM,
      );

      setCompact((currentCompact) =>
        currentCompact === nextCompact ? currentCompact : nextCompact,
      );
    }

    updateCompactLayout();

    const resizeObserver = new ResizeObserver(() => {
      updateCompactLayout();
    });

    resizeObserver.observe(boardViewportElement);

    return () => resizeObserver.disconnect();
  }, [boardTickers]);

  return (
    <section className="rounded-[1.15rem] border border-[#4a4b4e] bg-[linear-gradient(180deg,#232427,#17181a)] p-4">
      <div className="overflow-hidden" ref={boardViewportRef}>
        <div
          className="w-full space-y-3"
          style={compact ? undefined : boardWidthStyle}
        >
          {issue ? (
            <div className="space-y-1 px-[0.15rem] text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(247,244,238,0.7)]">
              <div
                className={[
                  "font-medium",
                  issue.tone === "bad"
                    ? "text-[var(--bad)]"
                    : issue.tone === "good"
                      ? "text-[var(--good)]"
                      : "text-[var(--warn)]",
                ].join(" ")}
              >
                {issue.headline}
              </div>
              {issue.subheadline ? <div>{issue.subheadline}</div> : null}
            </div>
          ) : null}

          {compact ? (
            <>
              <div className="space-y-2">
                <BoardHeader
                  tickers={boardTickers}
                  columns={COMPACT_BOARD_COLUMNS[0]}
                />
                <BoardHeader
                  tickers={boardTickers}
                  columns={COMPACT_BOARD_COLUMNS[1]}
                />
              </div>

              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.id} className="space-y-2">
                    <BoardGridRow
                      tickers={boardTickers}
                      columns={COMPACT_BOARD_COLUMNS[0]}
                      row={row}
                      cycle={tickerCycle}
                      animateOnMount={introCycle !== undefined}
                    />
                    <BoardGridRow
                      tickers={boardTickers}
                      columns={COMPACT_BOARD_COLUMNS[1]}
                      row={row}
                      cycle={tickerCycle}
                      animateOnMount={introCycle !== undefined}
                    />
                  </div>
                ))}

                {Array.from({ length: emptyRowCount }).map((_, index) => (
                  <EmptyRow
                    key={`empty-row-${index}`}
                    tickers={boardTickers}
                    compact
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <BoardHeader tickers={boardTickers} columns={BOARD_COLUMNS} />

              <div className="space-y-2">
                {rows.map((row) => (
                  <BoardGridRow
                    key={row.id}
                    tickers={boardTickers}
                    columns={BOARD_COLUMNS}
                    row={row}
                    cycle={tickerCycle}
                    animateOnMount={introCycle !== undefined}
                  />
                ))}

                {Array.from({ length: emptyRowCount }).map((_, index) => (
                  <EmptyRow
                    key={`empty-row-${index}`}
                    tickers={boardTickers}
                    compact={false}
                  />
                ))}
              </div>
            </>
          )}
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
          onClick={onRemove}
          className="h-8 rounded-[0.45rem] border border-[#0d0e10] bg-[linear-gradient(180deg,#2f3136,#1e2023)] px-3 text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(247,244,238,0.75)] transition hover:text-[var(--board-header)]"
        >
          Remove journey
        </button>
      </div>
    </section>
  );
}
