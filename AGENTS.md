### Commands

```bash
# setup
mise install
mise run install

# dependency management
mise exec -- npm install <package>
mise exec -- npm install -D <package>
mise exec -- npm uninstall <package>
mise exec -- npm install <package>@latest

# scripts
mise run dev
mise run lint
mise run test
mise run build
mise run start

# lockfile refresh
rm -rf node_modules package-lock.json && mise exec -- npm install
```
