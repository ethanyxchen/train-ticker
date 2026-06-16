"use client";

import {
  useMemo,
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
  getBoardRowAnimationStates,
  getBoardRowKey,
  type BoardRowAnimationState,
  type BoardRowSnapshot,
} from "@/lib/journeys/board-row-diff";
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
  previousSnapshot: JourneySnapshot | undefined;
  layout: ResolvedBoardLayout;
  refreshing: boolean;
  introAnimationId?: number | string;
}

type BoardRow = BoardRowSnapshot & {
  time: string;
  origin: string;
  destination: string;
  operator: string;
  platform: string;
  status: string;
  statusTone: JourneySnapshotTone;
};

type BoardColumn = {
  key: keyof BoardTickers;
  label: string;
  align?: "left" | "right";
};

const BOARD_GAP_REM = 1;
const TIME_COLUMN = { key: "time", label: "Time", align: "right" } as const;
const ORIGIN_COLUMN = { key: "origin", label: "Origin" } as const;
const DESTINATION_COLUMN = { key: "destination", label: "Destination" } as const;
const OPERATOR_COLUMN = { key: "operator", label: "Operator" } as const;
const PLATFORM_COLUMN = { key: "platform", label: "Platform" } as const;
const STATUS_COLUMN = { key: "status", label: "Status" } as const;
const BOARD_COLUMNS: readonly BoardColumn[] = [
  TIME_COLUMN,
  ORIGIN_COLUMN,
  DESTINATION_COLUMN,
  OPERATOR_COLUMN,
  PLATFORM_COLUMN,
  STATUS_COLUMN,
];
const COMPACT_BOARD_COLUMNS: readonly [readonly BoardColumn[], readonly BoardColumn[]] = [
  [
    TIME_COLUMN,
    ORIGIN_COLUMN,
    { ...DESTINATION_COLUMN, label: "Dest" },
  ],
  [
    { ...OPERATOR_COLUMN, label: "Oper" },
    { ...PLATFORM_COLUMN, label: "Plat" },
    STATUS_COLUMN,
  ],
];

