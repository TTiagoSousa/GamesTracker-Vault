# Security policy

## Supported versions

Fixes go into the latest release. Update to it before reporting, if you can.

| Version | Supported |
|---|---|
| latest 1.x | yes |
| older | no |

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:
**[Security → Report a vulnerability](https://github.com/TTiagoSousa/GamesTracker-Vault/security/advisories/new)**.

Include what you can:

- what an attacker can do and what they need (an account? network access?);
- steps or a proof of concept;
- the affected version and install method (Docker, Proxmox, Android app).

What to expect: an acknowledgement within a week, an assessment and a plan soon after,
and a fix in a new release, with credit in the notes unless you prefer otherwise. Please
give a reasonable time for the fix before publishing details.

## Scope

In scope: the server, the web app, the Android app, the Docker image and the install
and update scripts in this repository.

Out of scope: problems that need an admin account (admins can already do everything),
installs exposed to the internet over plain http, and the third-party services the app
talks to (IGDB, Twitch, Anthropic, GitHub).

## Running it safely

- Change the default admin password straight away.
- Expose it to the internet only behind HTTPS ([docs/reverse-proxy.md](./docs/reverse-proxy.md)).
- Keep `.env` / `/etc/gametracker/gametracker.env` and the backups private: they hold
  the database password, the session secret and the key that decrypts stored API keys.
- Give other programs read-only API tokens unless they need to change things.
