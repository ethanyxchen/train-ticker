"use client";

import { useDeferredValue, useEffect, useState } from "react";

import type {
  JourneyLocation,
  JourneyProviderId,
  JourneySearchResult,
  SavedJourney,
} from "@/lib/journeys/types";

interface JourneyFormProps {
  onAddJourney: (journey: Omit<SavedJourney, "id">) => void;
}

interface SearchFieldProps {
  ariaLabel: string;
  provider: JourneyProviderId;
  placeholder: string;
  value: JourneyLocation | null;
  onSelect: (location: JourneyLocation | null) => void;
}

function LocationSearchField({
  ariaLabel,
  provider,
  placeholder,
  value,
  onSelect,
}: SearchFieldProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<JourneySearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [provider, value?.id, value?.label]);

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();

    if (!isOpen || trimmedQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const abortController = new AbortController();

    async function loadResults() {
      try {
        setError(null);
        const response = await fetch(
          `/api/search?provider=${provider}&q=${encodeURIComponent(trimmedQuery)}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error("Search failed.");
        }

        const data = (await response.json()) as { results: JourneySearchResult[] };
        setResults(data.results);
      } catch (fetchError) {
        if (!abortController.signal.aborted) {
          setError(
            fetchError instanceof Error ? fetchError.message : "Search failed.",
          );
        }
      }
    }

    void loadResults();

    return () => abortController.abort();
  }, [deferredQuery, isOpen, provider]);

  return (
    <div className="relative min-w-[12rem] flex-1">
      <input
        aria-label={ariaLabel}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 140);
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-[0.9rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--paper)] outline-none transition placeholder:text-[rgba(247,244,238,0.5)] focus:border-[var(--board-header)]"
      />

      {isOpen && (results.length > 0 || error) ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[1rem] border border-[rgba(255,255,255,0.08)] bg-[#191a1d] shadow-[0_18px_35px_rgba(0,0,0,0.32)]">
          {error ? (
            <div className="px-4 py-3 text-sm text-[var(--bad)]">{error}</div>
          ) : null}
          {results.map((result) => (
            <button
              key={`${ariaLabel}-${result.id}`}
              type="button"
              onMouseDown={() => {
                onSelect({
                  id: result.id,
                  label: result.label,
                  secondaryLabel: result.secondaryLabel,
                });
                setQuery(result.label);
                setIsOpen(false);
              }}
              className="flex w-full flex-col gap-1 border-t border-[rgba(255,255,255,0.06)] px-4 py-3 text-left first:border-t-0 hover:bg-[rgba(255,255,255,0.04)]"
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
  const provider: JourneyProviderId = "national-rail";
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
          provider,
          name: `${origin.label} to ${destination.label}`,
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
          provider={provider}
          value={origin}
          onSelect={setOrigin}
          placeholder="Origin: St Pancras or STP"
        />

        <div className="hidden h-11 items-center px-1 text-[0.9rem] uppercase tracking-[0.16em] text-[var(--board-header)] sm:flex">
          To
        </div>

        <LocationSearchField
          ariaLabel="Destination"
          provider={provider}
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
