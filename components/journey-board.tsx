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
  getFillerTickerCount,
  getBoardWidthRem,
  getTickerRowWidthRem,
  shouldUseCompactBoardLayout,
  splitFillerTickers,
  type FillerTickers,
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

const BOARD_GAP_REM = 0.75;
const BOARD_COLUMNS: readonly BoardColumn[] = [
  { key: "time", label: "Time", align: "right" },
  { key: "origin", label: "Origin" },
  { key: "destination", label: "Destination" },
  { key: "operator", label: "Operator" },
  { key: "platform", label: "Platform" },
  { key: "status", label: "Status" },
];
const COMPACT_BOARD_COLUMNS: readonly [readonly BoardColumn[], readonly BoardColumn[]] = [
  BOARD_COLUMNS.slice(0, 3),
  BOARD_COLUMNS.slice(3),
];

function getBoardGridStyle(
  tickers: BoardTickers,
  columns: readonly BoardColumn[],
  fillerTickers: FillerTickers,
) {
  const gridColumns = columns.map((column) => getSplitFlapWidth(tickers[column.key]));

  if (fillerTickers.left > 0) {
    gridColumns.unshift(getSplitFlapWidth(fillerTickers.left));
  }

  if (fillerTickers.right > 0) {
    gridColumns.push(getSplitFlapWidth(fillerTickers.right));
  }

  return {
    gridTemplateColumns: gridColumns.join(" "),
  } satisfies CSSProperties;
}

function getBoardFillerTickers({
  tickers,
  columns,
  availableRem,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
  availableRem: number;
}) {
  return splitFillerTickers(
    getFillerTickerCount({
      availableRem,
      occupiedRem: getTickerRowWidthRem(
        columns.map((column) => tickers[column.key]),
        BOARD_GAP_REM,
      ),
      gapRem: BOARD_GAP_REM,
    }),
  );
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
  fillerTickers,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
  fillerTickers: FillerTickers;
}) {
  const boardGridStyle = getBoardGridStyle(tickers, columns, fillerTickers);

  return (
    <div className="grid items-center gap-3 px-[0.15rem]" style={boardGridStyle}>
      {fillerTickers.left > 0 ? <div aria-hidden="true" /> : null}
      {columns.map((column) => (
        <div
          key={column.key}
          className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--board-header)]"
        >
          {column.label}
        </div>
      ))}
      {fillerTickers.right > 0 ? <div aria-hidden="true" /> : null}
    </div>
  );
}

function BoardGridRow({
  tickers,
  columns,
  row,
  animatedCells,
  animationId,
  fillerTickers,
  switchable = true,
}: {
  tickers: BoardTickers;
  columns: readonly BoardColumn[];
  row?: BoardRow;
  animatedCells?: BoardRowAnimationState;
  animationId?: number | string;
  fillerTickers: FillerTickers;
  switchable?: boolean;
}) {
  const boardGridStyle = getBoardGridStyle(tickers, columns, fillerTickers);

  return (
    <div className="grid items-center gap-3" style={boardGridStyle}>
      {fillerTickers.left > 0 ? (
        <SplitFlapText
          value=""
          length={fillerTickers.left}
          tone="neutral"
          switchable={false}
        />
      ) : null}
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
      {fillerTickers.right > 0 ? (
        <SplitFlapText
          value=""
          length={fillerTickers.right}
          tone="neutral"
          switchable={false}
        />
      ) : null}
    </div>
  );
}

function EmptyRow({
  tickers,
  availableRem,
  compact,
}: {
  tickers: BoardTickers;
  availableRem: number;
  compact: boolean;
}) {
  if (compact) {
    const firstFillerTickers = getBoardFillerTickers({
      tickers,
      columns: COMPACT_BOARD_COLUMNS[0],
      availableRem,
    });
    const secondFillerTickers = getBoardFillerTickers({
      tickers,
      columns: COMPACT_BOARD_COLUMNS[1],
      availableRem,
    });

    return (
      <div className="space-y-2">
        <BoardGridRow
          tickers={tickers}
          columns={COMPACT_BOARD_COLUMNS[0]}
          fillerTickers={firstFillerTickers}
          switchable={false}
        />
        <BoardGridRow
          tickers={tickers}
          columns={COMPACT_BOARD_COLUMNS[1]}
          fillerTickers={secondFillerTickers}
          switchable={false}
        />
      </div>
    );
  }

  return (
    <BoardGridRow
      tickers={tickers}
      columns={BOARD_COLUMNS}
      fillerTickers={getBoardFillerTickers({
        tickers,
        columns: BOARD_COLUMNS,
        availableRem,
      })}
      switchable={false}
    />
  );
}

export function JourneyBoard({
  journey,
  snapshot,
  previousSnapshot,
  layout,
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
  const fullBoardFillerTickers = getBoardFillerTickers({
    tickers: boardTickers,
    columns: BOARD_COLUMNS,
    availableRem: layout.availableRem,
  });
  const firstCompactFillerTickers = getBoardFillerTickers({
    tickers: boardTickers,
    columns: COMPACT_BOARD_COLUMNS[0],
    availableRem: layout.availableRem,
  });
  const secondCompactFillerTickers = getBoardFillerTickers({
    tickers: boardTickers,
    columns: COMPACT_BOARD_COLUMNS[1],
    availableRem: layout.availableRem,
  });
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
                  fillerTickers={firstCompactFillerTickers}
                />
                <BoardHeader
                  tickers={boardTickers}
                  columns={COMPACT_BOARD_COLUMNS[1]}
                  fillerTickers={secondCompactFillerTickers}
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
                      fillerTickers={firstCompactFillerTickers}
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
                      fillerTickers={secondCompactFillerTickers}
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
                    availableRem={layout.availableRem}
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
                fillerTickers={fullBoardFillerTickers}
              />

              <div className="space-y-2">
                {rows.map((row, index) => (
                  <BoardGridRow
                    key={getBoardRowKey(row, fallbackRowKey)}
                    tickers={boardTickers}
                    columns={BOARD_COLUMNS}
                    row={row}
                    animatedCells={animatedRows[index]}
                    fillerTickers={fullBoardFillerTickers}
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
                    availableRem={layout.availableRem}
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
