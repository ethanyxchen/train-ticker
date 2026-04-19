import {
  appendSearchParams,
  dedupeText,
  fetchJson,
  formatBoardValue,
  formatIsoTime,
  formatPence,
  stripHtml,
} from "@/lib/journeys/provider-utils";
import { JOURNEY_BOARD_ROW_COUNT } from "@/lib/journeys/constants";
import type { JourneyProvider } from "@/lib/journeys/providers/base";
import type { JourneySearchResult } from "@/lib/journeys/types";

interface TflStopPointSearchResult {
  id: string;
  name: string;
  modes?: string[];
}

interface TflStopPointSearchResponse {
  matches?: TflStopPointSearchResult[];
}

interface TflRouteOption {
  name?: string;
}

interface TflIdentifier {
  name?: string;
}

interface TflPoint {
  commonName?: string;
}

interface TflDisruption {
  description?: string;
}

interface TflLeg {
  duration?: number;
  instruction?: {
    summary?: string;
  };
  departureTime?: string;
  arrivalTime?: string;
  departurePoint?: TflPoint;
  arrivalPoint?: TflPoint;
  routeOptions?: TflRouteOption[];
  mode?: TflIdentifier;
  disruptions?: TflDisruption[];
  plannedWorks?: Array<{
    description?: string;
  }>;
}

interface TflJourney {
  startDateTime?: string;
  arrivalDateTime?: string;
  duration?: number;
  legs?: TflLeg[];
  fare?: {
    totalCost?: number;
  };
}

interface TflLine {
  id?: string;
  name?: string;
  lineStatuses?: Array<{
    statusSeverityDescription?: string;
    reason?: string;
  }>;
}

interface TflJourneyResponse {
  journeys?: TflJourney[];
  lines?: TflLine[];
  stopMessages?: string[];
}

function addTflCredentials(url: string): string {
  return appendSearchParams(url, {
    app_id: process.env.TFL_APP_ID,
    app_key: process.env.TFL_APP_KEY,
  });
}

function lineStatusSummary(lines: TflLine[]): string {
  if (lines.length === 0) {
    return "BOARD";
  }

  const firstProblem = lines.find((line) => {
    return (
      line.lineStatuses?.some(
        (status) => status.statusSeverityDescription !== "Good Service",
      ) ?? false
    );
  });

  if (firstProblem) {
    return (
      firstProblem.lineStatuses?.find(
        (status) => status.statusSeverityDescription !== "Good Service",
      )?.statusSeverityDescription ?? "ISSUES"
    );
  }

  return "GOOD";
}

function pickTubeStatus(lines: TflLine[], journeys: TflJourney[]) {
  if (journeys.length === 0) {
    return "warning" as const;
  }

  const hasLineProblems = lines.some((line) => {
    return (
      line.lineStatuses?.some(
        (status) => status.statusSeverityDescription !== "Good Service",
      ) ?? false
    );
  });

  return hasLineProblems ? ("warning" as const) : ("ok" as const);
}

