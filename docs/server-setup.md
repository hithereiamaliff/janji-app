# Getting your Cal.diy server ready for Janji

**No Cal.diy server yet?** Cal.diy has no hosted version, so install it first with its
[deployment guide](https://github.com/calcom/cal.diy#deployment), then come back here for API v2. If your
bookings are on Cal.com's cloud instead, use Cal.com's own app: Janji is for self-hosted Cal.diy servers.

Janji talks to your server's **Cal API v2**. The Cal.diy web app doesn't include it: API v2 is a separate
service in the Cal.diy repository (`apps/api/v2`, a NestJS app) that needs its own container and a Redis.
If `https://<your-server>/api/v2/timezones` shows the web app's "page not found", API v2 isn't running yet, and
this guide is for you.

```
Internet ── reverse proxy (cal.example.com) ──┬── /          → Cal.diy web app
                                              └── /api/v2/   → Cal API v2 ──► Redis
                                                               └── the web app's PostgreSQL database
```

## 1. Run API v2 next to the web app

Build the image from your Cal.diy checkout (`apps/api/v2/Dockerfile`), or use one your setup already builds.
Run it on the same Docker network as the web app, with the web app's `.env`, so it shares the same database,
encryption key and email settings; bookings made through the API then send the same emails and create the
same calendar events.

```yaml
  cal-redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - cal-redis-data:/data

  cal-api:
    image: your-registry/cal.diy-api:latest   # built from apps/api/v2/Dockerfile
    restart: always
    env_file: .env                            # the web app's: DATABASE_URL, NEXTAUTH_SECRET, CALENDSO_ENCRYPTION_KEY, email
    environment:
      - NODE_ENV=production
      - API_PORT=80
      - API_URL=https://cal.example.com/api
      - WEB_APP_URL=https://cal.example.com
      - DATABASE_READ_URL=${DATABASE_URL}
      - DATABASE_WRITE_URL=${DATABASE_URL}
      - REDIS_URL=redis://cal-redis:6379
      - JWT_SECRET=${CAL_API_JWT_SECRET}      # openssl rand -hex 32, kept in .env
      - API_KEY_PREFIX=cal_                   # keep the default; see "Known limits"
      - STRIPE_API_KEY=sk_test_unused         # required at startup even without Stripe billing
      - STRIPE_WEBHOOK_SECRET=whsec_unused
    ports:
      - "127.0.0.1:5555:80"                   # only the reverse proxy reaches it
    depends_on:
      - cal-redis

volumes:
  cal-redis-data:
```

Wait for "Application started" in its logs, then `curl -s http://127.0.0.1:5555/health` should answer `OK`.

## 2. Route `/api/v2/` to it

API v2 serves its routes under `/api/v2` itself, so the path is passed through unchanged. With nginx, inside the
web app's `server` block:

```nginx
location /api/v2/ {
    proxy_pass http://127.0.0.1:5555;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

With Caddy:

```caddy
cal.example.com {
    handle /api/v2/* {
        reverse_proxy 127.0.0.1:5555
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

If API v2 lives at another address instead, enter that under **Advanced** when you sign in to Janji.

## 3. Check it

```sh
curl -s https://cal.example.com/api/v2/timezones
```

should answer `{"status":"success",…}`. That's the same check Janji makes when you enter your server's address.

## 4. Make an API key for Janji

In the web app: **Settings → Developer → API keys → New**. Name it after your phone, such as "Janji – Pixel", and
choose **Never expires**: Cal.diy can't renew a key, so one that expires signs Janji out, and you'd have to make
another. You can delete the key at any time, which signs that phone out.

Janji opens this page for you when you sign in, and keeps the key in the phone's Keychain or Keystore.

## Known limits

- **Only `cal_` keys work.** API v2 reads the key prefix from a setting that doesn't exist, so it always assumes
  `cal_`, whatever `API_KEY_PREFIX` says. Keep the default prefix on the web app too.
- **Redis TLS errors** at startup mean the API is trying TLS against a plain Redis: upstream turns TLS on for
  Bull's Redis connection whenever `NODE_ENV=production`. Use a Redis that speaks TLS, or build the image with
  that made optional.
- **API v2 allows 120 requests a minute per key.** Janji keeps well under it by reusing what it has loaded.

## Troubleshooting

| What you see                                     | What to do                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Janji says the server isn't Cal API v2           | `/api/v2/timezones` isn't reaching API v2: check the proxy route and reload it                                                             |
| `Missing environment variable` in the API's logs | Add it: `JWT_SECRET`, `REDIS_URL`, `DATABASE_READ_URL`, `DATABASE_WRITE_URL`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXTAUTH_SECRET` |
| Janji says the key isn't valid                   | The key was deleted or expired, or the web app uses another `API_KEY_PREFIX`                                                               |
| Bookings made in Janji send no emails            | The API container is missing the web app's settings: give it the same `.env`                                                               |
