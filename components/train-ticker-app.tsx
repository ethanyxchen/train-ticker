"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { JourneyBoard } from "@/components/journey-board";
import { JourneyForm } from "@/components/journey-form";
import { BASE_BOARD_TICKERS } from "@/lib/journeys/board-display";
import {
  resolveBoardLayout,
  type ResolvedBoardLayout,
} from "@/lib/journeys/board-layout";
import {
  createSavedJourney,
  normalizeSavedJourneys,
} from "@/lib/journeys/identity";
import type { JourneySnapshot, SavedJourney } from "@/lib/journeys/types";

const STORAGE_KEY = "train-ticker.saved-journeys.v1";
const BOARD_GAP_REM = 0.75;
const BOARD_PADDING_REM = 2;
const FIXED_WINDOW_HOURS = 1;

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

function toTimeInputValue(date: Date) {
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

function toWindowStartAt(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const parsed = new Date(year, (month ?? 1) - 1, day, hours ?? 0, minutes ?? 0, 0, 0);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function toSnapshotMap(items: JourneySnapshot[]): Record<string, JourneySnapshot> {
  return Object.fromEntries(items.map((snapshot) => [snapshot.journeyId, snapshot]));
}

function hasSameBoardLayout(
  left: ResolvedBoardLayout,
  right: ResolvedBoardLayout,
) {
  return (
    left.tickers.time === right.tickers.time &&
    left.tickers.origin === right.tickers.origin &&
    left.tickers.destination === right.tickers.destination &&
    left.tickers.operator === right.tickers.operator &&
    left.tickers.platform === right.tickers.platform &&
    left.tickers.status === right.tickers.status &&
    left.insetRem === right.insetRem
  );
}

export function TrainTickerApp() {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, JourneySnapshot>>({});
  const [introCycles, setIntroCycles] = useState<Record<string, number>>({});
  const timeWindowHours = FIXED_WINDOW_HOURS;
  const [windowDate, setWindowDate] = useState(() => toDateInputValue(new Date()));
  const [windowTime, setWindowTime] = useState(() => toTimeInputValue(new Date()));
  const windowStartAt = useMemo(
    () => toWindowStartAt(windowDate, windowTime),
    [windowDate, windowTime],
  );
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardStackRef = useRef<HTMLDivElement | null>(null);
  const [boardLayout, setBoardLayout] = useState<ResolvedBoardLayout>({
    tickers: BASE_BOARD_TICKERS,
    insetRem: 0,
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SavedJourney[];
        setJourneys(normalizeSavedJourneys(parsed));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
  }, [hydrated, journeys]);

  const refreshJourneys = useCallback(
    async (currentJourneys = journeys) => {
      if (!currentJourneys.length) {
        startTransition(() => setSnapshots({}));
        setError(null);
        return;
      }

      try {
        setRefreshing(true);
        setError(null);

        const response = await fetch("/api/journeys", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            journeys: currentJourneys,
            timeWindowHours,
            windowStartAt,
          }),
        });

        if (!response.ok) {
          throw new Error("Could not refresh live journeys.");
        }

        const data = (await response.json()) as { snapshots: JourneySnapshot[] };
        startTransition(() => {
          setSnapshots(toSnapshotMap(data.snapshots));
        });
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Could not refresh live journeys.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [journeys, timeWindowHours, windowStartAt],
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void refreshJourneys(journeys);

    const intervalId = window.setInterval(() => {
      void refreshJourneys(journeys);
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [hydrated, journeys, refreshJourneys]);

  useEffect(() => {
    const boardStackElement = boardStackRef.current;

    if (!boardStackElement) {
      return;
    }

    function updateBoardLayout() {
      const nextBoardStackElement = boardStackRef.current;

      if (!nextBoardStackElement) {
        return;
      }

      const rootFontSize =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const nextBoardLayout = resolveBoardLayout({
        availableRem: Math.max(
          nextBoardStackElement.clientWidth / rootFontSize - BOARD_PADDING_REM,
          0,
        ),
        baseTickers: BASE_BOARD_TICKERS,
        gapRem: BOARD_GAP_REM,
      });

      setBoardLayout((currentBoardLayout) =>
        hasSameBoardLayout(currentBoardLayout, nextBoardLayout)
          ? currentBoardLayout
          : nextBoardLayout,
      );
    }

    updateBoardLayout();

    const resizeObserver = new ResizeObserver(() => {
      updateBoardLayout();
    });

    resizeObserver.observe(boardStackElement);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <main className="flex w-full flex-1 flex-col gap-3 px-3 py-5 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-[1100px]">
        <JourneyForm
          onAddJourney={(journey) => {
            const nextJourney = createSavedJourney(journey);

            if (journeys.some((item) => item.id === nextJourney.id)) {
              return;
            }

            setIntroCycles((currentIntroCycles) => ({
              ...currentIntroCycles,
              [nextJourney.id]: (currentIntroCycles[nextJourney.id] ?? 0) + 1,
            }));
            setJourneys((currentJourneys) => [...currentJourneys, nextJourney]);
          }}
        />
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-[1100px] px-1 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--bad)]">
          {error}
        </div>
      ) : null}

      {journeys.length > 0 ? (
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-end gap-3 px-1">
          <label className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(21,22,24,0.62)]">
            Date
            <input
              type="date"
              value={windowDate}
              onChange={(event) => setWindowDate(event.target.value)}
              className="h-8 rounded-[0.45rem] border border-[rgba(17,18,20,0.2)] bg-[linear-gradient(180deg,#f4efe7,#e2dbcf)] px-2 text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(21,22,24,0.88)]"
            />
          </label>
          <label className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(21,22,24,0.62)]">
            Time
            <input
              type="time"
              value={windowTime}
              onChange={(event) => setWindowTime(event.target.value)}
              className="h-8 rounded-[0.45rem] border border-[rgba(17,18,20,0.2)] bg-[linear-gradient(180deg,#f4efe7,#e2dbcf)] px-2 text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(21,22,24,0.88)]"
            />
          </label>
          <div className="text-[0.68rem] uppercase tracking-[0.12em] text-[rgba(21,22,24,0.62)]">
            Window: next {timeWindowHours} hour{timeWindowHours === 1 ? "" : "s"}
          </div>
        </div>
      ) : null}

      <div className="w-full space-y-3" ref={boardStackRef}>
        {journeys.map((journey) => (
          <JourneyBoard
            key={journey.id}
            journey={journey}
            snapshot={snapshots[journey.id]}
            layout={boardLayout}
            refreshing={refreshing}
            introCycle={introCycles[journey.id]}
            onRemove={() => {
              setJourneys((currentJourneys) =>
                currentJourneys.filter((item) => item.id !== journey.id),
              );
              setIntroCycles((currentIntroCycles) => {
                const nextIntroCycles = { ...currentIntroCycles };
                delete nextIntroCycles[journey.id];
                return nextIntroCycles;
              });
              startTransition(() => {
                setSnapshots((currentSnapshots) => {
                  const nextSnapshots = { ...currentSnapshots };
                  delete nextSnapshots[journey.id];
                  return nextSnapshots;
                });
              });
            }}
          />
        ))}
      </div>
    </main>
  );
}
