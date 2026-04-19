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
- `TFL_APP_ID` and `TFL_APP_KEY` are optional, but recommended for higher TfL rate limits.

The site still starts without credentials. National Rail cards stay unconfigured until Darwin is set, and Tube requests can run without TfL keys.

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
