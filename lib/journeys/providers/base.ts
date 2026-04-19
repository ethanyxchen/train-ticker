import type {
  JourneySearchResult,
  JourneySnapshot,
  JourneyProviderId,
  SavedJourney,
} from "@/lib/journeys/types";

export interface JourneyProvider {
  id: JourneyProviderId;
  search(query: string): Promise<JourneySearchResult[]>;
  getSnapshot(journey: SavedJourney): Promise<JourneySnapshot>;
}
