# GamesTracker Vault documentation

## Using it

| Guide | What it covers |
|---|---|
| [Install with Docker](./install-docker.md) | One-command script, compose by hand, volumes, building the image |
| [Install on Proxmox](./install-proxmox.md) | LXC container installer, Debian without Proxmox, maintenance commands |
| [Configuration](./configuration.md) | Every environment variable, for both installs |
| [Domain and HTTPS](./reverse-proxy.md) | Nginx Proxy Manager, Caddy, Traefik, nginx; self-signed certificates |
| [Android app](./android.md) | Installing the APK, connecting, updates, certificates, F-Droid build |
| [Backup and restore](./backup-restore.md) | Automatic backups, restoring, moving between machines |
| [Updating](./updating.md) | Docker, Proxmox, Android; moving from the old repository |
| [Troubleshooting](./troubleshooting.md) | Common problems and where the logs are |
| [API](./API.md) | API tokens, every call with examples, recipes |
| [Architecture](./architecture.md) | How the pieces fit, with a diagram |

## Developing it

Start with [CONTRIBUTING.md](../CONTRIBUTING.md) (setup, commands, conventions, releases).
The reference below describes the source code — when it disagrees with the code, the code
wins.

### Foundations
| # | Document | What it answers |
|---|---|---|
| 01 | [Overview](./development/01-overview.md) | What the project is, its features and pieces |
| 02 | [Architecture](./development/02-architecture.md) | How the pieces connect, layers, security boundaries |
| 03 | [Data model](./development/03-data-model.md) | Tables, enums, migrations |

### Server
| # | Document | What it answers |
|---|---|---|
| 04 | [Server structure](./development/04-backend-structure.md) | Monorepo, anatomy of a module, layers, creating a new module |
| 05 | [Server modules](./development/05-backend-modules.md) | One by one: what it does, which files it has, what it exposes |
| 06 | [API endpoints](./development/06-api-endpoints.md) | Every route, with body, response and guards |

### Web app
| # | Document | What it answers |
|---|---|---|
| 09 | [Web app structure](./development/09-frontend-structure.md) | Folders, contexts, routes, guards, HTTP layer, i18n |
| 10 | [Pages and components](./development/10-frontend-pages.md) | Each screen, the top bar, each modal, each hook |
| 11 | [Design system](./development/11-design-system.md) | The Ember design: principles, typography, shapes, mixins, logo and layout of the main screens |
| 12 | [Color palette](./development/12-color-palette.md) | Ember palette (night default, ember orange accent), night and day tokens, status colours, usage rules |

### Cross-cutting
| # | Document | What it answers |
|---|---|---|
| 14 | [Main flows](./development/14-main-flows.md) | End-to-end journeys, step by step |
| 15 | [Deploy and environment](./development/15-deploy-and-environment.md) | How the installs work inside, local development |
| 16 | [Conventions and patterns](./development/16-conventions-and-patterns.md) | Naming, style, git, known debt |
| 17 | [Android app](./development/17-android-app.md) | The native shell: structure, JS bridge, self-update, building and signing |

The numbering has gaps (07, 08, 13) on purpose, so older links keep working.

## Where to look

- **Where is this?** → 05 (modules) or 10 (pages and hooks).
- **How does X work end to end?** → 14 (flows).
- **Which route do I call?** → 06; from another program → [API.md](./API.md).
- **Search and IGDB** → 05 (`games/`, `integrations/`), 10 (Search page) and 14.
- **Game page and shelf** → 03 (`Game`, `LibraryEntry`), 05 (`library/`), 10 (Game and
  Home pages).
- **Stats and random game** → 05 (`library/`), 06 (`/library/stats`, `/library/discover`).
- **Assistant** → 03 (`AiSettings`), 05 (`ai/`), 06 (`/ai`), 14.
- **Android app** → 17 and [android.md](./android.md).
- **A new server module** → 04, then 16.
