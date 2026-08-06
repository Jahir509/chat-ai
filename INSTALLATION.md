# Installation

Three ways to run ChatAI. Pick one:

| Path | Use when | Time |
|---|---|---|
| [Docker (recommended)](#option-a--docker) | You just want it running | ~5 min |
| [Native](#option-b--native) | You're developing on it | ~10 min |
| [Production on a VPS](#production-deployment) | Deploying for real | ~20 min |

**Prerequisites:** an [OpenAI API key](https://platform.openai.com/api-keys). Docker Compose v2 for option A; Python 3.12+, Node 20+, and PostgreSQL 15+ for option B.

---

## Option A — Docker

```bash
git clone https://github.com/YOUR_USER/chat-ai.git
cd chat-ai
cp .env.example .env.development
```

Edit `.env.development` and set `OPENAI_API_KEY`. The rest of the defaults work as-is:

```dotenv
WEB_BIND=127.0.0.1:8080
SITE_ADDRESS=:80

DEBUG=True
USE_HTTPS=False
DJANGO_SECRET_KEY=dev-only-not-secret
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:8080

POSTGRES_DB=chatbot_platform
POSTGRES_USER=chatbot
POSTGRES_PASSWORD=chatbot
DATABASE_URL=postgres://chatbot:chatbot@db:5432/chatbot_platform

OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

```bash
docker compose --env-file .env.development up -d --build
docker compose --env-file .env.development exec backend python manage.py createsuperuser
```

Open **http://localhost:8080**.

If port 8080 is taken, change `WEB_BIND` to any free port and update the port in `CSRF_TRUSTED_ORIGINS` to match.

<details>
<summary>Useful commands</summary>

```bash
docker compose --env-file .env.development logs -f backend   # follow logs
docker compose --env-file .env.development ps                # container status
docker compose --env-file .env.development down              # stop
docker compose --env-file .env.development down -v           # stop and wipe the database
docker compose --env-file .env.development exec db psql -U chatbot -d chatbot_platform
```

Typing `--env-file` every time is error-prone. A `Makefile` at the repo root helps:

```make
dev:       ; docker compose --env-file .env.development up -d --build
dev-logs:  ; docker compose --env-file .env.development logs -f
dev-down:  ; docker compose --env-file .env.development down
prod:      ; docker compose --env-file .env.production up -d --build
prod-logs: ; docker compose --env-file .env.production logs -f
```

</details>

---

## Option B — Native

Faster edit-reload cycle, which matters while developing.

### 1. Database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE chatbot_platform;
CREATE USER chatbot WITH PASSWORD 'chatbot';
ALTER ROLE chatbot SET client_encoding TO 'utf8';
ALTER ROLE chatbot SET timezone TO 'UTC';
\c chatbot_platform
GRANT ALL ON SCHEMA public TO chatbot;
ALTER SCHEMA public OWNER TO chatbot;
ALTER DATABASE chatbot_platform OWNER TO chatbot;
```

> **PostgreSQL 15+:** `GRANT ALL PRIVILEGES ON DATABASE` does **not** grant the right to create tables — schema privileges are separate, and they are per-database, so they must be granted while connected to the target database (`\c` above). Skipping this produces `permission denied for schema public` on the first migration.

Verify:

```sql
SELECT has_schema_privilege('chatbot', 'public', 'CREATE');   -- must be t
\q
```

### 2. Backend

```bash
cd chat-ai
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```dotenv
DEBUG=True
USE_HTTPS=False
DJANGO_SECRET_KEY=dev-only-not-secret
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://chatbot:chatbot@localhost:5432/chatbot_platform
CORS_ALLOWED_ORIGINS=http://localhost:5173
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API on http://127.0.0.1:8000, docs at `/api/docs/`.

### 3. Frontend

```bash
cd ../frontend
npm install
npm run dev
```

App on **http://localhost:5173**. Vite proxies `/api` to the backend, so there is no CORS setup in development.

<details>
<summary>Hybrid: containerised database, native servers</summary>

Best of both — reproducible Postgres, fast reloads:

```bash
docker compose --env-file .env.development up -d db
```

Add a host port mapping to the `db` service in `docker-compose.yml`:

```yaml
    ports:
      - "127.0.0.1:5433:5432"
```

Then point `backend/.env` at it:

```dotenv
DATABASE_URL=postgres://chatbot:chatbot@localhost:5433/chatbot_platform
```

`localhost:5433` from the host, `db:5432` from inside a container — same database, different address depending on where you're standing.

</details>

---

## Production deployment

Assumes a Linux VPS with Docker. The stack binds to **loopback only**, so it coexists with anything already using ports 80 and 443.

### 1. Clone and configure

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/YOUR_USER/chat-ai.git && cd chat-ai
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # copy this
nano .env.production
```

```dotenv
WEB_BIND=127.0.0.1:8083
SITE_ADDRESS=:80

DEBUG=False
USE_HTTPS=True
DJANGO_SECRET_KEY=<the generated value>
ALLOWED_HOSTS=your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com

POSTGRES_DB=chatbot_platform
POSTGRES_USER=chatbot
POSTGRES_PASSWORD=<strong random password>
DATABASE_URL=postgres://chatbot:<same password>@db:5432/chatbot_platform

OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

Three things that cause real failures if you get them wrong:

- **`SITE_ADDRESS` must be `:80`**, not your domain. This is Caddy's address *inside* the container. Set it to a hostname and Caddy tries to manage TLS itself, issuing a 308 redirect to the URL it's already on — an infinite loop.
- **`WEB_BIND` is `host:port`**, mapped to port 80 in the container. Loopback keeps it private behind nginx.
- **The password appears twice.** `POSTGRES_PASSWORD` and the one inside `DATABASE_URL` must match exactly.

Check for duplicate keys before starting — later definitions silently win:

```bash
grep -oP '^[A-Z_]+(?==)' .env.production | sort | uniq -d     # must print nothing
sed -i 's/\r$//' .env.production                              # strip any CRLF
```

### 2. Start the stack

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production logs -f
```

Expect, in order: `database system is ready`, migrations applying, `Listening at: http://0.0.0.0:8000`, Caddy starting.

```bash
docker compose --env-file .env.production exec backend python manage.py createsuperuser
curl -sI http://127.0.0.1:8083 | head -1     # HTTP/1.1 200 OK
```

Do not continue until that returns `200`. A `308` means `SITE_ADDRESS` is wrong — fix it, then `up -d --force-recreate web`.

### 3. nginx

```bash
sudo nano /etc/nginx/sites-available/chat-ai
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name your-domain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Uploads go up to 20 MB; nginx defaults to 1 MB
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8083;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Chat replies can take a minute; default is 60s
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    access_log /var/log/nginx/chat-ai-access.log;
    error_log  /var/log/nginx/chat-ai-error.log;
}
```

`client_max_body_size` and `proxy_read_timeout` are not boilerplate — without them, document uploads fail with 413 and slow replies fail with 504.

```bash
sudo ln -s /etc/nginx/sites-available/chat-ai /etc/nginx/sites-enabled/chat-ai
sudo nginx -t && sudo systemctl reload nginx
```

> On nginx < 1.25, `http2 on;` is not a valid directive — append `http2` to the `listen 443 ssl` line instead, or omit it.

### 4. TLS certificate

**Let's Encrypt** (if the domain points directly at the server):

```bash
sudo apt install -y python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**Behind Cloudflare**, use an Origin Certificate instead — SSL/TLS → Origin Server → Create Certificate. Save the two blocks on the server, point `ssl_certificate` / `ssl_certificate_key` at them, and set the encryption mode to **Full (strict)**. Valid for 15 years, no renewal, and the proxy stays enabled the whole time.

> Do **not** use Cloudflare's **Flexible** mode with the HTTP→HTTPS redirect above: Cloudflare calls your origin over HTTP, nginx redirects to HTTPS, Cloudflare follows it back to itself, and you get `ERR_TOO_MANY_REDIRECTS`.

### 5. Verify

```bash
curl -sI https://your-domain.com | head -3                                  # 200
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.com/api/projects/   # 401
curl -sI --max-time 5 http://YOUR_VPS_IP:8083                               # must refuse
```

Then in a browser, in this order — each step tests a different link in the chain:

1. Register an account
2. Create a project, add a system prompt
3. Send a message → reply arrives *(first call to OpenAI)*
4. Refresh on `/projects/{uuid}` → still loads *(SPA fallback)*
5. Upload a ~1 MB document → reaches **Ready** *(`client_max_body_size`)*
6. Log into `/admin/` → *(forwarded-scheme chain)*

### Redeploying

```bash
cd ~/apps/chat-ai
git pull
docker compose --env-file .env.production up -d --build
```

Migrations and `collectstatic` run automatically in the entrypoint.

> `docker compose down -v` deletes volumes for the project in **the current directory**. Check `pwd` before typing it on a server running other stacks.

---

## Environment reference

| Variable | Required | Example | Purpose |
|---|:---:|---|---|
| `DEBUG` | | `False` | Never `True` in production |
| `USE_HTTPS` | | `True` | Enables secure cookies and HSTS. Set `False` when serving over plain HTTP, or admin login will fail silently |
| `DJANGO_SECRET_KEY` | ✅ | `<50 random chars>` | Signs tokens and cookies |
| `ALLOWED_HOSTS` | ✅ | `your-domain.com` | Host header allowlist (comma-separated, no ports) |
| `CSRF_TRUSTED_ORIGINS` | ✅ | `https://your-domain.com` | Full origins **including port** if non-standard |
| `DATABASE_URL` | ✅ | `postgres://u:p@db:5432/chatbot_platform` | Use `db` as the host inside Compose |
| `POSTGRES_DB` / `_USER` / `_PASSWORD` | ✅ | — | Consumed by the `db` container on first start |
| `WEB_BIND` | ✅ | `127.0.0.1:8083` | Host interface and port for the web container |
| `SITE_ADDRESS` | ✅ | `:80` | Caddy's address *inside* the container — keep as `:80` |
| `OPENAI_API_KEY` | ✅ | `sk-...` | Server-side only; never reaches the browser |
| `OPENAI_DEFAULT_MODEL` | | `gpt-4o-mini` | Default for newly created projects |
| `CORS_ALLOWED_ORIGINS` | | `http://localhost:5173` | Development only; unused in production |

---

## Troubleshooting

<details>
<summary><strong><code>permission denied for schema public</code> on first migrate</strong></summary>

PostgreSQL 15+ separates database privileges from schema privileges. Connect **to the target database** and grant there:

```sql
\c chatbot_platform
GRANT ALL ON SCHEMA public TO chatbot;
ALTER SCHEMA public OWNER TO chatbot;
```

Running the grant while connected to the `postgres` database applies it to the wrong schema.

</details>

<details>
<summary><strong><code>ValueError: Dependency on app with no migrations: users</code></strong></summary>

`runserver` and `migrate` both build the migration graph and fail when a swappable-model app has no migrations. `makemigrations` doesn't:

```bash
python manage.py makemigrations users
python manage.py migrate
```

If it reports "No changes detected", check that `apps/users/apps.py` has `name = "apps.users"` — `startapp` writes just `"users"` when the app lives inside a package.

</details>

<details>
<summary><strong>Infinite redirect loop / 308 to the same URL</strong></summary>

Caddy is trying to manage TLS. Confirm what the container actually received:

```bash
docker compose --env-file .env.production exec web sh -c 'echo "$SITE_ADDRESS"'
```

It must print `:80`. If it prints a hostname, check for a duplicate key — the later line wins:

```bash
grep -n SITE_ADDRESS .env.production
```

Delete the extra by line number (`sed -i '17d' .env.production`); pattern-based deletion misses lines with trailing whitespace. Then:

```bash
docker compose --env-file .env.production up -d --force-recreate web
```

`up -d` alone does not always recreate a container after an env change. If the browser still loops, test in a private window — 308s are cached hard.

</details>

<details>
<summary><strong><code>password authentication failed for user "chatbot"</code></strong></summary>

PostgreSQL reads `POSTGRES_PASSWORD` **only** when initialising an empty data directory. Changing it later has no effect on an existing volume.

```bash
docker compose --env-file .env.production down -v      # check pwd first!
docker compose --env-file .env.production up -d --build
```

To keep the data instead:

```bash
docker compose --env-file .env.production exec db \
  psql -U postgres -c "ALTER USER chatbot WITH PASSWORD 'the-password-from-env';"
docker compose --env-file .env.production restart backend
```

</details>

<details>
<summary><strong>Cloudflare error 526 or ERR_TOO_MANY_REDIRECTS</strong></summary>

- **526** — Cloudflare is on Full (strict) but your origin has no valid certificate. Install a Cloudflare Origin Certificate, or grey-cloud the DNS record temporarily and run certbot.
- **ERR_TOO_MANY_REDIRECTS** — Cloudflare is on **Flexible** while nginx redirects HTTP to HTTPS. Switch to **Full (strict)**.

</details>

<details>
<summary><strong>413 on file upload</strong></summary>

nginx caps request bodies at 1 MB by default. Add `client_max_body_size 25M;` to the server block and reload.

</details>

<details>
<summary><strong>502 or 504 on chat messages</strong></summary>

Something in the chain has a timeout below gunicorn's 120s. Check `proxy_read_timeout` in nginx. Behind Cloudflare, the free-plan limit is 100 seconds and cannot be raised — a model that slow needs streaming.

</details>

<details>
<summary><strong>A file stays "Indexing…" and the client polls forever</strong></summary>

The list endpoint refreshes pending rows from OpenAI and marks anything pending for over five minutes as `failed`. If polling never stops, that refresh isn't running:

```bash
grep -n "STALE_AFTER" backend/apps/files/views.py
```

To see the real upstream status:

```bash
python manage.py shell
```

```python
from apps.projects.models import Project
from apps.llm.client import get_client
p = Project.objects.get(name="Your Project")
for i in get_client().vector_stores.files.list(vector_store_id=p.vector_store_id).data:
    print(i.id, i.status, getattr(i, "last_error", None))
```

A `server_error` there is OpenAI failing to index that specific document, not an application bug.

</details>

<details>
<summary><strong>Page renders unstyled</strong></summary>

Tailwind isn't in the build. All three must be present:

```bash
grep -n 'tailwindcss' frontend/vite.config.js     # plugin registered
head -1 frontend/src/index.css                    # @import "tailwindcss";
grep -n 'index.css' frontend/src/main.jsx         # imported
```

Restart the dev server after editing `vite.config.js` — server config is not hot-reloaded.

</details>

<details>
<summary><strong><code>DisallowedHost</code> in the backend logs</strong></summary>

Add the hostname to `ALLOWED_HOSTS` (comma-separated, **no** scheme or port), then recreate the backend container.

</details>

<details>
<summary><strong>Port already in use</strong></summary>

```bash
sudo ss -tlnp | grep -E ':(80|443|8080|8083)\s'
```

Change `WEB_BIND` to any free port. Nothing else in the stack publishes a host port.

</details>