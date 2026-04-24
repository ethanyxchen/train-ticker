<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

Use `mise` as the entrypoint for all Node/package workflows.

### Setup

- Install toolchain versions from `mise.toml`: `mise install`
- Install project dependencies: `mise exec -- npm install`

### Dependency management

- Add a runtime dependency: `mise exec -- npm install <package>`
- Add a dev dependency: `mise exec -- npm install -D <package>`
- Remove a dependency: `mise exec -- npm uninstall <package>`
- Update a dependency: `mise exec -- npm install <package>@latest`

### Scripts

- Run dev server: `mise exec -- npm run dev`
- Run lint: `mise exec -- npm run lint`
- Run tests: `mise exec -- npm test`
- Run production build: `mise exec -- npm run build`
- Start production server: `mise exec -- npm run start`

### Lockfile refresh

- Reinstall from scratch: `rm -rf node_modules package-lock.json && mise exec -- npm install`
