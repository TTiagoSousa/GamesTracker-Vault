# 05 · Backend modules

Modules registered in `app.module.ts`, in this order: `ConfigModule` (global, reads
`.env.<NODE_ENV>` and then `.env`), `PrismaModule`, `AuthModule`, `UserModule`,
`SystemModule`, `GamesModule`, `IntegrationsModule`, `LibraryModule`, `AiModule`. Plus
the `AppController`: `GET /` (`"GamesTracker Vault API"`, which the installer uses to wait
for startup) and `GET /health` (`{ app: "gametracker-vault", ok: true }`, public, which
the Android app uses to confirm that the typed address is a GamesTracker Vault — see
[17](./17-android-app.md)). Neither of them touches the database.

Games live in two modules: `games/` reads the IGDB catalogue (search, filter options,
game record) and stores nothing; `library/` is each user's shelf and stores, in the
`Game` table, the minimal copy of the games on it (and computes the stats and the random
game). `ai/` is the assistant: it reads the shelf through `library/`'s repository and
searches IGDB through the `GamesService`.

The API's error messages are in Portuguese in the code (the frontend shows them as they
come); they are quoted here in English translation.

---

## `prisma/`

`PrismaService extends PrismaClient` with the `PrismaPg` adapter (maximum pool of 20).
`PrismaModule` is `@Global()` and exports it. It's the only class that talks to the
database.

---

## `auth/`

