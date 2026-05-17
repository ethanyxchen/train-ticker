# Train Ticker

Minimal setup to run the site locally.

## Install

```bash
mise install
mise run install
cp .env.example .env.local
```

## Environment

Add the values you need in `.env.local`.

- `DARWIN_RDM_PROXY_URL` and `DARWIN_RDM_CONSUMER_KEY` enable live National Rail departures.
- `DARWIN_RDM_AUTH_TYPE=api-key` is the default Rail Data Marketplace proxy mode.
- `RDG_DISRUPTIONS_BASE_URL` and `RDG_DISRUPTIONS_CONSUMER_KEY` enable disruption-aware National Rail alerts and empty states through the Rail Data Marketplace disruptions API.
- `RDG_DISRUPTIONS_USER_AGENT` is optional and defaults to `TrainTicker/0.1`.
- `NEXT_PUBLIC_POLL_INTERVAL_MS` controls board refresh cadence in milliseconds and defaults to `60000`.

The site still starts without credentials. National Rail cards stay unconfigured until Darwin is set, and disruption enrichment stays off until the separate RDG Disruptions credentials are set.

## Rail Disruptions Cache

RDG Disruptions responses are cached in-memory for 5 minutes per journey/operator combination. This keeps journey refreshes responsive while staying inside the RSPS5220 rule that disruption content must be refreshed or discarded within 1 hour.

## Development

```bash
mise run dev
```

Open `http://localhost:3000`.

## Production

```bash
mise run build
mise run start
```
