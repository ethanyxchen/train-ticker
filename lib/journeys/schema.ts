import type {
  JourneyDefinition,
  JourneyLocation,
  JourneyProviderId,
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

export function parseJourneyDefinition(value: unknown): JourneyDefinition {
  if (
    !isObject(value) ||
    !isJourneyProviderId(value.provider) ||
    !isLocation(value.origin) ||
    !isLocation(value.destination)
  ) {
    throw new Error("Invalid journey.");
  }

  return {
    provider: value.provider,
    origin: value.origin,
    destination: value.destination,
  };
}
