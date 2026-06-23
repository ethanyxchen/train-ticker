"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";

import type {
  JourneyDefinition,
  JourneyLocation,
  JourneySearchResult,
  SavedJourney,
} from "@/lib/journeys/types";

interface JourneyCommandMenuProps {
  currentJourney: SavedJourney | null;
  open: boolean;
  onClose: () => void;
  onSelectJourney: (journey: JourneyDefinition) => void;
}

interface SearchFieldProps {
  ariaLabel: string;
  autoFocus?: boolean;
  placeholder: string;
  value: JourneyLocation | null;
  onSelect: (location: JourneyLocation | null) => void;
}

type SearchNavigationKey = "ArrowDown" | "ArrowUp";

export function getNextSearchResultIndex(
  currentIndex: number | null,
  key: SearchNavigationKey,
  resultCount: number,
) {
  if (resultCount === 0) {
    return null;
  }

  if (key === "ArrowDown") {
    return currentIndex === null ? 0 : Math.min(currentIndex + 1, resultCount - 1);
  }

  return currentIndex === null ? resultCount - 1 : Math.max(currentIndex - 1, 0);
}

function LocationSearchField({
  ariaLabel,
  autoFocus,
  placeholder,
  value,
  onSelect,
}: SearchFieldProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<JourneySearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const listboxId = useId();
  const trimmedQuery = deferredQuery.trim();
  const isSearchActive = isOpen && trimmedQuery.length >= 2;
  const visibleResults = isSearchActive ? results : [];
  const visibleError = isSearchActive ? error : null;
  const visibleActiveIndex =
    activeIndex !== null && activeIndex < visibleResults.length ? activeIndex : null;

  useEffect(() => {
    if (!isSearchActive) {
      return;
    }

    const abortController = new AbortController();

    async function loadResults() {
      try {
        setError(null);
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error("Search failed.");
        }

        const data = (await response.json()) as { results: JourneySearchResult[] };
        setResults(data.results);
      } catch (fetchError) {
        if (!abortController.signal.aborted) {
          console.error("[journey-search]", {
            query: trimmedQuery,
            error: fetchError instanceof Error ? fetchError.message : fetchError,
          });
          setError(
            fetchError instanceof Error ? fetchError.message : "Search failed.",
          );
        }
      }
    }

    void loadResults();

    return () => abortController.abort();
  }, [isSearchActive, trimmedQuery]);

  function closeResults() {
    setIsOpen(false);
    setActiveIndex(null);
  }

  function selectResult(result: JourneySearchResult) {
    onSelect({
      id: result.id,
      label: result.label,
      secondaryLabel: result.secondaryLabel,
    });
    setQuery(result.label);
    closeResults();
  }

  return (
    <div className="relative min-w-[12rem] flex-1">
      <input
        aria-label={ariaLabel}
        aria-activedescendant={
          visibleActiveIndex === null
            ? undefined
            : `${listboxId}-option-${visibleActiveIndex}`
        }
        aria-autocomplete="list"
        aria-controls={visibleResults.length > 0 ? listboxId : undefined}
        aria-expanded={isOpen && visibleResults.length > 0}
        aria-haspopup="listbox"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setActiveIndex(null);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          const { key } = event;

          if (key === "Escape") {
            if (isOpen) {
              event.preventDefault();
              closeResults();
            }

            return;
          }

          if (key === "ArrowDown" || key === "ArrowUp") {
            if (visibleResults.length === 0) {
              return;
            }

            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((currentIndex) =>
              getNextSearchResultIndex(currentIndex, key, visibleResults.length),
            );
            return;
          }

          if (key === "Enter" && visibleActiveIndex !== null) {
            const result = visibleResults[visibleActiveIndex];

            if (!result) {
              return;
            }

            event.preventDefault();
            selectResult(result);
          }
        }}
        onBlur={() => {
          window.setTimeout(closeResults, 140);
        }}
        placeholder={placeholder}
        role="combobox"
        className="h-12 w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-4 text-base text-[var(--paper)] outline-none transition-[border-color,background-color] duration-150 ease-out placeholder:text-[rgba(247,244,238,0.46)] focus:border-[var(--board-header)]"
      />

      {isOpen && (visibleResults.length > 0 || visibleError) ? (
        <div
          className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#191a1d] shadow-[0_18px_35px_rgba(0,0,0,0.32)]"
          id={visibleResults.length > 0 ? listboxId : undefined}
          role={visibleResults.length > 0 ? "listbox" : undefined}
        >
          {visibleError ? (
            <div className="px-4 py-3 text-sm text-[var(--bad)]">{visibleError}</div>
          ) : null}
          {visibleResults.map((result, index) => (
            <button
              key={`${ariaLabel}-${result.id}`}
              type="button"
              aria-selected={visibleActiveIndex === index}
              id={`${listboxId}-option-${index}`}
              tabIndex={-1}
              onMouseDown={(event) => {
                event.preventDefault();
                selectResult(result);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              className={`flex min-h-12 w-full flex-col gap-1 border-t border-[rgba(255,255,255,0.06)] px-4 py-3 text-left transition-colors duration-150 ease-out first:border-t-0 ${
                visibleActiveIndex === index
                  ? "bg-[rgba(255,255,255,0.06)]"
                  : "hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              <span className="text-sm text-[var(--paper)]">{result.label}</span>
              <span className="text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(247,244,238,0.58)]">
                {result.id}
                {result.secondaryLabel ? ` · ${result.secondaryLabel}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function JourneyCommandMenu({
  currentJourney,
  open,
  onClose,
  onSelectJourney,
}: JourneyCommandMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <JourneyCommandMenuForm
      key={currentJourney?.id ?? "empty"}
      currentJourney={currentJourney}
      onClose={onClose}
      onSelectJourney={onSelectJourney}
    />
  );
}

function JourneyCommandMenuForm({
  currentJourney,
  onClose,
  onSelectJourney,
}: Omit<JourneyCommandMenuProps, "open">) {
  const [origin, setOrigin] = useState<JourneyLocation | null>(
    currentJourney?.origin ?? null,
  );
  const [destination, setDestination] = useState<JourneyLocation | null>(
    currentJourney?.destination ?? null,
  );
  const canClose = currentJourney !== null;
  const canSubmit = Boolean(origin && destination && origin.id !== destination.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/72 px-3 py-[12vh] backdrop-blur-sm sm:px-6"
      onMouseDown={(event) => {
        if (canClose && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        aria-label="Journey search"
        aria-modal="true"
        role="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && canClose && !event.defaultPrevented) {
            event.preventDefault();
            onClose();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();

          if (!origin || !destination || origin.id === destination.id) {
            return;
          }

          onSelectJourney({
            provider: "national-rail",
            origin,
            destination,
          });
          onClose();
        }}
        className="w-full max-w-[44rem] overflow-visible rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#111214] shadow-[0_30px_80px_rgba(0,0,0,0.46)]"
      >
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--board-header)]">
              Journey
            </div>
            <h2 className="text-lg text-[var(--paper)]">Find a train board</h2>
          </div>
          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-md border border-[rgba(255,255,255,0.1)] px-3 text-sm text-[rgba(247,244,238,0.72)] transition-[scale,border-color,color] duration-150 ease-out hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--paper)] active:scale-[0.96] focus:outline-none focus-visible:border-[var(--board-header)] focus-visible:text-[var(--paper)]"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          <LocationSearchField
            ariaLabel="Origin"
            autoFocus
            value={origin}
            onSelect={setOrigin}
            placeholder="Origin: St Pancras or STP"
          />

          <LocationSearchField
            ariaLabel="Destination"
            value={destination}
            onSelect={setDestination}
            placeholder="Destination: Leicester or LEI"
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full rounded-lg bg-[var(--board-header)] px-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#111214] transition-[scale,filter,background-color,color] duration-150 ease-out hover:brightness-105 active:scale-[0.96] focus:outline-none focus-visible:brightness-110 disabled:cursor-not-allowed disabled:bg-[rgba(255,255,255,0.08)] disabled:text-[rgba(247,244,238,0.42)] disabled:hover:brightness-100 disabled:active:scale-100"
          >
            Open board
          </button>
        </div>
      </form>
    </div>
  );
}
