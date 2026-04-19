import type {
  JourneyDefinition,
  SavedJourney,
} from "@/lib/journeys/types";

function normalizeLocationId(id: string) {
  return id.trim().toLowerCase();
}

export function getJourneyId(journey: JourneyDefinition) {
  return [
    journey.provider,
    normalizeLocationId(journey.origin.id),
    normalizeLocationId(journey.destination.id),
  ].join(":");
}

function getJourneyName(journey: Pick<SavedJourney, "origin" | "destination">) {
  return `${journey.origin.label} to ${journey.destination.label}`;
}

export function createSavedJourney(journey: JourneyDefinition): SavedJourney {
  return {
    ...journey,
    id: getJourneyId(journey),
    name: getJourneyName(journey),
  };
}

export function normalizeSavedJourneys(journeys: SavedJourney[]) {
  const uniqueJourneys = new Map<string, SavedJourney>();

  for (const journey of journeys) {
    const normalizedJourney = createSavedJourney(journey);

    if (!uniqueJourneys.has(normalizedJourney.id)) {
      uniqueJourneys.set(normalizedJourney.id, normalizedJourney);
    }
  }

  return Array.from(uniqueJourneys.values());
}
