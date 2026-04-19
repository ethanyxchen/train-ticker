interface RailRequestConnection {
  proxyUrl: string;
}

interface RailRequestJourney {
  origin: {
    id: string;
  };
  destination: {
    id: string;
  };
}

function replacePathPlaceholders(url: string, journey: RailRequestJourney): string {
  const origin = journey.origin.id.toUpperCase();
  const destination = journey.destination.id.toUpperCase();

  return url.replace(/\{([^}]+)\}/g, (_, rawKey: string) => {
    switch (rawKey.trim().toLowerCase()) {
      case "crs":
      case "origin":
      case "from":
        return origin;
      case "filtercrs":
      case "filterlist":
      case "destination":
      case "to":
        return destination;
      default:
        return origin;
    }
  });
}

function normalizeRailProxyUrl(url: string): string {
  const trimmed = url.replace(/\/$/, "");

  if (/GetDepartureBoard/i.test(trimmed)) {
    return trimmed.replace(/GetDepartureBoard/gi, "GetDepBoardWithDetails");
  }

  return trimmed;
}

export function buildRailRequestUrl(
  journey: RailRequestJourney,
  connection: RailRequestConnection,
  params?: {
    timeOffset?: number;
    timeWindow?: number;
    numRows?: number;
  },
): string {
  const operationPath = `/GetDepBoardWithDetails/${journey.origin.id.toUpperCase()}`;
  let requestUrl = normalizeRailProxyUrl(connection.proxyUrl);

  if (/\{[^}]+\}/.test(requestUrl)) {
    requestUrl = replacePathPlaceholders(requestUrl, journey);
  } else if (!/GetDepBoardWithDetails/i.test(requestUrl)) {
    requestUrl = `${requestUrl}${operationPath}`;
  }

  const requestParams = new URL(requestUrl);

  requestParams.searchParams.set("filterCrs", journey.destination.id.toUpperCase());
  requestParams.searchParams.set("filterType", "to");
  requestParams.searchParams.set("numRows", String(params?.numRows ?? 20));
  requestParams.searchParams.set("timeOffset", String(params?.timeOffset ?? 0));
  requestParams.searchParams.set("timeWindow", String(params?.timeWindow ?? 180));

  return requestParams.toString();
}