export const tflTubeProvider: JourneyProvider = {
  id: "tfl-tube",
  async search(query) {
    const requestUrl = addTflCredentials(
      appendSearchParams(
        `https://api.tfl.gov.uk/StopPoint/Search/${encodeURIComponent(query.trim())}`,
        {
          modes: "tube",
          includeHubs: false,
          maxResults: 8,
        },
      ),
    );

    const data = await fetchJson<TflStopPointSearchResponse>(requestUrl);

    return (data.matches ?? []).map<JourneySearchResult>((match) => ({
      id: match.id,
      label: match.name,
      secondaryLabel: "London Underground",
      provider: "tfl-tube",
    }));
  },
  async getSnapshot(journey) {
    const requestUrl = addTflCredentials(
      appendSearchParams(
        `https://api.tfl.gov.uk/Journey/JourneyResults/${encodeURIComponent(journey.origin.id)}/to/${encodeURIComponent(journey.destination.id)}`,
        {
          mode: "tube",
          includeAlternativeRoutes: true,
          journeyPreference: "LeastTime",
          useRealTimeLiveArrivals: true,
        },
      ),
    );

    const result = await fetchJson<TflJourneyResponse>(requestUrl);
    const journeys = result.journeys ?? [];
    const lines = result.lines ?? [];
    const firstJourney = journeys[0];
    const firstTubeLeg = firstJourney?.legs?.find((leg) => leg.mode?.name === "tube");

    const alerts = dedupeText([
      ...(result.stopMessages ?? []).map(stripHtml),
      ...lines.flatMap((line) =>
        (line.lineStatuses ?? []).map((status) =>
          stripHtml(status.reason ?? status.statusSeverityDescription),
        ),
      ),
      ...journeys.flatMap((candidate) =>
        (candidate.legs ?? []).flatMap((leg) => [
          ...(leg.disruptions ?? []).map((disruption) => stripHtml(disruption.description)),
          ...(leg.plannedWorks ?? []).map((plannedWork) =>
            stripHtml(plannedWork.description),
          ),
        ]),
      ),
    ]);

    const lineNames = dedupeText(
      (firstJourney?.legs ?? [])
        .filter((leg) => leg.mode?.name === "tube")
        .map((leg) => leg.routeOptions?.[0]?.name),
    );

    return {
      journeyId: journey.id,
      provider: "tfl-tube",
      status: pickTubeStatus(lines, journeys),
      headline:
        journeys.length > 0
          ? `${firstJourney.duration ?? "--"} minute Tube journey`
          : "No Tube journeys returned",
      subheadline:
        journeys.length > 0
          ? lineNames.join(" / ") || firstTubeLeg?.instruction?.summary || "Live route available"
          : `No routes returned for ${journey.origin.label} to ${journey.destination.label}`,
      refreshedAt: new Date().toISOString(),
      boardFields: [
        {
          label: "DEP",
          value: formatIsoTime(firstJourney?.startDateTime ?? firstTubeLeg?.departureTime),
          tone: "neutral",
        },
        {
          label: "ARR",
          value: formatIsoTime(firstJourney?.arrivalDateTime ?? firstTubeLeg?.arrivalTime),
          tone: "neutral",
        },
        {
          label: "DUR",
          value:
            typeof firstJourney?.duration === "number"
              ? `${firstJourney.duration} MIN`
              : "--",
          tone: "neutral",
        },
        {
          label: "LINE",
          value: formatBoardValue(lineNames.join(" / "), "--"),
          tone: "good",
        },
        {
          label: "STAT",
          value: lineStatusSummary(lines),
          tone: lineStatusSummary(lines) === "GOOD" ? "good" : "warn",
        },
      ],
      options: journeys
        .slice(0, JOURNEY_BOARD_ROW_COUNT)
        .map((candidate, index) => {
          const mainLeg = candidate.legs?.find((leg) => leg.mode?.name === "tube");
          const interchangeCount = Math.max(
            0,
            (candidate.legs ?? []).filter((leg) => leg.mode?.name === "tube").length - 1,
          );

          return {
            id: `${journey.id}-${index}`,
            title:
              mainLeg?.instruction?.summary ??
              `${journey.origin.label} to ${journey.destination.label}`,
            scheduledDeparture: formatIsoTime(
              candidate.startDateTime ?? mainLeg?.departureTime,
            ),
            expectedDeparture: formatIsoTime(
              candidate.startDateTime ?? mainLeg?.departureTime,
            ),
            scheduledArrival: formatIsoTime(
              candidate.arrivalDateTime ?? mainLeg?.arrivalTime,
            ),
            expectedArrival: formatIsoTime(
              candidate.arrivalDateTime ?? mainLeg?.arrivalTime,
            ),
            durationMinutes: candidate.duration,
            operator: lineNames.join(", ") || "London Underground",
            note: dedupeText([
              mainLeg?.departurePoint?.commonName,
              mainLeg?.arrivalPoint?.commonName,
              typeof candidate.fare?.totalCost === "number"
                ? `${formatPence(candidate.fare.totalCost)} fare`
                : undefined,
              interchangeCount > 0 ? `${interchangeCount} change` : "Direct",
            ]).join(" · "),
          };
        }),
      alerts,
    };
  },
};
