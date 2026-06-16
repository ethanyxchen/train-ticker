"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { JourneyCommandMenu } from "@/components/journey-command-menu";
import { JourneyBoard } from "@/components/journey-board";
import { NoticeCarousel } from "@/components/notice-carousel";
import { BASE_BOARD_TICKERS } from "@/lib/journeys/board-display";
import {
  resolveBoardLayout,
  type ResolvedBoardLayout,
} from "@/lib/journeys/board-layout";
import { createSavedJourney } from "@/lib/journeys/identity";
import { parseJourneyDefinition } from "@/lib/journeys/schema";
import type {
  JourneyDefinition,
  JourneySnapshot,
  SavedJourney,
} from "@/lib/journeys/types";

const STORAGE_KEY = "train-ticker.journey-definition.v1";
const STORAGE_UPDATE_EVENT = `${STORAGE_KEY}:change`;
const AUTHOR_URL = "https://github.com/ethanyxchen";
const LIVE_DATA_SOURCE_URL =
  "https://raildata.org.uk/dataProduct/P-d81d6eaf-8060-4467-a339-1c833e50cbbe/specification";
const BOARD_PADDING_REM = 2;
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const pollIntervalValue = Number.parseInt(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "",
  10,
);
const POLL_INTERVAL_MS =
  Number.isFinite(pollIntervalValue) && pollIntervalValue > 0
    ? pollIntervalValue
    : DEFAULT_POLL_INTERVAL_MS;

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
    left.availableRem === right.availableRem
  );
}

function toJourneyDefinition(journey: SavedJourney): JourneyDefinition {
  return {
    provider: journey.provider,
    origin: journey.origin,
    destination: journey.destination,
  };
}

function subscribeToStoredJourney(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_UPDATE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_UPDATE_EVENT, onStoreChange);
  };
}

function getStoredJourneySnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerStoredJourneySnapshot() {
  return undefined;
}

function writeStoredJourney(journey: JourneyDefinition | null) {
  if (journey) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journey));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  window.dispatchEvent(new Event(STORAGE_UPDATE_EVENT));
}

function parseStoredJourney(
  storedJourney: string | null | undefined,
): SavedJourney | null | undefined {
  if (storedJourney === undefined) {
    return undefined;
  }

  if (storedJourney === null) {
    return null;
  }

  try {
    return createSavedJourney(parseJourneyDefinition(JSON.parse(storedJourney)));
  } catch {
    return null;
  }
}

