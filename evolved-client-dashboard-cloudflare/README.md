# V10 — Full performance story

Restores the large Sales and TACOS charts above the premium Traffic & Conversion section. The dashboard remains a single scrollable page: high-level financial performance first, then traffic/conversion drivers, then inventory and tools.

# V9 — Single-page premium redesign

This version keeps the client experience to one scrollable page while borrowing the premium visual language of the approved concept: modular KPI cards with sparklines, a dark Traffic & Conversion showcase, inventory health visualization, refill priorities, and client tools.

Brand system remains Evolved Commerce: Montserrat, charcoal/slate, orange, gold, neutral gray, and off-white.

# V5 - Request Center

The Request Work modal now has structured forms for Design, Copy, Promotion, and New Product Upload.

New Product Upload includes platform-specific flows for Amazon, Walmart, TikTok Shop, and Target Plus, downloadable starter CSV templates, fulfillment/compliance fields, and bulk/variation data-sheet support. The form serializes all entered data into the ClickUp task description.

# V3 - Brand-aligned dashboard + replenishment export

This version uses the official Evolved Commerce palette and Montserrat typography from the supplied brand guide, adds the official logo, and adds a client-downloadable replenishment CSV containing the complete actionable inventory list.

# V2 DESIGN NOTE

This version removes subjective health/action labels from the client-facing UI and presents neutral metric comparisons instead.

# Evolved Commerce Client Dashboard — Cloudflare Pilot

This is the first deployable Anchor Strap dashboard prototype.

## What works immediately

- Responsive client dashboard
- Real Anchor Strap seed data from the Strategy Doc Dashboard Export
- Account Health
- Total Sales, Ad Sales, Ad Spend, ROAS, TACOS
- Sales and TACOS trend charts
- Wins / Current Focus / Watching
- Top products
- Inventory watch
- Definitions
- Work Request UI
- Subdomain-aware client slug (`anchorstrap.evolvedcommerce.com` -> `anchorstrap`)

The prototype can deploy before a database is configured. It falls back to:
`public/data/anchorstrap.json`.

## Recommended pilot architecture

Strategy Doc -> Dashboard Export -> Worker API -> Cloudflare D1 -> Dashboard

This stays inside Cloudflare and can remain on the Free tier for a small pilot.

## Fastest way to see it live

### Option A: GitHub + Cloudflare dashboard

1. Create a new GitHub repository, for example `evolved-client-dashboard`.
2. Upload the contents of this folder to the repository.
3. In Cloudflare, create a new Worker and connect/import the GitHub repository.
4. The project uses `wrangler.jsonc`; static assets live in `public/` and Worker code is in `src/index.js`.
5. Deploy.
6. Open the generated `*.workers.dev` URL.

At this point the dashboard works using the included Anchor Strap seed snapshot.

### Option B: Wrangler from your computer

Install Node.js, then from this project folder:

    npm install
    npx wrangler login
    npm run deploy

## Protect the prototype

Before sharing real client data, set a prototype password:

    npx wrangler secret put PORTAL_PASSWORD

The username will be:

    client

The password will be whatever secret you enter.

For production, replace this simple pilot protection with Cloudflare Access or your final client-auth system.

## Turn on live daily data

### 1. Create D1

    npx wrangler d1 create evolved-client-dashboard

Cloudflare will return a database ID.

### 2. Add the D1 binding

Copy the `d1_databases` block from `wrangler.with-d1.example.jsonc` into `wrangler.jsonc`
and replace `REPLACE_WITH_D1_DATABASE_ID`.

### 3. Create the tables

    npx wrangler d1 execute evolved-client-dashboard --remote --file=./schema.sql

### 4. Add an ingestion secret

    npx wrangler secret put DASHBOARD_INGEST_TOKEN

Use a long random value.

### 5. Point the Strategy Doc exporter to this Worker

Once deployed, your API endpoint will be:

    https://YOUR-WORKER.workers.dev/api/dashboard

Then set the Strategy Doc Dashboard Export config:

    DASHBOARD_API_URL = https://YOUR-WORKER.workers.dev/api/dashboard
    DASHBOARD_PUSH_ENABLED = TRUE

The Apps Script dashboard exporter should POST its machine-readable JSON payload to that endpoint
with:

    Authorization: Bearer YOUR_DASHBOARD_INGEST_TOKEN

Do not put the token in a spreadsheet cell. Keep it in Apps Script Properties.

## Custom domain

After the Workers URL looks right, add:

    anchorstrap.evolvedcommerce.com

as a Worker custom domain/route in Cloudflare.

The frontend automatically sees the hostname and loads the `anchorstrap` tenant.

## ClickUp work requests

The Worker already contains optional ClickUp task creation. Add these as Worker secrets/variables when ready:

    CLICKUP_API_TOKEN

And one List ID per request type:

    CLICKUP_LIST_DESIGN
    CLICKUP_LIST_COPY
    CLICKUP_LIST_PROMOTION
    CLICKUP_LIST_NEW_PRODUCT_UPLOAD

Optional assignee IDs:

    CLICKUP_ASSIGNEE_DESIGN
    CLICKUP_ASSIGNEE_COPY
    CLICKUP_ASSIGNEE_PROMOTION
    CLICKUP_ASSIGNEE_NEW_PRODUCT_UPLOAD

Until these are configured, the form remains usable as a prototype and can store requests in D1.
If D1 is not configured yet, the browser saves the prototype submission locally instead.

## Files

- `public/index.html` — dashboard markup
- `public/styles.css` — styling
- `public/app.js` — rendering, charts, work-request modal
- `public/data/anchorstrap.json` — current pilot seed snapshot
- `src/index.js` — Worker API + static hosting + optional ClickUp integration
- `schema.sql` — D1 tables
- `wrangler.jsonc` — deploy config without D1 (works immediately)
- `wrangler.with-d1.example.jsonc` — example D1 binding
