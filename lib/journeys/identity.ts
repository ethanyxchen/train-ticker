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