Authentication via a JWT stored in an httpOnly cookie, or an API token
(`Authorization: Bearer gtv_…`, see [`api-tokens/`](#api-tokens)).

| File | Role |
|---|---|
| `auth.controller.ts` | `register`, `login`, `logout`, `me` |
| `auth.service.ts` | delegates to `registerFirstUser`, `validateUser`, `loginUser` |
| `helpers/registerFirstUser.ts` | only creates if there are no users yet (becomes ADMIN); afterwards throws 403 "Registration is closed…" |
| `helpers/validateUser.ts` | looks up by username, compares with bcrypt, returns the user **without** the password, or `null` |
| `helpers/loginUser.ts` | signs `{ sub, username, role }` (only `sub` is read back) |
| `session-cookie.ts` | `SESSION_COOKIE` (`access_token`), `sessionCookieOptions(req)`, `SESSION_MAX_AGE_MS` (7 days) |
| `jwt-payload.interface.ts` | `JwtPayload { id, username, role, authMethod? }` — what ends up in `req.user`; `authMethod` is `'session'` or `'token'` |
| `strategies/local.strategy.ts` | used only on login; throws 401 "Invalid credentials" |
| `strategies/jwt.strategy.ts` | extracts the token **from the** `access_token` **cookie**, not from the header; in `validate` reads the user from the database by `sub` (`PrismaUserRepository.findById`) and returns `{ id, username, role }` **from the database**; deleted user → 401 "Invalid session" |
| `strategies/api-token.strategy.ts` | `passport-http-bearer` named `api-token`: only the `Authorization` header (not `?access_token=`), only `gtv_…`; looks the SHA-256 up in `ApiToken`, refuses expired (401) and read-only on a non-`GET` (403), reads the owner from the database (current role), touches `lastUsedAt` at most once a minute |
| `guards/jwt-auth.guard.ts` | `AuthGuard(['jwt', 'api-token'])` — the cookie or a token, either one |
| `guards/session-only.guard.ts` | after `JwtAuthGuard`: 403 when `authMethod` is `'token'` — for `/tokens` |
| `guards/local-auth.guard.ts` | `AuthGuard('local')` |
| `guards/roles.guard.ts` | reads `@Roles(...)` via `Reflector`; without metadata, lets through; otherwise 403 "No permissions…" |
| `decorators/roles.decorator.ts` | `@Roles(Role.ADMIN)` |
| `dto/login.dto.ts` | exists but isn't used (see debt in [16](./16-conventions-and-patterns.md)) |

The cookie is set in the controller with the options from `session-cookie.ts`:
`httpOnly`, `sameSite: 'strict'`, `path: '/'`, `secure: req.secure`, `maxAge` of 7 days
— the same validity as the JWT (`JwtModule` with `expiresIn: '7d'`, secret
`JWT_SECRET`). `secure` follows each request's protocol because the same installation is
opened through the domain with SSL and through the CT's IP over http — and a `secure`
cookie over http is never stored. Logout clears it with the same options, otherwise the
browser doesn't recognize it.

---

## `user/`

The reference example of the four layers.

| Route | Guard | What it does |
|---|---|---|
| `GET /user/me` | JWT | your own data, without password |
| `PATCH /user/me` | JWT | changes your own name |
| `PUT /user/me/password` | JWT | changes your own password (asks for the current one); 200 |
| `GET /user` | JWT + ADMIN | lists everyone, oldest to newest |
| `POST /user` | JWT + ADMIN | creates with a chosen role |
| `PATCH /user/:id` | JWT + ADMIN | changes an account's name, role and/or password (`ParseUUIDPipe`) |
| `DELETE /user/:id` | JWT + ADMIN | deletes an account (`ParseUUIDPipe`) |

| Helper | What it does |
|---|---|
| `createUser(dto, repo)` | used by public registration (via `registerFirstUser`); the **first** user becomes `ADMIN`, the following ones `USER` |
| `createUserByAdmin(dto, repo)` | respects the DTO's role (default `USER`) |
| `findAllUsers(repo)` | everyone, without password |
| `findCurrentUser(id, repo)` | yourself; 404 if it doesn't exist |
| `updateOwnUsername(id, username, repo)` | trims the name; 409 "That name is already in use." if it belongs to another account; returns the user without password |
| `changeOwnPassword(id, current, next, repo)` | reads the hash (`findByIdWithPassword`), confirms the current one with `comparePasswords` (400 "The current password is wrong."), stores the new one with bcrypt 12; `{ message: 'Password alterada' }` |
| `updateUserByAdmin(id, dto, repo)` | 404 if it doesn't exist; only changes what's sent and different: name (409 if duplicated), role (400 "There must be at least one administrator." when removing the role from the last ADMIN), password (bcrypt 12); with no changes returns the user as is |
| `deleteUserByAdmin(id, requesterId, repo)` | 400 "You can't delete your own account."; 404 if it doesn't exist; 400 "There must be at least one administrator." if it's the last ADMIN; deletes (the shelf, the `AiSettings` and the assistant conversations cascade); `{ message: 'Utilizador apagado' }` |

Both `create*` reject a duplicate username with 409 and hash with bcrypt, 12 rounds.
DTOs: `CreateUserDto` (`username` ≥ 3, `password` ≥ 8) and `AdminCreateUserDto` (plus
`role?`); in `dto/update-account.dto.ts`, `UpdateUsernameDto` (`username` 3–32, only
letters, digits, `.`, `-` and `_` — `/^[\p{L}\p{N}._-]+$/u`, no spaces),
`ChangePasswordDto` (`currentPassword`, `newPassword` 8–128) and `AdminUpdateUserDto`
(`username?` with the same rules, `password?` 8–128, `role?`). Registration and
creation by the admin don't yet apply the name pattern nor the 32 maximum.

The repository (`PrismaUserRepository`) always returns the public fields
(`PUBLIC_FIELDS`, type `PublicUser`) except in `findByUsername` (login) and
`findByIdWithPassword` (changing the password); it also has `update`, `delete` and
`countAdmins`. The module exports `PrismaUserRepository`, which `AuthModule` uses (login
and `JwtStrategy`).

---

## `system/`

Installed version, releases and updates. **ADMIN only** (`JwtAuthGuard` + `RolesGuard` +
`@Roles(Role.ADMIN)` on the class). No database and no repository: the helpers talk to
`git` and to files in `SYSTEM_UPDATES_DIR`.

| File | Role |
|---|---|
| `system.controller.ts` | `GET version`, `GET releases`, `POST update` (202), `GET update/status` |
| `system.service.ts` | delegates; converts `lang` with `noteLanguage` |
| `dto/request-update.dto.ts` | `{ version }` with `@Matches(/^v\d+\.\d+\.\d+$/)` |
| `helpers/git.ts` | `repoDir()` (`APP_DIR`, or two levels above `cwd` in development) and `git(args, timeout)` |
| `helpers/semver.ts` | `isVersion`, `compareVersions` — only `vX.Y.Z`, no pre-releases |
| `helpers/getInstalledVersion.ts` | `git describe`: `version` (exact tag or `null`), `baseVersion`, `commit`, `date`, `branch` |
| `helpers/getReleases.ts` | `v*` tags from the newest backwards, with notes parsed into `features`/`fixes`/`improvements`/`other`; `git fetch --tags` at most every 5 min (or forced); `NOTE_LANGUAGES` (`pt-PT`, `en`, `es`) and `noteLanguage()` (any other value → `en`) |
| `helpers/getVersionOverview.ts` | `getVersionOverview` (for the card) and `listReleases` (for the Versions page) |
| `helpers/requestUpdate.ts` | validates and writes the request: 503 without `SYSTEM_UPDATES_DIR`, 409 if one is already in progress, 400 if the version doesn't exist or isn't newer |
| `helpers/updateFiles.ts` | `updatesDir()`, `readUpdateStatus(logLines)` (reads `request`, `status.json`, `update.log` without ANSI colors), `writeUpdateRequest` (atomic write) |

**Release notes.** For each tag it looks for `releases/<version>/<language>.md` on
`origin/main` and then on the tag; without a file in that language it uses `en.md`;
without any, the tag message. The `### Features` / `### Fixes` / `### Improvements`
headings give the sections; the rest goes to `other`.

**Forward only.** There's no route to go back to a previous version: database migrations
aren't undone. Skipping versions is safe.

Without `SYSTEM_UPDATES_DIR` (development) updates are disabled
(`updatesEnabled: false`), but the version and releases are still read from the local
git.

---

## `games/`

Search over the **IGDB** catalogue (API v4), filter options and a game's record. Any
user with a session (`JwtAuthGuard` on the class). No database and no repository: the
service passes the `IgdbClient` to the helpers. This module stores nothing from IGDB —
neither games nor covers; the shelf's minimal copy is written by `library/`.

| File | Role |
|---|---|
| `games.module.ts` | `imports: [IntegrationsModule]` (to read the credentials); providers `GamesService` and `IgdbClient`; **exports** `GamesService` (used by `LibraryModule` and `AiModule`) |
| `games.controller.ts` | `GET search` (`SearchGamesDto` in the query), `GET filters` and `GET :id` (`ParseIntPipe`) — the latter **after** the fixed routes, otherwise `search` and `filters` would be read as ids |
| `games.service.ts` | delegates: `search` → `searchGames`, `filters` → `listFilters`, `detail(id)` → `getGameDetail`, and, without a route of their own (for `library/` and `ai/`), `summary(id)` → `getGameSummary`, `facts(ids)` → `getGameFacts` and `random(exclude)` → `getRandomGame` |
| `dto/search-games.dto.ts` | `SearchGamesDto`, `SORTS`, `MAX_PAGE_SIZE` (50) — see [06](./06-api-endpoints.md#games--games) |
| `helpers/buildSearchQuery.ts` | DTO → two Apicalypse queries (`query` with fields, order and page; `countQuery` with only `search` and `where`); `DEFAULT_PAGE_SIZE` 24, `MIN_RATINGS_FOR_TOP` 25, `GAME_FIELDS` |
| `helpers/buildSearchQuery.spec.ts` | 8 Jest tests: text without order, escaping quotes and backslashes, filters with `&`, years in Unix time, the three ordering rules without text, offset per page |
| `helpers/searchGames.ts` | runs both queries (`games` and `games/count`) and returns `{ items, total, page, pageSize }` |
| `helpers/mapGame.ts` | `IgdbGame` → `GameSummary` (`id`, `name`, `slug`, `coverUrl`, `year`, `platforms`, `genres`, `rating`, `ratingCount`, `type`) |
| `helpers/listFilters.ts` | the six option lists (`platforms`, `genres`, `themes`, `game_modes`, `player_perspectives`, `game_types`) with an in-memory cache of **24 h**; after that it keeps serving the old list and renews it in the background (only one request in flight at a time, the six queries in parallel through the `IgdbClient` queue). `GamesService` loads it at startup (`onApplicationBootstrap`; without credentials it fails silently and tries again on the first request) |
| `helpers/getGameDetail.ts` | a game's full record (below): up to three IGDB queries, in-memory cache of **10 min** for up to **200** games; 404 "Game not found on IGDB." |
| `helpers/mapGameDetail.ts` | `IgdbGameDetail` → `GameDetail` (shape in [06](./06-api-endpoints.md#games--games)); also `mapRef` (`GameRef` = `{ id, name, coverUrl, year }`) and the types `IgdbTimeToBeat`, `GameRef`, `GameDetail` |
| `helpers/getGameSummary.ts` | a game's `GameSnapshot` (`igdbId`, `name`, `slug`, `coverImageId`, `releaseYear`, `platforms`, `genres`) for the `Game` table, with the same fields as the search (`GAME_FIELDS`); 404 "Game not found on IGDB." |
| `helpers/getGameFacts.ts` | `GameFacts` (`genres`, `ttbMain`, `ttbExtras`, `ttbCompletionist`) for several games at once: for each batch of up to **500** ids, two parallel requests — `games` (`genres.name`) and `game_time_to_beats` (`hastily`, `normally`, `completely`, in seconds → hours with one decimal). Returns a `Map` by id; games without times get `null` |
| `helpers/getRandomGame.ts` | a random game from the catalogue, outside the given ids (`exclude`): main games (`game_type = 0`) already released, with a cover, `total_rating >= 75` and `total_rating_count >= 40`. Counts them (`games/count`) and requests one with a random `offset` (up to 9,999, IGDB's limit) by `id asc`; returns a `GameSummary` (`mapGame`); 404 "There are no games to suggest." |
| `igdb/igdb.client.ts` | `IgdbClient.query<T>(endpoint, body)` — queue, token, errors (below) |
| `igdb/requestTwitchToken.ts` | `POST https://id.twitch.tv/oauth2/token` (client credentials); `null` if Twitch answers 400/401/403, an exception on other errors or without network. Also used by `integrations/` |

**Query.** List filters produce `field = (id,id,…)` ("any of"), joined with `&`;
`modes` → `game_modes`, `perspectives` → `player_perspectives`, `types` → `game_type`.
Years: `yearFrom` → `first_release_date >= Jan 1`, `yearTo` →
`first_release_date < Jan 1 of the following year` (Unix time in UTC). `minRating` →
`total_rating >= N` (IGDB's `total_rating` combines critics and users). The text is
escaped (`\` and `"`) before going into `search "…";`.

**Order.**

- **With text** — IGDB orders by relevance and doesn't accept another order: there's no
  `sort` and the requested `sort` is ignored.
- **Without text** — `sort` (default `popular`) with an extra condition so the order
  makes sense:

| `sort` | Order | Added condition |
|---|---|---|
| `popular` | `total_rating_count desc` | — (whole catalogue: IGDB puts games without ratings at the end, so the count is the total and the order starts with the most popular) |
| `rating` | `total_rating desc` | `total_rating_count >= 25` (otherwise whoever has a single 100 rating wins) |
| `newest` | `first_release_date desc` | `first_release_date <= now` (leaves out unreleased ones) |
| `oldest` | `first_release_date asc` | — |
| `name` | `name asc` | — |
| `relevance` | orders like `popular` | — (only exists with text; without text it counts as `popular`) |

**Covers.** `coverUrl` is
`https://images.igdb.com/igdb/image/upload/t_cover_big/<image_id>.jpg` (264×374) — the
browser fetches them directly from the IGDB CDN. `year` comes from `first_release_date`
in UTC; `platforms` uses the abbreviation when it exists; `rating` is rounded.

### Game record (`getGameDetail`)

Three queries, through the `IgdbClient` queue:

1. **`games`** — `where id = <id>` with many fields (`DETAIL_FIELDS`): name, slug,
   summary, storyline, IGDB URL, cover, date, type (`game_type.type`), platforms,
   genres, themes, modes, perspectives, companies (with `developer`/`publisher`), series
   (`collections`), franchises, the three ratings and their counts (`total_rating`,
   `aggregated_rating` = critics, `rating` = players), screenshots, videos, and — with
   only name, cover and date — `dlcs`, `expansions`, `standalone_expansions`, `remakes`,
   `remasters` and `parent_game`. No result → **404**.
2. **`game_time_to_beats`** — `hastily`, `normally`, `completely`, `count` for
   `game_id = <id>`. Times come in seconds and become hours with one decimal place.
   Failing or having no data isn't an error: `timeToBeat` is `null`.
3. **Same series** — only if the game has `collections`: `games` where
   `collections = (ids) & game_type = 0 & id != <id>` (main games only, excluding the
   game itself), by `first_release_date asc`, up to 50. Failing gives an empty list.

`mapGameDetail` tidies the result: cover in `t_cover_big_2x`; `releaseDate` as
`YYYY-MM-DD`; developers and publishers without duplicates; ratings rounded (`null`
without a rating, count 0); up to **12** screenshots in `t_screenshot_big`; up to **4**
videos as YouTube ids; `expansions` merges expansions and standalone ones;
`otherVersions` merges remakes and remasters; DLCs, expansions and other versions by year
(those without a year at the end) and then by name. Related games use `t_cover_big`.

**Cache.** An in-memory `Map` by id, valid for 10 minutes — going back to the same page
doesn't repeat the three queries. With 200 games stored, the first one in is evicted
(the `Map`'s insertion order, not least recently used). Error responses aren't cached.

### `IgdbClient`

`@Injectable()`, one instance per process.

- **Credentials**: on each request it asks the `IntegrationCredentialsService` for them
  (which caches them). Without credentials → **503** "Game search isn't configured. An
  administrator has to enter the IGDB credentials in Admin → Integrations."
- **Token**: a Twitch app token, kept in memory with the Client ID and secret it was
  requested with. It reuses it while more than 1 minute remains before expiry **and** the
  credentials are the same; otherwise it requests another. If the API answers **401**,
  it requests a new token and retries the request once.
- **Queue**: every request goes through a queue that spaces them at least **260 ms**
  apart (≈ 4 per second, IGDB's limit), even with several searches at once. A search is
  two requests (results + count); opening the filter options without cache is six; a
  game record without cache is two or three; saving to the shelf a game without a recent
  copy is one; refreshing the shelf's facts is two per 500 games; the random game is
  two; each assistant tool is a search (two) or a record.
- **Errors**:

| Situation | Exception |
|---|---|
| no stored credentials | 503 "Game search isn't configured…" |
| Twitch unreachable when requesting the token | 503 "Couldn't reach Twitch to authenticate with IGDB." |
| Twitch rejects the credentials | 503 "Twitch rejected the IGDB credentials — an administrator has to review them in Admin → Integrations." |
| IGDB answers 429 | 503 "IGDB is rate-limiting requests. Try again in a moment." |
| IGDB answers another error (or 401 after the new token) | 502 "IGDB responded with an error (N)." |

**Terms.** The IGDB API is free for non-commercial use, under the Twitch Developer
Service Agreement; each installation uses the credentials of its own Twitch application.

---

## `integrations/`

Credentials for the installation's external services — for now only IGDB. **ADMIN only**
(`JwtAuthGuard` + `RolesGuard` + `@Roles(Role.ADMIN)` on the class). Follows the four
layers, plus a read service for other modules.

| File | Role |
|---|---|
| `integrations.module.ts` | providers `IntegrationsService`, `IntegrationCredentialsService`, `PrismaIntegrationRepository`; **exports** `IntegrationCredentialsService` |
| `integrations.controller.ts` | `GET igdb`, `PUT igdb`, `POST igdb/test` (200), `DELETE igdb` |
| `integrations.service.ts` | delegates; after saving or removing, `credentials.invalidate(IGDB)` |
| `integration-credentials.service.ts` | `get(provider)` → `{ clientId, clientSecret }` in plaintext, or `null`; in-memory cache per provider (including "not configured") until `invalidate(provider)` |
| `dto/save-igdb.dto.ts` | `SaveIgdbDto`: `clientId` and `clientSecret?`, both `/^[a-z0-9]{20,64}$/` |
| `helpers/getIgdbStatus.ts` | `{ configured, clientId, secretHint, updatedAt }` — `secretHint` is the last 4 characters of the decrypted secret; everything `null` (and `configured: false`) without a row |
| `helpers/saveIgdbCredentials.ts` | blank secret → uses the stored one (400 "The Client Secret is missing." if there's none); validates with Twitch **before** saving; encrypts and upserts; returns the status |
| `helpers/testIgdbCredentials.ts` | requests a token with the stored credentials: `{ ok: true }` or `{ ok: false, reason: 'not-configured' \| 'rejected' \| 'unreachable' }` |
| `repositories/integration-repository.ts` | interface `find`, `save`, `remove` |
| `repositories/prisma/prisma-integration-repository.ts` | `findUnique`, `upsert` by `provider`, `deleteMany` (removing what doesn't exist doesn't fail) |

**Validate before saving.** The `PUT` only saves after Twitch accepts the credentials:
wrong credentials never replace good ones. Errors (400): "Couldn't reach Twitch to
validate the credentials." and "Twitch rejected the credentials — check the Client ID
and the Client Secret."

**The secret never goes back to the browser.** It stays encrypted in the database
(AES-256-GCM, key `TOKEN_ENCRYPTION_KEY`), decrypted only in memory (for the
`IgdbClient` and to compute the `secretHint`). No route returns the secret, not even
encrypted.

**Cache.** `IntegrationCredentialsService` avoids hitting the database and decrypting on
every search. `IntegrationsService` invalidates it after each `PUT` and `DELETE`;
`IgdbClient` compares the credentials with those of the token it holds and requests
another when they change.

---

## `library/`

Each user's shelf. Any user with a session (`JwtAuthGuard` on the class), and each one
only sees and touches their own: the `userId` always comes from `req.user.id` and goes
into the key of every query. Follows the four layers; games are identified by their IGDB
id (`gameId`, `ParseIntPipe` on every route with a parameter).

| File | Role |
|---|---|
| `library.module.ts` | `imports: [GamesModule]` (for the `GamesService`); providers `LibraryService` and `PrismaLibraryRepository`; **exports** `PrismaLibraryRepository` (the assistant reads the shelf) |
| `library.controller.ts` | `GET /`, `GET stats`, `GET discover`, `GET :gameId`, `PUT :gameId`, `DELETE :gameId` — `stats` and `discover` **before** `:gameId` |
| `library.service.ts` | delegates; receives the repository and the `GamesService` and passes them to the helpers. `discover(userId)` reads the entries and calls `games.random(shelf ids)` (no helper of its own) |
| `dto/save-library-entry.dto.ts` | `SaveLibraryEntryDto` (below) |
| `helpers/listLibrary.ts` | all of the user's entries (most recent first) and `counts` with **every** status (0 for those without games) and `total` |
| `helpers/getLibraryEntry.ts` | `{ entry }` — the entry, or `null` if the game isn't on the shelf (not a 404) |
| `helpers/saveLibraryEntry.ts` | validates the dates, ensures the game copy and upserts the entry (below) |
| `helpers/removeLibraryEntry.ts` | deletes the entry; 404 "This game isn't on your shelf." if there was none; returns `{ entry: null }` |
| `helpers/getLibraryStats.ts` | the stats (below) |
| `helpers/estimateHours.ts` | an entry's hours: entered or estimated (below) — pure function, also used by `ai/` |
| `helpers/refreshGameFacts.ts` | refreshes in batch the genres and average times of these entries' games with `factsCheckedAt` `null` or older than **7 days** (`games.facts`, `saveGameFacts`, and updates the entries in memory); if IGDB fails, returns `false` and the numbers are computed with what was already there |
| `helpers/mapEntry.ts` | entry + game → app shape (`LibraryEntryView`): dates as `YYYY-MM-DD`, `game` with `coverUrl` in `t_cover_big` |
| `repositories/library-repository.ts` | interface `findGame`, `saveGame`, `findEntry`, `listEntries`, `saveEntry`, `removeEntry`, `saveGameFacts`; types `EntryWithGame` and `EntryData` |
| `repositories/prisma/prisma-library-repository.ts` | `game.upsert` by `igdbId`; `saveGameFacts` = `game.update` with the facts and `factsCheckedAt: now`; `libraryEntry.findUnique`/`upsert` by `userId_gameId` with `include: { game: true }`; `findMany` by `updatedAt desc`; `deleteMany` by `{ userId, gameId }` (returns whether it deleted any) |

**`SaveLibraryEntryDto`.** The `PUT` **replaces the whole entry**: a field that's not
sent, or sent as `null`, ends up empty.

| Field | Validation |
|---|---|
| `status` | required, a `LibraryStatus` value |
| `hoursPlayed?` | number with up to 2 decimal places, 0–100,000 |
| `startedAt?`, `finishedAt?` | `YYYY-MM-DD` string (messages "startedAt must be YYYY-MM-DD" / "finishedAt must be YYYY-MM-DD") |
| `rating?` | integer 1–10 |
| `notes?` | string up to 2000 characters |

**Saving (`saveLibraryEntry`).**

1. Converts the dates to UTC midnight; with both, `finishedAt < startedAt` → **400**
   "The date you finished can't be earlier than the date you started."
2. Game copy: with no row in `Game`, or with `updatedAt` older than **7 days**, it
   requests `games.summary(gameId)` from IGDB and upserts. An id that doesn't exist on
   IGDB gives **404** "Game not found on IGDB."; IGDB unconfigured or down gives the
   `IgdbClient`'s 503/502 — in those cases nothing is saved.
3. Upsert of the entry with the DTO's fields (`notes` trimmed; empty → `null`).
4. Returns `{ entry }` already mapped.

Removing the game from the shelf doesn't delete the `Game` row (it stays for other users
or for when it comes back).

### Stats (`getLibraryStats`)

1. Reads all of the user's entries and runs `refreshGameFacts` (genres and average times
   missing or older than 7 days, in batch).
2. Counts per status (all seven, 0 for empty ones). `PLAN_TO_PLAY` entries only go into
   the **backlog**: sum of each one's `ttbMain` (those without a time count in
   `backlog.missingGames`).
3. For the others, hours via `estimateHours`, the rating distribution (1–10), finished
   per year (`FINISHED_*`/`COMPLETED_100`, by the UTC year of `finishedAt` or, without
   it, of `updatedAt`) and the genre count.
4. Returns totals rounded to one decimal, `completionRate` (finished ÷ (finished +
   dropped), in %, or `null`), the 8 most frequent genres, the 5 best rated (ties broken
   by most recent) and the 5 with the most hours, and `factsComplete` (`false` when IGDB
   failed during the refresh). Shape in [06](./06-api-endpoints.md#shelf--library).

**Hours rule (`estimateHours`).** First the hours the user entered (`hoursPlayed`, even
0) — `estimated: false`. Without them, only finished statuses get an estimate, from the
IGDB average for that kind of ending: `FINISHED_MAIN` → `ttbMain`; `FINISHED_EXTRAS` →
`ttbExtras` (or `ttbMain`); `COMPLETED_100` → `ttbCompletionist` (or `ttbExtras`, or
`ttbMain`) — `estimated: true`. Playing, paused, dropped or play later without entered
hours: no hours (they count in `hours.missingGames`).

**Random game (`discover`).** `GET /library/discover` collects the shelf ids and asks
`getRandomGame` for a well-rated IGDB game outside them. The "from my list" draw (play
later and paused) is done in the browser, without a route.

---

## `ai/`

The assistant: a chat with Claude (Anthropic API) that knows the user's shelf and can
search IGDB. Any user with a session (`JwtAuthGuard` on the class); each one uses
**their own** Anthropic key. It has a controller, service, helpers and two repositories;
in place of the injectable client there's a file of functions for Anthropic. The
conversations are stored (`AiConversation`, `AiMessage`); the answers being written live
in memory (`ChatRuns`).

| File | Role |
|---|---|
| `ai.module.ts` | `imports: [GamesModule, LibraryModule]`; providers `AiService`, `AiSettingsRepository`, `AiChatRepository` and `ChatRuns` |
| `ai.controller.ts` | `GET settings`, `PUT settings`, `DELETE settings`, `POST models` (200), `POST chat` (201, JSON), `GET conversations`, `GET conversations/:id`, `DELETE conversations/:id`, `POST conversations/:id/stop` (200), `GET conversations/:id/stream` (NDJSON with `@Res()`, below). The `:id` goes through `ParseUUIDPipe` |
| `ai.service.ts` | delegates to the helpers; injects `AiSettingsRepository`, `AiChatRepository`, `ChatRuns`, `PrismaLibraryRepository` and `GamesService`. `removeSettings` deletes and returns the status. `ask`, `follow`, `stop`, `conversations`, `conversation`, `removeConversation` (below); `onModuleInit` calls `interruptPending` |
| `dto/ai.dto.ts` | `SaveAiSettingsDto` (`apiKey?` 20–400, `model` ≤ 100 with `/^[a-z0-9][a-z0-9.\-_@]*$/i`), `ListModelsDto` (`apiKey?`), `ChatDto` (`conversationId?` uuid, `content` ≤ 12,000 with at least one non-blank character, `language?` `pt-PT`·`en`·`es`) |
| `anthropic/anthropic.client.ts` | `listModels(apiKey)` (`GET /v1/models?limit=100` → `{ id, name, createdAt }[]`) and `streamMessage(args)` (`POST /v1/messages` with `stream: true`; parses the SSE by hand, calls `onText` on each chunk and returns the complete blocks — text and `tool_use` with the assembled JSON — and the `stop_reason`). Raw `fetch`, headers `x-api-key` and `anthropic-version: 2023-06-01`. Base URL `https://api.anthropic.com/v1`, or `ANTHROPIC_API_URL` (for tests only) |
| `helpers/aiSettings.ts` | `DEFAULT_MODEL` (`claude-sonnet-5-5`); `getAiSettings` (`{ provider, configured, keyHint, model, updatedAt }`); `savedApiKey` (decrypts; 400 "You haven't added your Claude key yet…" without a row); `saveAiSettings` (new key → tests it with `listModels` **before** saving, encrypts, stores the `keyHint`; without a key only changes the model, 400 "The API key is missing." if there's none); `listAiModels` (with the given key or the stored one) |
| `helpers/buildSystemPrompt.ts` | the instructions in English: who it is, the date, answer in the interface language (European pt-PT, never Brazilian), recommend based on the shelf, warn that "estimated" hours are averages, use `search_games` instead of guessing, and the link convention `[Name](game:<id>)`. Finally the shelf: one line per game (IGDB id, name, year, status, hours — marked if estimated —, rating, genres, dates, notes cut at 300 characters), up to **400** games, most recent first |
| `helpers/gameTools.ts` | `GAME_TOOLS` — `search_games` (`{ query }`, up to 8 results with id, year, type, genres, platforms, rating) and `get_game` (`{ id }`, summary up to 1500 characters, genres, themes, platforms, developers, ratings, average times, base game, expansions, DLCs and same series, up to 12 each); `runGameTool` runs them through the `GamesService` and returns JSON as text |
| `helpers/streamChat.ts` | one whole response (below); type `ChatEvent` (`text`, `tool`, `error`) |
| `helpers/chatRuns.ts` | `ChatRun` — one answer being written: `content`, `tools` and `error` so far, its `AbortController`, `messageId` (the pending `AiMessage`), `push(event)` (accumulates and forwards), `snapshot()`, `subscribe(listener)` (returns the unsubscribe). `ChatRuns` (injectable) — a `Map` by conversation id, at most one run each: `get(userId, id)` (only the owner's), `start`, `end` (removes it, sends the final `error` if any and `done`). Type `RunEvent` = `ChatEvent` + `snapshot` + `done` |
| `repositories/ai-settings-repository.ts` | `AiSettingsRepository` (Prisma class, no interface): `find`, `save` (upsert by `userId`), `updateModel`, `remove` (`deleteMany`) |
| `repositories/ai-chat-repository.ts` | `AiChatRepository` (Prisma class, no interface): `listConversations(userId, take)` (by `updatedAt desc`), `findConversation(userId, id)` (with the messages by `id`), `createConversation`, `addTurn` (transaction: the question, an empty `pending` answer and the conversation's `updatedAt`), `finishAnswer(id, { content, tools, error })` (`pending: false`; no tools → `DbNull`), `saveProgress` (the text so far, every 3 s while `pending`), `interruptPending` (every `pending` → `error: 'interrupted'`), `deleteConversation` (`deleteMany` by `{ id, userId }`, returns whether it existed). Type `ChatTool` |

**A question (`ask`).**

1. `savedApiKey` (no key → 400, before anything is saved).
2. With `conversationId`: finds it (404 otherwise) and, if a run is going in it, 409 "The
   assistant is still answering in this conversation.". Without it: creates the
   conversation with the title from the question (whitespace collapsed, ≤ 80 characters).
3. The history: the previous messages with text, no `error` and not `pending`, plus the
   new question, the last **40**, dropping any leading assistant message.
4. `addTurn`, `ChatRuns.start`, and `write` runs in the background (not awaited).
5. Returns `{ conversation, question, answer }`; the answer comes with `pending: true`.

**One response (`streamChat`)**, called by `write` with the key, model, language and
history.

1. Reads the shelf (`listEntries`), refreshes the facts (`refreshGameFacts`) and builds
   the instructions (`buildSystemPrompt`, with the `username` and the language).
2. Up to **6** tool rounds: `streamMessage` with `GAME_TOOLS` (on the 7th without tools,
   to force an answer), `max_tokens` 4096. Each text chunk goes out right away as
   `{ type: 'text', text }`. If it stops with `tool_use`, it emits
   `{ type: 'tool', name, query }` per tool, runs them (an error becomes a `tool_result`
   with `is_error`, it doesn't fail the response), appends the request and the results
   to the messages and goes back to Anthropic.

Errors are thrown. `write` catches them: aborted (stop or delete) keeps the text already
written, with `error: 'stopped'` only if there's none; any other error becomes the
exception's message (or a generic one). Then `finishAnswer` saves the answer (if the
conversation was deleted meanwhile, it's only logged) and `ChatRuns.end` tells the
followers.

**Following (`follow`) and the stream in the controller.** If a run is going, it sends
its `snapshot` and subscribes; otherwise it sends the last saved assistant message as a
`snapshot` (404 if the conversation isn't the user's) and `done`. On the first event the
controller sets `application/x-ndjson`, `Cache-Control: no-cache, no-transform` and
`X-Accel-Buffering: no` and calls `flushHeaders`; each event is a JSON line, a
`{ type: 'ping' }` every 20 s, and it ends the response on `done`. Closing the connection
only unsubscribes. An error before the first event (404) responds with the HTTP code and
`{ statusCode, message }`. `stop` aborts the run if there's one (it always answers
`{ message: 'Resposta parada' }`); `removeConversation` aborts it too and then deletes
(404 if it didn't exist). The list (`conversations`, up to 100) and `conversation` add
`running`, and a message being written shows the run's text so far with
`pending: true`.

**Anthropic errors** (`toHttpError`, in Portuguese):

| Situation | Exception |
|---|---|
| no network | 503 "Couldn't reach Anthropic." |
| 401 | 400 "Anthropic rejected the API key…" |
| 403 | 400 "This key doesn't have permission to use this model." |
| 404 | 400 "The chosen model doesn't exist or this key doesn't have access to it…" |
| 429 | 429 "Anthropic is rate-limiting this key's requests…" |
| 400 with "credit" | 400 "The Anthropic account has no credit…" |
| 529 or ≥ 500 | 503 "Anthropic is overloaded or unavailable…" |
| `error` event midway through the stream | 503 "Anthropic is overloaded…" (`overloaded_error`) or "Anthropic interrupted the response…" |
| other | 502 "Anthropic responded with an error (N)…" |

---

## `api-tokens/`

Each user's tokens for other programs (Settings → API). The controller is **browser
session only** (`JwtAuthGuard` + `SessionOnlyGuard`); checking a token on each request is
`auth/strategies/api-token.strategy.ts`.

| File | Role |
|---|---|
| `api-tokens.module.ts` | providers `ApiTokensService`, `PrismaApiTokenRepository`; **exports** the repository (for `ApiTokenStrategy`, which lives in `auth/`) |
| `api-tokens.controller.ts` | `GET /tokens`, `POST /tokens` (201), `DELETE /tokens/:id` |
| `api-tokens.service.ts` | `list`, `create`, `revoke` (404 when the id isn't the user's) |
| `dto/create-api-token.dto.ts` | `name` 1–60, `readOnly?`, `expiresInDays?` 1–3650 |
| `helpers/tokenSecret.ts` | `TOKEN_PREFIX` (`gtv_`), `generateToken()` (240 random bits, base64url) → `{ token, tokenHash, prefix }`, `hashToken` (SHA-256 hex) |
| `helpers/createApiToken.ts` | saves the hash, returns the view plus `token` — the only time it leaves the server |
| `helpers/mapApiToken.ts` | `{ id, name, prefix, readOnly, expiresAt, expired, lastUsedAt, createdAt }` — never the hash |
| `repositories/prisma/prisma-api-token-repository.ts` | `create`, `listByUser`, `findByHash`, `touch`, `delete` (scoped to the owner: `deleteMany({ id, userId })`) |

## `backups/`

Database backups made by the backend itself. **ADMIN only** on the controller.

| File | Role |
|---|---|
| `backups.module.ts` | providers `BackupsService`, `PrismaBackupSettingsRepository` |
| `backups.controller.ts` | `GET /backups`, `POST /backups`, `GET`/`PUT /backups/settings`, `GET /backups/:name/download` (`StreamableFile`), `DELETE /backups/:name` |
| `backups.service.ts` | `onModuleInit`: `pg_dump --version`; if it answers, a 60 s `setInterval` (`unref`) that runs the automatic backup when `isBackupDue`. `create` (one at a time: 409 while another runs), `run` (dump → prune → record `lastRun*`), `overview`, `updateSettings`, `file`, `remove` |
| `helpers/pgDump.ts` | `pgEnv(DATABASE_URL)` → `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGSSLMODE` (the password never on the command line); `pgDumpVersion()`; `dumpDatabase(target)` — `pg_dump --clean --if-exists` → gzip → `.tmp` → rename, deleting the `.tmp` on failure |
| `helpers/backupFiles.ts` | `BACKUP_FILE` (the only names touched), `defaultBackupDir()` (`BACKUP_DIR`, or `backups/` at the repo root), `listBackups`, `findBackup` (name or `latest`), `pruneBackups(dir, keepDays)` by mtime |
| `helpers/schedule.ts` | `isBackupDue`, `nextBackupAt`, `localDate`, `localTime` — local time (`TZ`) |
| `helpers/prepareDirectory.ts` | absolute path, `mkdir -p`, a test write; 400 otherwise |
| `repositories/prisma/prisma-backup-settings-repository.ts` | `get`/`update` the single row (`upsert` id 1) |

**One process.** The schedule lives in memory, like the rest of the backend (see
[02](./02-architecture.md)); with two backend processes each would make its own backup.

## Utilities

| File | Contents |
|---|---|
| `utils/password/compare.passwords.ts` | `comparePasswords({ password, hash })` with bcrypt — used by `changeOwnPassword` (`validateUser` still calls `bcrypt.compare` directly) |
| `utils/crypto/token-cipher.ts` | `encryptToken(text)` / `decryptToken(encrypted)` — AES-256-GCM, 12-byte IV, result `iv.authTag.data` in base64. The key is `TOKEN_ENCRYPTION_KEY` (base64 of 32 bytes), read on every call; without it or with a different size it throws `Error` (which gives a 500). Encrypts the IGDB secret and the Anthropic keys |
