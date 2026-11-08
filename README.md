# ATmosIQ — Environmental Intelligence Platform

Live fires (NASA FIRMS), air quality (Open-Meteo) and forest-loss hotspots on one interactive globe, with AI risk briefs (Gemini).

**Stack:** React 19 · Vite · Tailwind 4 · React Router · MapLibre · Motion · Express · SQLite · Gemini

## Run locally
```bash
npm install
cp .env.example .env        # add FIRMS_MAP_KEY and GEMINI_API_KEY (both optional for a first run)
npm run dev                 # web on :3000, API on :8080
```
Gemini note: Google limits `gemini-2.5-*` to accounts that already used them, so the default is `gemini-3.8-flash`; override with `GEMINI_MODEL` if Google changes names again.

Without keys the app still runs: fires show clearly-labelled **sample** data and AI briefs fall back to a rule-based summary (also labelled).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Web (:3000) and API (:8080) together |
| `npm run lint` | TypeScript checks for the front end and the server |
| `npm test` | API test suite (auth, lockout, roles, data routes, AI fallback); no network or keys needed |
| `npm run build` | Production build: front end into `dist/`, compiled server into `dist-server/` |
| `npm start` | Runs the compiled server in production mode (run `npm run build` first; works on Windows too) |

CI (`.github/workflows/ci.yml`) runs lint, tests and build on every push and pull request.

**Admin role:** list emails in `ADMIN_EMAILS` (comma-separated) and they become `admin` when they sign up. Admins can call `GET /api/v1/admin/users`. Everyone else is an `analyst`.

## Data honesty
| Layer | Source | Status |
|---|---|---|
| Fires | NASA FIRMS VIIRS NRT | Live with `FIRMS_MAP_KEY`, sample otherwise |
| Air quality | Open-Meteo (CAMS) | Live, 45 cities |
| Deforestation | Curated Global Forest Watch-based list | Reference data, not live |

## Deploy to AWS (single EC2 instance)
1. Launch Ubuntu 22.04/24.04 `t3.small`+; security group: allow 22 (your IP) and 80/443 (or 8080 for a quick demo).
2. `sudo apt update && sudo apt install -y docker.io git && sudo usermod -aG docker $USER` (re-login).
3. Copy the project to the server (git clone or scp), create `.env` from `.env.example` with a real `JWT_SECRET`. If not using HTTPS yet, set `COOKIE_SECURE=false`.
4. ```bash
   docker build -t atmosiq .
   docker run -d --restart unless-stopped --name atmosiq -p 80:8080 --env-file .env -v atmosiq-data:/data atmosiq
   ```
5. Open `http://<EC2 public IP>`. Health check: `/api/health` (the image also has a Docker `HEALTHCHECK`, and runs as the unprivileged `node` user).
For HTTPS, put the instance behind an Application Load Balancer with an ACM certificate, then set `COOKIE_SECURE=true`.

## Project layout
```
src/app        router, auth context, guards, fallbacks
src/pages      route entry points
src/features   map, dashboard (feature code)
src/components landing, auth, ui
server/        Express API: auth, data, AI
```
