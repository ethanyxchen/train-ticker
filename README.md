## Train Ticker

Personal live departures board for user-saved journeys, built around:

- National Rail Darwin live boards for mainline rail
- TfL Unified API for London Underground journey planning and line status
- A provider registry so future expansion to broader UK rail search does not require a UI rewrite

The current MVP focuses on:

- Saving journeys locally in the browser
- Polling live API-backed journey data every 60 seconds
- Supporting EMR-style National Rail trips and Tube trips first
- Rendering everything in a retro split-flap-inspired board UI with timed and manual ticker switching

## Stack

- Next.js 16 App Router
- TypeScript
- Route handlers for server-side API integration
- Tailwind CSS 4 for the UI

## Getting Started

1. Copy the example environment file.

```bash
cp .env.example .env.local
```

2. Add your API credentials.

- `DARWIN_RDM_PROXY_URL`
- `DARWIN_RDM_CONSUMER_KEY`
- `DARWIN_RDM_CONSUMER_SECRET`
- `DARWIN_RDM_AUTH_TYPE=api-key` for the current Darwin proxy flow
- `TFL_APP_ID` and `TFL_APP_KEY` are optional but recommended for TfL rate limits

3. Install and run the development server.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Credentials

### National Rail Darwin

The National Rail integration uses the Rail Data Marketplace Darwin proxy, using the consumer key on the proxy URL shown in your active subscription’s `Specification` tab.

Official references:

- National Rail developer info: https://www.nationalrail.co.uk/developers/online-journey-planner-data-feeds/
- Darwin LDB docs: https://realtime.nationalrail.co.uk/LDBSVWS/docs/documentation.html
- Darwin OpenAPI spec: https://realtime.nationalrail.co.uk/LDBWS/static/ldbws.json

Important limitation for the MVP:

- National Rail live lookup is implemented for direct services using Darwin live boards.
- The app uses `GetDepBoardWithDetails/{crs}` and matches the saved destination against service destinations and calling points, which works better for intermediate stops like Leicester.
- The required setup is the RDM proxy URL plus consumer key. For the current Darwin product flow, the consumer secret is stored but not sent on the request because the proxy uses API-key authentication.
- National Rail station search is currently seeded with common EMR/London stations plus manual CRS code entry.
- Full nationwide rail station discovery is intentionally isolated behind the provider layer so it can be swapped in later without changing the UI data model.

### TfL Unified API

The Tube integration uses:

- `StopPoint/Search` for station lookup
- `Journey/JourneyResults/{from}/to/{to}` for live route options

Official reference:

- TfL Unified API docs: https://api.tfl.gov.uk/
- TfL Swagger: https://api.tfl.gov.uk/swagger/docs/v1

## Project Structure

- `app/api/journeys/route.ts`: normalizes live provider responses for the client
- `app/api/search/route.ts`: provider-specific station search
- `lib/journeys/providers/`: provider registry and live integrations
- `components/`: client UI, saved journey form, board cards, split-flap renderer

## MVP Notes

- Saved journeys are stored in browser local storage.
- National Rail cards currently target direct departures from origin to destination.
- Tube cards return next route options, line status, and disruption text.
- Rail cards gracefully show an unconfigured state until Darwin credentials are present.

## Validation

These commands currently pass:

```bash
npm run lint
npm run build
```

## Next Steps

Good follow-on work after this MVP:

- replace the seeded National Rail station list with a full searchable station source
- add journey editing instead of add/remove only
- persist journeys server-side if you want multi-device sync
- upgrade National Rail route planning from direct-board lookups to broader planner coverage when you have the right licensed feed

## Deploying

The app builds as a normal Next.js deployment target. Keep the external API credentials on the server side through environment variables.
