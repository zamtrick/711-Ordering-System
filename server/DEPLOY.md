# Deploying the API server (Render + MongoDB Atlas)

This guide deploys the API to **Render** (free plan is fine to start) with
**MongoDB Atlas** as the database. The repo includes `render.yaml`, so you
can use Render Blueprints, or follow the dashboard path below.

> **Heads-up on the free plan:** the service sleeps after ~15 min without
> traffic and needs ~50s to wake. WebSockets (chat, live order updates)
> will disconnect on wake. Fine for demos; use a paid plan when real
> users depend on chat.

---

## Part 1 — MongoDB Atlas (database)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → sign up → **Build a Database** → choose **M0 (Free)**.
2. Pick a region close to you (e.g. **Singapore** — closest to Cebu/PH).
3. **Database Access** → **Add New Database User**:
   - Username + a strong password (save both)
   - Role: **Read and write to any database**
4. **Network Access** → **Add IP Address**:
   - For quickest setup: `0.0.0.0/0` (allow all) — acceptable for a small app since auth still protects the DB
   - Tighter option: Render's [outbound IPs](https://render.com/docs/networking#outbound-ips) (shown on your service page after creation)
5. **Database → Connect → Drivers** → copy the SRV string, e.g.:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/711
   ```
   - Replace `<user>` / `<password>` with your DB user's credentials
   - Append `/711` (or your db name) before the `?` if missing
6. Save this as `DB_URI` — you'll paste it in Part 2.

> ⚠️ **Warning:** `DB_URI` contains the DB password. Never commit it.
> Only set it in the Render dashboard.

### Seed the database

From your machine, in `server/`:

```bash
# One-time: put your real Atlas string in server/.env
#   DB_URI=mongodb+srv://... (the value from step 5 above)
node scripts/seed.js
```

The script is idempotent (skips if superadmin/branch already exist) and
reads `DB_URI` from `server/.env` — `config/env.js` **overrides** shell
env vars, so run it locally from a `.env` file rather than hoping a shell
export wins. Seed locally rather than from Render; it's a one-time job.

This creates:
- The **superadmin** account (values from `SUPERADMIN_*` in `.env`)
- The **default branch** (`MAIN001`, Cebu)

---

## Part 2 — Render (API server)

### Option A: Blueprint (uses the repo's `render.yaml`)

1. Push this branch to GitHub.
2. Render Dashboard → **New +** → **Blueprint** → select the repo.
3. Render reads `render.yaml` and asks you to fill in the `sync: false`
   values: `DB_URI`, `CORS_ORIGINS`, Cloudinary keys, SMTP (optional).
4. **Apply** — Render creates and starts the service.

### Option B: Dashboard, step by step

1. Render Dashboard → **New +** → **Web Service** → connect your GitHub repo.
2. Settings:
   | Setting | Value |
   |---|---|
   | Name | `711-api` (or anything) |
   | Root Directory | `server` |
   | Runtime | **Node** |
   | Build Command | `npm ci` |
   | Start Command | `npm start` |
   | Region | **Singapore** |
   | Instance Type | Free |
   | Health Check Path | `/api/settings/delivery-fee` |
3. **Environment** tab → add:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DB_URI` | your Atlas SRV string (Part 1, step 5) |
   | `JWT_SECRET` | long random string (`openssl rand -hex 32`) |
   | `CORS_ORIGINS` | your admin dashboard URL, e.g. `https://711-admin.vercel.app` |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from your Cloudinary console (**required** — uploads break without them) |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | optional; leave empty for log-only email |
4. **Create Web Service** → wait for the first deploy.
5. Note your API URL, e.g. `https://711-api.onrender.com`.

### Verify the deployment

```bash
# Should return JSON with the delivery fee (200)
curl https://711-api.onrender.com/api/settings/delivery-fee

# Should be {"success":false,...401...} — proves auth wiring is alive
curl https://711-api.onrender.com/api/customer/products
```

Then log into the admin dashboard pointed at this API and confirm:
- Login works (cookie is `secure` + `sameSite=none` in production — requires the HTTPS URL, which Render gives you)
- Product images upload and render (Cloudinary)
- Chat connects (Socket.IO) and orders update live

---

## Part 3 — Point clients at the API

- **Admin dashboard (Vercel):** set `VITE_API_URL=https://711-api.onrender.com/api` in Vercel's project env vars. The admin reads it in `admin/src/api/axios.ts`; add your Vercel domain to `CORS_ORIGINS` on Render.
- **Mobile apps:** replace the hardcoded LAN IP with the Render URL:
  - `customer-mobile/app.json` → `expoExtra.apiUrl`
  - `customer-mobile/api/axios.ts` → `baseURL`
  - rider-mobile equivalents (`api/axios.ts`)
  - Prefer `process.env.EXPO_PUBLIC_API_URL` over hardcoding — set it in `eas.json` or `.env` per profile.
  - Native apps send no `Origin` header, so no CORS change is needed for them.
- Keep `/uploads` legacy images working: they resolve against the API origin, so existing relative paths in the DB will serve from `https://711-api.onrender.com/uploads/...`. New uploads go to Cloudinary.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Deploy succeeds but API returns 500s | `DB_URI` wrong or Atlas Network Access blocks Render → check Atlas **Network Access**; paste SRV string carefully |
| Boot log: `Could not connect to MongoDB after 30s` | Same as above — the server fails fast on purpose |
| Admin login works but API calls 401/CORS errors | Your Vercel domain is missing from `CORS_ORIGINS` on Render |
| Cookies not sent / login loops | Must use the **https** Render URL (cookies are `secure` in production) |
| Socket.IO connects then drops repeatedly | Free plan sleep/wake — upgrade the instance or accept reconnects |
| Image upload 503 | Cloudinary env vars missing/wrong — check the Render Environment tab |
| Slow first request after idle | Free plan cold start (~50s) — expected |