function getBoardGridStyle(
  tickers: BoardTickers,
  columns: readonly BoardColumn[],
) {
  return {
    gridTemplateColumns: columns
      .map((column) => getSplitFlapWidth(tickers[column.key]))
      .join(" "),
    columnGap: `${BOARD_GAP_REM}rem`,
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
    return { value: "NO SERVICE", tone: "warn" as const };
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
  const operatorField = getBoardField(snapshot, "OPER");
  const departureField = getBoardField(snapshot, "DEP");
  const fallbackStatus = getStatusFallback(snapshot);

  return {
    time: normalizeBoardValue(
      departureField?.value,
      "--:--",
    ),
    origin: getStationAbbreviation(journey.origin),
    destination: getStationAbbreviation(journey.destination),
    operator: normalizeBoardValue(operatorField?.value, "--"),
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

function hasBoardCellValue(row: BoardRow | undefined, column: BoardColumn) {
  const value = row?.[column.key].trim();

  return Boolean(value && value !== "--" && value !== "--:--");
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
    .map((option) => {
      const optionStatus = getOptionStatus(snapshot, option);

      return {
        optionId: option.id,
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

function BoardHeader({
  tickers,
  columns,
  refreshing,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
  refreshing?: boolean;
}) {
  const boardGridStyle = getBoardGridStyle(tickers, columns);

  return (
    <div className="relative">
      <div className="grid items-center px-[0.15rem]" style={boardGridStyle}>
        {columns.map((column) => (
          <div
            key={column.key}
            className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]"
          >
            {column.label}
          </div>
        ))}
      </div>
      {refreshing !== undefined ? (
        <div
          aria-label={refreshing ? "Updating" : "Live"}
          className="absolute right-[0.15rem] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-end"
          role="status"
        >
          <span
            className={[
              "h-2 w-2 rounded-full",
              refreshing ? "animate-pulse bg-[var(--board-header)]" : "bg-[var(--good)]",
            ].join(" ")}
          />
        </div>
      ) : null}
    </div>
  );
}

function BoardGridRow({
  tickers,
  columns,
  row,
  animatedCells,
  animationId,
  switchable = true,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
  row?: BoardRow;
  animatedCells?: BoardRowAnimationState;
  animationId?: number | string;
  switchable?: boolean;
}) {
  const boardGridStyle = getBoardGridStyle(tickers, columns);

  return (
    <div className="grid items-center" style={boardGridStyle}>
      {columns.map((column) => {
        const hasValue = hasBoardCellValue(row, column);

        return (
          <SplitFlapText
            key={column.key}
            value={row ? row[column.key] : ""}
            length={tickers[column.key]}
            align={column.align}
            tone={column.key === "status" && row ? row.statusTone : "neutral"}
            animationId={
              hasValue && animatedCells?.[column.key] ? animationId : undefined
            }
            switchable={switchable && hasValue}
          />
        );
      })}
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
  previousSnapshot,
  layout,
  refreshing,
  introAnimationId,
}: JourneyBoardProps) {
  const [compact, setCompact] = useState(false);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(
    () => toBoardRows(journey, snapshot),
    [journey, snapshot],
  );
  const previousRows = useMemo(
    () => (previousSnapshot ? toBoardRows(journey, previousSnapshot) : null),
    [journey, previousSnapshot],
  );
  const emptyRowCount = Math.max(JOURNEY_BOARD_ROW_COUNT - rows.length, 0);
  const boardTickers = layout.tickers;
  const boardMinWidthRem = getBoardWidthRem(boardTickers, BOARD_GAP_REM);
  const boardWidthStyle = {
    minWidth: `${boardMinWidthRem}rem`,
  } satisfies CSSProperties;
  const fallbackRowKey = `fallback:${journey.id}`;
  const animateAllFields =
    introAnimationId !== undefined && previousSnapshot === undefined;
  const animatedRows = getBoardRowAnimationStates(
    rows,
    previousRows ?? [],
    fallbackRowKey,
    {
      animateAllFields,
      suppressNewRows: previousRows === null && !animateAllFields,
    },
  );

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
    <section className="w-full">
      <div className="overflow-hidden" ref={boardViewportRef}>
        <div
          className="w-full space-y-3"
          style={compact ? undefined : boardWidthStyle}
        >
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
                {rows.map((row, index) => (
                  <div
                    key={getBoardRowKey(row, fallbackRowKey)}
                    className="space-y-2"
                  >
                    <BoardGridRow
                      tickers={boardTickers}
                      columns={COMPACT_BOARD_COLUMNS[0]}
                      row={row}
                      animatedCells={animatedRows[index]}
                      animationId={
                        animatedRows[index] &&
                        (animateAllFields
                          ? `intro:${introAnimationId}:${index}`
                          : `${getBoardRowKey(row, fallbackRowKey)}:${row.time}:${row.platform}:${row.status}:${row.statusTone}`)
                      }
                    />
                    <BoardGridRow
                      tickers={boardTickers}
                      columns={COMPACT_BOARD_COLUMNS[1]}
                      row={row}
                      animatedCells={animatedRows[index]}
                      animationId={
                        animatedRows[index] &&
                        (animateAllFields
                          ? `intro:${introAnimationId}:${index}`
                          : `${getBoardRowKey(row, fallbackRowKey)}:${row.time}:${row.platform}:${row.status}:${row.statusTone}`)
                      }
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
              <BoardHeader
                tickers={boardTickers}
                columns={BOARD_COLUMNS}
                refreshing={refreshing}
              />

              <div className="space-y-2">
                {rows.map((row, index) => (
                  <BoardGridRow
                    key={getBoardRowKey(row, fallbackRowKey)}
                    tickers={boardTickers}
                    columns={BOARD_COLUMNS}
                    row={row}
                    animatedCells={animatedRows[index]}
                    animationId={
                      animatedRows[index] &&
                      (animateAllFields
                        ? `intro:${introAnimationId}:${index}`
                        : `${getBoardRowKey(row, fallbackRowKey)}:${row.time}:${row.platform}:${row.status}:${row.statusTone}`)
                    }
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
    </section>
  );
}
