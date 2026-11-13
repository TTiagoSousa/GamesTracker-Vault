# Domain and HTTPS (reverse proxy)

Put a reverse proxy in front of the app to open it at `https://games.example.com`. The
proxy terminates HTTPS and forwards plain HTTP to the app:

| Install | Upstream |
|---|---|
| Docker | `http://<docker host>:8080` (or `http://app:3000` from the same compose network) |
| Proxmox | `http://<container IP>:80` |

Three things matter for every proxy:

1. **Send `X-Forwarded-Proto`.** The server marks the session cookie `secure` only when the
   browser used HTTPS, and it learns that from this header. Without it, logins over HTTPS
   still work, but the cookie is not marked secure.
2. **Trust the proxy.** The header is only believed from trusted addresses (`TRUST_PROXY`,
   see [configuration.md](./configuration.md)). The Docker default trusts private
   networks; the Proxmox install trusts its own nginx, which passes the header on.
3. **Do not buffer `/api/ai/chat`.** The assistant streams its answers (Server-Sent
   Events). Turn proxy buffering off and allow long reads (up to an hour).

Uploads (imports, images) can be large: allow request bodies of at least 300 MB.

After adding the domain, set the app address: `APP_URL` in `.env` (Docker) or
`gametracker-config` → App address (Proxmox).

## Nginx Proxy Manager

1. **Hosts → Proxy Hosts → Add Proxy Host.**
2. Domain: `games.example.com`. Scheme `http`, Forward Hostname/IP the Docker host or the
   container, port `8080` (Docker) or `80` (Proxmox).
3. Turn on **Websockets Support** and **Block Common Exploits**.
4. **SSL** tab: request a Let's Encrypt certificate, turn on **Force SSL** and **HTTP/2**.
5. **Advanced** tab:

   ```nginx
   client_max_body_size 300m;
   proxy_buffering off;
   proxy_read_timeout 1h;
   ```

Nginx Proxy Manager already sends `X-Forwarded-Proto`.

## Caddy

```caddy
games.example.com {
    reverse_proxy 192.168.1.50:8080 {
        flush_interval -1
        transport http {
            read_timeout 1h
        }
    }
    request_body {
        max_size 300MB
    }
}
```

Caddy gets the certificate by itself and sends `X-Forwarded-Proto`.

## Traefik (Docker labels)

Add the app to Traefik's network and these labels to the `app` service in
`docker-compose.yml`:

```yaml
    labels:
      - traefik.enable=true
      - traefik.http.routers.gamestracker.rule=Host(`games.example.com`)
      - traefik.http.routers.gamestracker.entrypoints=websecure
      - traefik.http.routers.gamestracker.tls.certresolver=letsencrypt
      - traefik.http.services.gamestracker.loadbalancer.server.port=3000
    networks:
      - default
      - traefik
```

```yaml
networks:
  traefik:
    external: true
```

Traefik streams responses and sends `X-Forwarded-Proto` by default. If Traefik's network
is not a private range, set `TRUST_PROXY` to its subnet.

## Plain nginx

```nginx
server {
    listen 443 ssl http2;
    server_name games.example.com;
    # ssl_certificate / ssl_certificate_key …

    client_max_body_size 300m;

    location / {
        proxy_pass http://192.168.1.50:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

## Self-signed certificates

Browsers will warn, and the Android app only accepts the certificate once its CA is
installed on the phone: see [android.md](./android.md#self-signed-certificates). A free
Let's Encrypt certificate (through any of the proxies above, or a DNS challenge for
servers that are not reachable from the internet) avoids all of that.