export function TrainTickerApp() {
  const storedJourney = useSyncExternalStore(
    subscribeToStoredJourney,
    getStoredJourneySnapshot,
    getServerStoredJourneySnapshot,
  );
  const journey = useMemo(
    () => parseStoredJourney(storedJourney),
    [storedJourney],
  );
  const [previousSnapshot, setPreviousSnapshot] = useState<JourneySnapshot>();
  const [snapshot, setSnapshot] = useState<JourneySnapshot>();
  const [introCycle, setIntroCycle] = useState(0);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardStackRef = useRef<HTMLDivElement | null>(null);
  const journeyRef = useRef(journey);
  const snapshotRef = useRef(snapshot);
  const introAnimationId =
    introCycle > 0 ? introCycle : journey ? `stored:${journey.id}` : undefined;
  const [boardLayout, setBoardLayout] = useState<ResolvedBoardLayout>({
    tickers: BASE_BOARD_TICKERS,
    availableRem: 0,
  });

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (
      storedJourney !== undefined &&
      storedJourney !== null &&
      journey === null
    ) {
      writeStoredJourney(null);
    }
  }, [storedJourney, journey]);

  const refreshJourney = useEffectEvent(async (
    currentJourney: SavedJourney | null | undefined,
  ) => {
    if (!currentJourney) {
      startTransition(() => setPreviousSnapshot(undefined));
      startTransition(() => setSnapshot(undefined));
      setError(null);
      setRefreshing(false);
      return;
    }

    const currentJourneyId = currentJourney.id;

    function isCurrentJourney() {
      return journeyRef.current?.id === currentJourneyId;
    }

    if (!isCurrentJourney()) {
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
        body: JSON.stringify({ journey: toJourneyDefinition(currentJourney) }),
      });

      if (!response.ok) {
        throw new Error("Could not refresh live journey.");
      }

      const data = (await response.json()) as { snapshot: JourneySnapshot };
      const nextSnapshot = data.snapshot;

      if (!nextSnapshot || nextSnapshot.journeyId !== currentJourneyId) {
        throw new Error("Could not refresh live journey.");
      }

      if (!isCurrentJourney()) {
        return;
      }

      startTransition(() => {
        setPreviousSnapshot(snapshotRef.current);
        setSnapshot(nextSnapshot);
      });
    } catch (refreshError) {
      if (isCurrentJourney()) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Could not refresh live journey.",
        );
      }
    } finally {
      if (isCurrentJourney()) {
        setRefreshing(false);
      }
    }
  });

  useEffect(() => {
    if (journey === undefined) {
      return;
    }

    queueMicrotask(() => {
      void refreshJourney(journey);
    });

    const intervalId = window.setInterval(() => {
      void refreshJourney(journeyRef.current);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [journey]);

  useEffect(() => {
    function openCommandMenu(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandMenuOpen(true);
      }
    }

    window.addEventListener("keydown", openCommandMenu);

    return () => window.removeEventListener("keydown", openCommandMenu);
  }, []);

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
    <main className="relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-black px-3 pb-20 pt-3 sm:px-5 sm:pb-16 sm:pt-5">
      {error ? (
        <div className="absolute left-3 top-3 z-10 max-w-[min(32rem,calc(100vw-1.5rem))] rounded-md border border-[rgba(236,138,109,0.34)] bg-[rgba(0,0,0,0.72)] px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--bad)] sm:left-5 sm:top-5">
          {error}
        </div>
      ) : null}

      <NoticeCarousel notices={snapshot?.alerts ?? []} />

      <div
        className="flex min-h-0 w-full flex-1 items-center"
        ref={boardStackRef}
      >
        {journey ? (
          <JourneyBoard
            key={journey.id}
            journey={journey}
            snapshot={snapshot}
            previousSnapshot={previousSnapshot}
            layout={boardLayout}
            refreshing={refreshing}
            introAnimationId={introAnimationId}
          />
        ) : null}
      </div>

      <footer className="absolute bottom-4 left-0 right-0 z-10 flex flex-col items-center gap-1.5 px-3 text-center text-[0.64rem] uppercase leading-relaxed tracking-[0.12em] text-[rgba(247,244,238,0.42)] sm:bottom-6 sm:text-[0.72rem]">
        <div>
          <span aria-label="Command key" role="img">
            &#8984;
          </span>{" "}
          + K to search for a journey
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>
            By{" "}
            <a
              className="text-[rgba(247,244,238,0.68)] underline decoration-[rgba(223,186,75,0.56)] underline-offset-4 transition-colors hover:text-[var(--accent)] focus:outline-none focus-visible:text-[var(--accent)]"
              href={AUTHOR_URL}
              rel="noreferrer"
              target="_blank"
            >
              Ethan Chen
            </a>
          </span>
          <span aria-hidden="true">|</span>
          <span>
            Live data from{" "}
            <a
              className="text-[rgba(247,244,238,0.68)] underline decoration-[rgba(223,186,75,0.56)] underline-offset-4 transition-colors hover:text-[var(--accent)] focus:outline-none focus-visible:text-[var(--accent)]"
              href={LIVE_DATA_SOURCE_URL}
              rel="noreferrer"
              target="_blank"
            >
              Rail Data Marketplace
            </a>
          </span>
        </div>
      </footer>

      <JourneyCommandMenu
        currentJourney={journey ?? null}
        open={journey === null || (journey !== undefined && commandMenuOpen)}
        onClose={() => setCommandMenuOpen(false)}
        onSelectJourney={(definition) => {
          const nextJourney = createSavedJourney(definition);

          journeyRef.current = nextJourney;
          snapshotRef.current = undefined;
          writeStoredJourney(toJourneyDefinition(nextJourney));
          setIntroCycle((currentIntroCycle) => currentIntroCycle + 1);
          startTransition(() => {
            setPreviousSnapshot(undefined);
            setSnapshot(undefined);
          });
        }}
      />
    </main>
  );
}
