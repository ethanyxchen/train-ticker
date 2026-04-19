import type { JourneySearchResult } from "@/lib/journeys/types";

const NATIONAL_RAIL_PROVIDER = "national-rail" as const;

export const NATIONAL_RAIL_SEED_STATIONS: JourneySearchResult[] = [
  {
    id: "STP",
    label: "London St Pancras International",
    secondaryLabel: "National Rail · EMR / Thameslink",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "KGX",
    label: "London Kings Cross",
    secondaryLabel: "National Rail · LNER / Great Northern",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "LEI",
    label: "Leicester",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "NOT",
    label: "Nottingham",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "DBY",
    label: "Derby",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "SHF",
    label: "Sheffield",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "BDM",
    label: "Bedford",
    secondaryLabel: "National Rail · East Midlands / Thameslink",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "LUT",
    label: "Luton",
    secondaryLabel: "National Rail · Thameslink / EMR",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "LTN",
    label: "Luton Airport Parkway",
    secondaryLabel: "National Rail · Thameslink / EMR",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "KET",
    label: "Kettering",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "COR",
    label: "Corby",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "WEL",
    label: "Wellingborough",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "MHR",
    label: "Market Harborough",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "EMD",
    label: "East Midlands Parkway",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "LBO",
    label: "Loughborough",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "BEE",
    label: "Beeston",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "CHD",
    label: "Chesterfield",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "PBO",
    label: "Peterborough",
    secondaryLabel: "National Rail · East Coast / CrossCountry / EMR",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "GRA",
    label: "Grantham",
    secondaryLabel: "National Rail · East Coast / EMR",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "LCN",
    label: "Lincoln Central",
    secondaryLabel: "National Rail · East Midlands / LNER",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "NNG",
    label: "Newark North Gate",
    secondaryLabel: "National Rail · East Coast",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "OKM",
    label: "Oakham",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "MMO",
    label: "Melton Mowbray",
    secondaryLabel: "National Rail · East Midlands",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "EUS",
    label: "London Euston",
    secondaryLabel: "National Rail · Avanti / London Northwestern",
    provider: NATIONAL_RAIL_PROVIDER,
  },
  {
    id: "VIC",
    label: "London Victoria",
    secondaryLabel: "National Rail · Southern / Southeastern / Gatwick Express",
    provider: NATIONAL_RAIL_PROVIDER,
  },
];
