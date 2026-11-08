# ATmosIQ — Sovereign India-Only Environmental Intelligence Platform

AI-powered multi-sensor environmental intelligence platform strictly restricted to the sovereign territory of the Republic of India:
- **Active Fires**: NASA FIRMS VIIRS (NOAA-20, NOAA-21, S-NPP) and MODIS near-real-time satellite detections bounded to sovereign Indian borders.
- **Atmospheric Quality**: Copernicus Atmosphere Monitoring Service (CAMS) modelled multi-pollutant reanalysis & forecast extractions (US AQI, PM2.5, PM10, NO2, SO2, CO, O3) across 58 urban centers spanning all 28 Indian States and 8 Union Territories.
- **Deforestation & Canopy Loss**: Global Forest Watch (GFW) near-real-time satellite alert ingestion across 12 high-priority Indian forest AOIs, complemented by 12 curated national protected biomes and Forest Survey of India (ISFR) canopy baselines.
- **Neural Reasoning**: Google Gemini spatial risk synthesis with deterministic offline rule-based fallback.

**Stack:** React 19 · Vite · Tailwind 4 · React Router · Leaflet / MapLibre · Motion · Express · SQLite (WAL mode) · Google Gemini

## Run locally
```bash
npm install
cp .env.example .env        # add FIRMS_MAP_KEY, GEMINI_API_KEY, GFW_API_KEY (optional for initial run)
npm run dev                 # web on :3000, API on :8080
```

Without keys the app runs with honest fallbacks: fires report explicitly-labelled **sample** data, GFW reports curated reference reserves, and AI briefs fall back to the deterministic rule-based engine.

## Production Environment Variables
| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Environment mode (`production` or `development`) | `production` |
| `PORT` | HTTP port for the unified Express server | `8080` |
| `JWT_SECRET` | Mandatory in production: HMAC SHA-256 signing key | `openssl rand -hex 32` |
| `COOKIE_SECURE` | Set `true` when behind HTTPS / TLS termination | `true` |
| `DB_PATH` | Path to persistent SQLite database file | `/data/atmosiq.db` or `./data/atmosiq.db` |
| `ADMIN_EMAILS` | Comma-separated emails assigned the `admin` role upon registration | `admin@atmosiq.gov.in` |
| `FIRMS_MAP_KEY` | NASA FIRMS API key for live VIIRS/MODIS satellite passes | `[NASA_MAP_KEY]` |
| `FIRMS_DEFAULT_SOURCE`| Satellite sensor constellation | `VIIRS_NOAA20_NRT` |
| `GEMINI_API_KEY` | Google Gemini API key for AI environmental briefs | `[AI_STUDIO_KEY]` |
| `GEMINI_MODEL` | Gemini foundation model designation | `gemini-3.8-flash` |
| `GFW_API_KEY` | Global Forest Watch Data API key | `[WRI_GFW_KEY]` |
| `GFW_API_ORIGIN` | Allowed domain origin registered in WRI Developer Portal allowlist | `http://localhost:3000` (dev) or `https://your-domain.com` (prod) |
| `GFW_SYNC_INTERVAL_MINUTES` | Frequency of background GFW satellite alert polling | `360` (every 6 hours) |

### Important Note on Global Forest Watch (GFW) Domain Allowlists
GFW API keys issued by the World Resources Institute (WRI) enforce domain origin restrictions. Ensure your deployed production domain (e.g. `https://your-domain.com`) is added to your account's allowed domain list on `data-api.globalforestwatch.org`. In development, configure `GFW_API_ORIGIN=http://localhost:3000`.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Web (:3000) and API (:8080) concurrent development |
| `npm run lint` | Strict TypeScript compilation checks for frontend and backend |
| `npm test` | Hermetic test suite (23 tests: auth, lockout, boundary checks, data routing, GFW worker) |
| `npm run build` | Full production build: client into `dist/`, server into `dist-server/` |
| `npm start` | Runs the compiled server in production mode serving static client and APIs on `:8080` |

## Deploy to Production (Docker & AWS EC2)
1. Launch Ubuntu 22.04/24.04 LTS instance with security group ports 80/443 (HTTP/HTTPS) and 22 (SSH).
2. Install Docker: `sudo apt update && sudo apt install -y docker.io git`.
3. Clone repository and configure `.env`:
   ```bash
   cp .env.example .env
   # Set JWT_SECRET, COOKIE_SECURE=true, GFW_API_ORIGIN=https://your-domain.com
   ```
4. Build and start container with persistent SQLite volume:
   ```bash
   docker build -t atmosiq .
   docker run -d --restart unless-stopped \
     --name atmosiq \
     -p 80:8080 \
     --env-file .env \
     -v atmosiq-data:/data \
     atmosiq
   ```
5. Health check endpoint: `http://<HOST>:8080/api/health`.

### Reverse Proxy Configuration (Nginx HTTPS Termination)
```nginx
server {
    listen 80;
    server_name atmosiq.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name atmosiq.example.com;

    ssl_certificate /etc/letsencrypt/live/atmosiq.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/atmosiq.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Data Provenance & Honesty Architecture
| Layer | Upstream Source | Scope & Methodology | Honesty & Attribution Guarantee |
|---|---|---|---|
| **Fires** | NASA FIRMS VIIRS & MODIS | Sovereign India Bounding Box (`68.0, 6.5, 97.5, 37.5`) | `live: true` when key is active. Explicitly marked `status: 'sample'` and `isDemo: true` when running offline. |
| **Air Quality** | Open-Meteo & Copernicus CAMS | 58 cities spanning all 28 States & 8 UTs | Modelled atmospheric composition reanalysis ($0.1^\circ$ grid extraction), NOT raw ground CAAQMS sensors. |
| **Deforestation** | Global Forest Watch (NRT) & FSI | 12 Monitored AOIs + 12 Protected Reference Biomes | 159 NRT satellite alerts ingested. Areas outside active AOIs explicitly marked unmonitored; never interpreted as zero canopy loss. |
| **AI Briefs** | Google Gemini (`gemini-3.8-flash`) | Context bounded to verified telemetry | Deterministic rule-based fallback when offline or rate-limited. |
