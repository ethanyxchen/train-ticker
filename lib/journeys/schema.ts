import type {
  JourneyLocation,
  JourneyProviderId,
  SavedJourney,
} from "@/lib/journeys/types";

const PROVIDERS = new Set<JourneyProviderId>(["national-rail"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLocation(value: unknown): value is JourneyLocation {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.label) &&
    (value.secondaryLabel === undefined || typeof value.secondaryLabel === "string")
  );
}

export function isJourneyProviderId(value: unknown): value is JourneyProviderId {
  return typeof value === "string" && PROVIDERS.has(value as JourneyProviderId);
}

export function parseSavedJourneys(value: unknown): SavedJourney[] {
  if (!Array.isArray(value)) {
    throw new Error("Journeys payload must be an array.");
  }

  return value.map((item) => {
    if (
      !isObject(item) ||
      !isString(item.id) ||
      !isString(item.name) ||
      !isJourneyProviderId(item.provider) ||
      !isLocation(item.origin) ||
      !isLocation(item.destination)
    ) {
      throw new Error("Journeys payload contained an invalid entry.");
    }

    return {
      id: item.id,
      name: item.name,
      provider: item.provider,
      origin: item.origin,
      destination: item.destination,
    };
  });
}
