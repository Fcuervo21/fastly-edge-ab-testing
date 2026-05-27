# Edge A/B Testing Framework on Fastly Compute

A zero-latency bucket allocation system that executes edge-driven split testing entirely within a Fastly Compute service — no origin server, no round-trips, no waiting.
Website: https://implicitly-grown-barnacle.edgecompute.app

---
Created by Fernando Cuervo

## Architecture & Request Flow

Every request is handled at the nearest Fastly edge POP. The Compute service parses dynamic cookies, assigns buckets, and synthesizes the full HTML response before the request ever thinks about touching an origin.

```
  Browser                    Fastly Compute (Edge POP)
  ───────                    ─────────────────────────
     │                              │
     │  GET / (Cookie: bucket=A)    │
     │─────────────────────────────▶│
     │                              │
     │                         ┌────┴─────────────────────┐
     │                         │ 1. Parse cookie header    │
     │                         │ 2. Bucket found? Use it   │
     │                         │    No bucket? Random A|B  │
     │                         │ 3. Build variant HTML     │
     │                         │ 4. Set-Cookie: bucket=X   │
     │                         └────┬─────────────────────┘
     │                              │
     │  200 OK + Set-Cookie + HTML  │       ┌──────────┐
     │◀─────────────────────────────│       │  Origin  │
     │                              │       │  (none)  │
     │         Total: <1ms          │       └──────────┘
```

**Zero origin cost.** The Compute service synthesizes the complete response — HTML, CSS, inline SVGs — at the edge. There is no backend to configure, no origin to maintain.

---

## The Problem

Traditional A/B testing tools inject client-side JavaScript that:

1. **Adds latency** — the browser downloads, parses, and executes a testing SDK before rendering the page
2. **Causes flicker** — the original content flashes before the variant loads, breaking user trust
3. **Depends on the origin** — bucket assignment happens server-side, adding a round-trip to every new-visitor request
4. **Leaks control** — third-party scripts make decisions in the browser, outside your infrastructure

For latency-sensitive pages (landing pages, checkout, product detail), these milliseconds translate directly into lost conversions.

## The Fastly Solution

This demo moves the entire A/B testing pipeline to the edge using Fastly Compute services:

| Concern | Traditional | Edge-Driven (This Demo) |
|---|---|---|
| Bucket assignment | Origin server or client-side JS | Fastly Compute service at the nearest POP |
| Decision latency | 50–200ms (network + compute) | <1ms (edge-local) |
| Cookie management | Set-Cookie from origin | Dynamic cookies set at the edge |
| HTML modification | DOM manipulation after load | Synthetic response built at edge |
| Origin load | Every request hits origin | Zero origin roundtrips |
| Flicker | Visible on slow connections | Impossible — HTML arrives pre-bucketed |

---

## How It Works

The Compute service implements a complete split testing lifecycle in a single edge worker:

**Cookie Parsing** — On every request, the `bucket` cookie is extracted from the `Cookie` header. If present, the visitor's existing assignment is honored.

**Random Allocation** — If no cookie exists (new visitor), the edge worker assigns bucket `A` or `B` with a 50/50 probability split. This zero-latency bucket allocation happens entirely in-memory at the edge POP.

**Dynamic Cookies** — The response includes a `Set-Cookie: bucket=A|B` header, persisting the assignment for 24 hours. Subsequent visits skip allocation entirely.

**Variant Rendering** — Based on the bucket, the Compute service builds a complete HTML page with variant-specific content:
- **Variant A**: Urgency-driven — red CTA button ("BUY NOW — 20% Off"), flash-sale banner, crossed-out original price
- **Variant B**: Trust-driven — dark slate CTA ("Add to Cart"), free-shipping badge, clean pricing

**Dashboard Override** — Query parameters (`?force=A`, `?force=B`, `?force=clear`) let marketers preview both variants without clearing browser state manually.

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Fastly CLI](https://developer.fastly.com/learning/tools/cli) v10+

### Setup

```bash
# Clone the repository
git clone <this-repo-url>
cd fastly-edge-ab-testing

# Install dependencies
npm install

# Start the local Compute dev server
fastly compute serve
```

The dev server starts on `http://127.0.0.1:7676`. Open it in a browser to see the A/B testing dashboard.

### Local Iteration

Edit `src/index.js` and restart the dev server. The Fastly CLI rebuilds the WASM binary automatically on each `fastly compute serve` invocation.

---

## Validation Smoke Tests

Use `curl` to verify the edge-driven split testing logic:

```bash
# 1. First visit — should randomly assign a bucket and set a cookie
curl -v http://127.0.0.1:7676/ 2>&1 | grep -E '(X-AB-|Set-Cookie)'
# Expected:
#   < X-AB-Bucket: A  (or B)
#   < X-AB-Source: Randomly assigned (new visitor)
#   < Set-Cookie: bucket=A; Path=/; Max-Age=86400; SameSite=Lax

# 2. Returning visitor — should honor existing cookie
curl -v -H "Cookie: bucket=B" http://127.0.0.1:7676/ 2>&1 | grep -E '(X-AB-)'
# Expected:
#   < X-AB-Bucket: B
#   < X-AB-Source: Persisted from existing cookie

# 3. Force variant A via dashboard
curl -v "http://127.0.0.1:7676/?force=A" 2>&1 | grep -E '(X-AB-|Set-Cookie)'
# Expected:
#   < X-AB-Bucket: A
#   < X-AB-Source: Manually forced via dashboard
#   < Set-Cookie: bucket=A; ...

# 4. Clear cookie and re-randomize
curl -v "http://127.0.0.1:7676/?force=clear" 2>&1 | grep -E '(X-AB-)'
# Expected:
#   < X-AB-Bucket: A  (or B — random)
#   < X-AB-Source: Re-randomized (cookie cleared)

# 5. Verify 404 for unknown paths
curl -o /dev/null -s -w "%{http_code}" http://127.0.0.1:7676/nope
# Expected: 404
```

---

## Production Deployment

### First Deploy

```bash
# Authenticate with Fastly (opens browser for SSO)
fastly profile create

# Deploy the Compute service
fastly compute deploy
```

The CLI will prompt you to create a new Fastly service and domain. After deployment, the service is live on the Fastly edge network — every POP worldwide serves the A/B testing logic at sub-millisecond latency.

### Subsequent Deploys

```bash
fastly compute deploy
```

The `service_id` is written to `fastly.toml` after the first deploy. Subsequent deploys target the same service.

### Verify Production

```bash
# Replace with your assigned domain
curl -v https://<your-domain>.edgecompute.app/ 2>&1 | grep -E '(X-AB-|Set-Cookie)'
```

---

## Teardown

To remove the Fastly Compute service and stop serving traffic:

```bash
# Delete the service (prompts for confirmation)
fastly service delete --service-id $(grep service_id fastly.toml | cut -d'"' -f2)

# Or, if you know the service ID
fastly service delete --service-id <SERVICE_ID>
```

To clean up locally:

```bash
rm -rf node_modules bin pkg
```

---

## Project Structure

```
fastly-edge-ab-testing/
├── src/
│   └── index.js         # Fastly Compute application — routing, cookies, HTML synthesis
├── package.json          # Node.js dependencies (@fastly/js-compute)
├── fastly.toml           # Fastly service manifest
└── README.md
```

---

Built with [Fastly Compute](https://www.fastly.com/products/compute) — edge-driven split testing without origin latency.
