### Commands

```bash
# setup
mise install
mise exec -- npm install

# dependency management
mise exec -- npm install <package>
mise exec -- npm install -D <package>
mise exec -- npm uninstall <package>
mise exec -- npm install <package>@latest

# scripts
mise exec -- npm run dev
mise exec -- npm run lint
mise exec -- npm test
mise exec -- npm run build
mise exec -- npm run start

# lockfile refresh
rm -rf node_modules package-lock.json && mise exec -- npm install
```
