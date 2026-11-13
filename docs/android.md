# Android app

The app is a small native shell (Java, no Google Play Services, no trackers) that opens
your server's web app in a WebView. The interface always comes from the server, so new
features arrive with server updates; the APK itself changes only when the shell does.
Android 8.0 or newer.

## Install

Get the APK from any of these:

- **Your server:** Help → Android app → Download (the server publishes the APK at
  `/downloads/gametracker-vault.apk`);
- **GitHub:** the `gamestracker-vault-vX.Y.Z.apk` attached to each
  [release](https://github.com/TTiagoSousa/GamesTracker-Vault/releases).

Open the file on the phone, allow installing from that source when Android asks, and tap
**Install**.

## Connect to your server

On first launch the app asks for the server address — the one you open in the browser:

- `https://games.example.com` with a domain (recommended);
- `http://192.168.1.50:8080` (Docker) or `http://192.168.1.50` (Proxmox) on the home
  network. Plain http is allowed, so this works without certificates.

Without `http://` or `https://` the app assumes `https://`. It checks the address at
`/api/health` before saving it, and tells you if nothing answered or if the server is not
a GamesTracker Vault.

To switch servers: the account menu → **Change server**, or **Change server** on the
"cannot connect" screen.

## Updates

The app reads `/downloads/android.json` from your server when it opens. When that APK has
a higher version, it offers **Update / Later**, downloads it, checks its SHA-256 and asks
Android to install it (from Android 12 on, usually without a prompt). **Help → Check for
updates** does the same on demand.

The app and the server share version numbers. Within the same major version they always
work together; when the majors differ, the app says once per launch which one to update.

## Self-signed certificates

The app trusts the certificate authorities that come with Android **and** the ones you
install yourself. For a server with its own certificate:

1. Copy the CA certificate (`.crt` or `.pem` — the authority, not the server's own
   certificate) to the phone.
2. Settings → Security (or Security & privacy) → More security settings → Encryption &
   credentials → **Install a certificate → CA certificate**. The menu names vary by phone.
3. Open the app and connect with `https://`.

Using the IP over plain http on the home network, or a free Let's Encrypt certificate
(see [reverse-proxy.md](./reverse-proxy.md)), avoids this step.

## Builds: self-update and F-Droid

The project has two builds of the same app:

| Build | Updates | Permission to install packages |
|---|---|---|
| `selfupdate` (the published APK) | itself, from your server | yes |
| `fdroid` | through the store | no |

Building either is described in [CONTRIBUTING.md](../CONTRIBUTING.md#android-app). The
technical reference (bridge to the web app, update flow, signing) is in
[development/17-android-app.md](./development/17-android-app.md).
