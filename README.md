# Train Ticker

Minimal setup to run the site locally.

## Install

```bash
npm install
cp .env.example .env.local
```

## Environment

Add the values you need in `.env.local`.

- `DARWIN_RDM_PROXY_URL` and `DARWIN_RDM_CONSUMER_KEY` enable live National Rail departures.
- `DARWIN_RDM_AUTH_TYPE=api-key` is the default Rail Data Marketplace proxy mode.
- `DARWIN_RDM_CONSUMER_SECRET` is only needed for bearer-style Darwin setups.
- `RDG_DISRUPTIONS_BASE_URL`, `RDG_DISRUPTIONS_AUTH_TOKEN`, `RDG_DISRUPTIONS_CLIENT_ID`, and `RDG_DISRUPTIONS_CLIENT_SECRET` enable disruption-aware National Rail alerts and empty states.
- `RDG_DISRUPTIONS_USER_AGENT` is optional and defaults to `TrainTicker/0.1`.
- `TFL_APP_ID` and `TFL_APP_KEY` are optional, but recommended for higher TfL rate limits.

The site still starts without credentials. National Rail cards stay unconfigured until Darwin is set, disruption enrichment stays off until the separate RDG Disruptions credentials are set, and Tube requests can run without TfL keys.

## Rail Disruptions Cache

RDG Disruptions responses are cached in-memory for 5 minutes per journey/operator combination. This keeps journey refreshes responsive while staying inside the RSPS5220 rule that disruption content must be refreshed or discarded within 1 hour.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production

```bash
npm run build
npm run start
```
