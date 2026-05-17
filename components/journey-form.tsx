"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";

import type {
  JourneyDefinition,
  JourneyLocation,
  JourneySearchResult,
} from "@/lib/journeys/types";

interface JourneyFormProps {
  onAddJourney: (journey: JourneyDefinition) => void;
}

interface SearchFieldProps {
  ariaLabel: string;
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

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value?.id, value?.label]);

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();

    if (!isOpen || trimmedQuery.length < 2) {
      setResults([]);
      setActiveIndex(null);
      setError(null);
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
        console.info("[journey-search]", {
          query: trimmedQuery,
          resultCount: data.results.length,
          results: data.results,
        });
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
  }, [deferredQuery, isOpen]);

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      currentIndex !== null && currentIndex < results.length ? currentIndex : null,
    );
  }, [results]);

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
          activeIndex === null ? undefined : `${listboxId}-option-${activeIndex}`
        }
        aria-autocomplete="list"
        aria-controls={results.length > 0 ? listboxId : undefined}
        aria-expanded={isOpen && results.length > 0}
        aria-haspopup="listbox"
        autoComplete="off"
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
            if (results.length === 0) {
              return;
            }

            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((currentIndex) =>
              getNextSearchResultIndex(currentIndex, key, results.length),
            );
            return;
          }

          if (key === "Enter" && activeIndex !== null) {
            const result = results[activeIndex];

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
        className="h-11 w-full rounded-[0.9rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--paper)] outline-none transition placeholder:text-[rgba(247,244,238,0.5)] focus:border-[var(--board-header)]"
      />

      {isOpen && (results.length > 0 || error) ? (
        <div
          className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[1rem] border border-[rgba(255,255,255,0.08)] bg-[#191a1d] shadow-[0_18px_35px_rgba(0,0,0,0.32)]"
          id={results.length > 0 ? listboxId : undefined}
          role={results.length > 0 ? "listbox" : undefined}
        >
          {error ? (
            <div className="px-4 py-3 text-sm text-[var(--bad)]">{error}</div>
          ) : null}
          {results.map((result, index) => (
            <button
              key={`${ariaLabel}-${result.id}`}
              type="button"
              aria-selected={activeIndex === index}
              id={`${listboxId}-option-${index}`}
              onMouseDown={() => selectResult(result)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              className={`flex w-full flex-col gap-1 border-t border-[rgba(255,255,255,0.06)] px-4 py-3 text-left first:border-t-0 ${
                activeIndex === index
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

export function JourneyForm({ onAddJourney }: JourneyFormProps) {
  const [origin, setOrigin] = useState<JourneyLocation | null>(null);
  const [destination, setDestination] = useState<JourneyLocation | null>(null);

  const canSubmit = Boolean(origin && destination && origin.id !== destination.id);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (!origin || !destination || origin.id === destination.id) {
          return;
        }

        onAddJourney({
          provider: "national-rail",
          origin,
          destination,
        });

        setOrigin(null);
        setDestination(null);
      }}
      className="rounded-[1.25rem] border border-[rgba(17,18,20,0.12)] bg-[#1c1d20] p-2 shadow-[0_14px_40px_rgba(0,0,0,0.16)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <LocationSearchField
          ariaLabel="Origin"
          value={origin}
          onSelect={setOrigin}
          placeholder="Origin: St Pancras or STP"
        />

        <div className="hidden h-11 items-center px-1 text-[0.9rem] uppercase tracking-[0.16em] text-[var(--board-header)] sm:flex">
          To
        </div>

        <LocationSearchField
          ariaLabel="Destination"
          value={destination}
          onSelect={setDestination}
          placeholder="Destination: Leicester or LEI"
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-11 rounded-[0.9rem] bg-[var(--board-header)] px-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#17181a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[rgba(255,255,255,0.08)] disabled:text-[rgba(247,244,238,0.45)]"
        >
          Add
        </button>
      </div>
    </form>
  );
}
