/// <reference types="@fastly/js-compute" />

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const [key, ...vals] = pair.trim().split("=");
    if (key) cookies[key.trim()] = vals.join("=").trim();
  });
  return cookies;
}

async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname === "/favicon.ico") {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#ff282d"/><text x="50" y="72" font-size="60" text-anchor="middle" fill="#fff" font-family="system-ui" font-weight="700">AB</text></svg>`,
      { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } }
    );
  }

  if (url.pathname !== "/") {
    return new Response("Not Found", { status: 404 });
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);

  let bucket = cookies.bucket;
  if (bucket !== "A" && bucket !== "B") {
    bucket = undefined;
  }
  let cookieDetected = !!bucket;
  let source;
  const forceParam = url.searchParams.get("force");

  if (forceParam === "A") {
    bucket = "A";
    source = "Manually forced via dashboard";
  } else if (forceParam === "B") {
    bucket = "B";
    source = "Manually forced via dashboard";
  } else if (forceParam === "clear") {
    bucket = Math.random() < 0.5 ? "A" : "B";
    source = "Re-randomized (cookie cleared)";
    cookieDetected = false;
  } else if (bucket) {
    source = "Persisted from existing cookie";
  } else {
    bucket = Math.random() < 0.5 ? "A" : "B";
    source = "Randomly assigned (new visitor)";
    cookieDetected = false;
  }

  const html = buildPage(bucket, source, cookieDetected);

  const response = new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-AB-Bucket": bucket,
      "X-AB-Source": source,
    },
  });

  response.headers.set(
    "Set-Cookie",
    `bucket=${bucket}; Path=/; Max-Age=86400; SameSite=Lax`
  );

  return response;
}

function buildPage(bucket, source, cookieDetected) {
  const isA = bucket === "A";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edge A/B Testing | Fastly Compute</title>
  <link rel="icon" href="/favicon.ico" type="image/svg+xml">
  <style>
    :root {
      --white: #ffffff;
      --charcoal: #1a1a24;
      --red: #ff282d;
      --gray-50: #fafafa;
      --gray-100: #f5f5f7;
      --gray-200: #e5e5e7;
      --gray-300: #d1d1d6;
      --gray-500: #8e8e93;
      --green: #00a862;
      --slate: #2d3142;
      --red-light: #fff0f0;
      --green-light: #edf9f3;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: var(--white);
      color: var(--charcoal);
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .wrapper {
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 20px;
      border-bottom: 1px solid var(--gray-200);
      flex-shrink: 0;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-icon {
      width: 30px;
      height: 30px;
      background: var(--red);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-icon svg { width: 16px; height: 16px; }

    .logo-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .logo-sub {
      font-size: 10px;
      color: var(--gray-500);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .badge-a { background: var(--red-light); color: var(--red); }
    .badge-b { background: var(--green-light); color: var(--green); }

    /* ── 3-Column Grid ── */
    .main {
      display: grid;
      grid-template-columns: 240px 1fr 300px;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Column 1: Control Panel ── */
    .panel {
      padding: 14px 16px;
      border-right: 1px solid var(--gray-200);
      background: var(--gray-50);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .section-tag {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--gray-500);
      font-weight: 600;
      margin-bottom: 3px;
    }

    .panel h2 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .panel-desc {
      font-size: 11px;
      color: var(--gray-500);
      line-height: 1.45;
      margin-bottom: 14px;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1.5px solid var(--gray-200);
      background: var(--white);
      text-decoration: none;
      color: var(--charcoal);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-bottom: 5px;
    }

    .btn:hover {
      border-color: var(--gray-300);
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    .btn.active {
      border-color: var(--red);
      background: var(--red-light);
    }

    .btn-dot {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: var(--gray-100);
      color: var(--gray-500);
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .btn.active .btn-dot {
      background: var(--red);
      color: var(--white);
    }

    .btn-clear { margin-top: 2px; }
    .btn-clear .btn-dot { font-size: 14px; }

    .status {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--gray-200);
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .status-label {
      font-size: 11px;
      color: var(--gray-500);
    }

    .status-val {
      font-size: 11px;
      font-weight: 600;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }

    /* ── Column 2: Storefront ── */
    .store {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px 20px;
      overflow: hidden;
    }

    .store-head {
      text-align: center;
      margin-bottom: 14px;
    }

    .store-head h2 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .store-head p {
      font-size: 11px;
      color: var(--gray-500);
    }

    .card {
      width: 100%;
      max-width: 300px;
      border: 1px solid var(--gray-200);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      background: var(--white);
    }

    .card-img {
      background: linear-gradient(135deg, var(--gray-100) 0%, #eeeef0 100%);
      padding: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .card-img svg { width: 72px; height: 72px; }

    .urgency {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--red);
      color: var(--white);
      text-align: center;
      padding: 6px 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.82; }
    }

    .card-body { padding: 14px 16px; }

    .card-name {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 1px;
    }

    .card-sub {
      font-size: 11px;
      color: var(--gray-500);
      margin-bottom: 10px;
    }

    .price {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 12px;
    }

    .price-old {
      font-size: 13px;
      color: var(--gray-500);
      text-decoration: line-through;
    }

    .price-now {
      font-size: 22px;
      font-weight: 700;
    }

    .price-now.red { color: var(--red); }

    .cta {
      display: block;
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      letter-spacing: 0.3px;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }

    .cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.15);
    }

    .cta-red { background: var(--red); color: var(--white); }
    .cta-slate { background: var(--slate); color: var(--white); }

    .ship-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 10px;
      padding: 5px 10px;
      background: var(--green-light);
      color: var(--green);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }

    .ship-badge svg { width: 12px; height: 12px; flex-shrink: 0; }

    /* ── Column 3: Right Panel ── */
    .right-col {
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--gray-200);
      background: var(--gray-50);
      overflow: hidden;
    }

    /* ── Lifecycle Visualizer (top of right col) ── */
    .lifecycle {
      padding: 14px 16px 10px;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .lc-head { margin-bottom: 12px; }

    .lc-head h3 {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 1px;
    }

    .lc-head p {
      font-size: 10px;
      color: var(--gray-500);
    }

    .lc-flow-v {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    .lc-v-node {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border: 1.5px solid var(--gray-200);
      border-radius: 8px;
      background: var(--white);
      width: 100%;
    }

    .lc-v-icon {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-100);
      flex-shrink: 0;
    }

    .lc-v-icon svg { width: 14px; height: 14px; }

    .lc-v-title {
      font-size: 11px;
      font-weight: 700;
    }

    .lc-v-detail {
      font-size: 9px;
      color: var(--gray-500);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }

    .lc-v-arrow {
      color: var(--gray-300);
      font-size: 14px;
      padding: 3px 0;
      text-align: center;
    }

    .lc-v-edge {
      flex-direction: column;
      align-items: stretch;
      border-color: var(--red);
      border-width: 2px;
      padding: 10px 12px;
    }

    .lc-v-edge-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .lc-v-edge .lc-v-icon {
      background: var(--red);
    }

    .lc-v-edge .lc-v-icon svg { stroke: var(--white); }

    .lc-v-steps {
      display: flex;
      gap: 3px;
      align-items: center;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .lc-v-step {
      font-size: 8px;
      padding: 2px 6px;
      background: var(--gray-100);
      border-radius: 3px;
      color: var(--gray-500);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-weight: 500;
    }

    .lc-v-step-arrow {
      font-size: 9px;
      color: var(--gray-300);
    }

    .lc-v-fork {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .lc-v-path {
      flex: 1;
      border: 1.5px solid var(--gray-200);
      border-radius: 6px;
      padding: 6px 8px;
      background: var(--white);
      opacity: 0.4;
      transition: all 0.25s ease;
    }

    .lc-v-path.active {
      border-color: var(--red);
      background: var(--red-light);
      opacity: 1;
      box-shadow: 0 0 12px rgba(255, 40, 45, 0.1);
    }

    .lc-v-path-lbl {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--gray-500);
    }

    .lc-v-path.active .lc-v-path-lbl { color: var(--red); }

    .lc-v-path-name {
      font-size: 10px;
      font-weight: 600;
    }

    .lc-v-blocked {
      margin-top: 8px;
      border: 1.5px dashed var(--gray-300);
      border-radius: 6px;
      padding: 5px 8px;
      display: flex;
      align-items: center;
      gap: 7px;
      opacity: 0.5;
    }

    .lc-v-blocked-x {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--gray-200);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .lc-v-blocked-x svg { width: 9px; height: 9px; }

    .lc-v-blocked-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--gray-500);
      text-decoration: line-through;
    }

    .lc-v-blocked-detail {
      font-size: 8px;
      color: var(--gray-500);
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }

    /* ── X-Ray (bottom of right col) ── */
    .xray {
      border-top: 1px solid var(--gray-200);
      padding: 12px 16px 14px;
      flex-shrink: 0;
    }

    .xray-head { margin-bottom: 8px; }

    .xray-head h3 {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 1px;
    }

    .xray-head p {
      font-size: 10px;
      color: var(--gray-500);
    }

    .xray-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .xray-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--white);
      border: 1px solid var(--gray-200);
      border-radius: 7px;
    }

    .xray-row-icon {
      width: 22px;
      height: 22px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-100);
      flex-shrink: 0;
    }

    .xray-row-icon svg { width: 12px; height: 12px; }

    .xray-row-text {
      flex: 1;
      min-width: 0;
    }

    .xray-row-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--gray-500);
      font-weight: 600;
    }

    .xray-row-val {
      font-size: 13px;
      font-weight: 700;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }
  </style>
</head>
<body>

  <div class="wrapper">

  <!-- Header -->
  <header class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>
      <div>
        <div class="logo-title">Edge A/B Testing</div>
        <div class="logo-sub">Fastly Compute</div>
      </div>
    </div>
    <span class="badge ${isA ? "badge-a" : "badge-b"}">Variant ${bucket}</span>
  </header>

  <div class="main">

    <!-- Column 1: Control Panel -->
    <aside class="panel">
      <div class="section-tag">Marketing Controller</div>
      <h2>Dashboard</h2>
      <p class="panel-desc">Override edge bucket allocation to preview both storefront variants.</p>

      <a href="/?force=A" class="btn ${isA ? "active" : ""}">
        <span class="btn-dot">A</span>
        Set Cookie Variant A
      </a>
      <a href="/?force=B" class="btn ${!isA ? "active" : ""}">
        <span class="btn-dot">B</span>
        Set Cookie Variant B
      </a>
      <a href="/?force=clear" class="btn btn-clear">
        <span class="btn-dot">&times;</span>
        Clear Cookie (Random 50/50)
      </a>

      <div class="status">
        <div class="status-row">
          <span class="status-label">Active Bucket</span>
          <span class="status-val">${bucket}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Source</span>
          <span class="status-val">${source}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Cookie</span>
          <span class="status-val">${cookieDetected ? "Existing" : "New"}</span>
        </div>
      </div>
    </aside>

    <!-- Column 2: Storefront -->
    <section class="store">
      <div class="store-head">
        <div class="section-tag">The Morphing Storefront</div>
        <h2>Variant ${bucket} Experience</h2>
        <p>This product card adapts based on your edge-assigned bucket.</p>
      </div>

      <div class="card">
        <div class="card-img">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 120C50 70 75 45 100 45C125 45 150 70 150 120" stroke="#1a1a24" stroke-width="8" stroke-linecap="round"/>
            <rect x="36" y="108" width="28" height="44" rx="8" fill="#1a1a24"/>
            <rect x="40" y="112" width="20" height="36" rx="6" fill="${isA ? "#ff282d" : "#2d3142"}"/>
            <rect x="136" y="108" width="28" height="44" rx="8" fill="#1a1a24"/>
            <rect x="140" y="112" width="20" height="36" rx="6" fill="${isA ? "#ff282d" : "#2d3142"}"/>
            <circle cx="100" cy="45" r="5" fill="#1a1a24"/>
          </svg>
          ${isA ? '<div class="urgency">Flash Sale — Only 3 Left</div>' : ""}
        </div>
        <div class="card-body">
          <div class="card-name">AeroMax Pro</div>
          <div class="card-sub">Premium noise-cancelling wireless headphones, 40h battery</div>
          <div class="price">
            ${isA ? '<span class="price-old">$299.99</span><span class="price-now red">$239.99</span>' : '<span class="price-now">$299.99</span>'}
          </div>
          <button class="cta ${isA ? "cta-red" : "cta-slate"}">${isA ? "BUY NOW — 20% Off" : "Add to Cart"}</button>
          ${!isA ? '<div class="ship-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Free Worldwide Shipping</div>' : ""}
        </div>
      </div>
    </section>

    <!-- Column 3: Right Panel -->
    <div class="right-col">

      <!-- Lifecycle Visualizer -->
      <section class="lifecycle">
        <div class="lc-head">
          <div class="section-tag">Edge Request Lifecycle</div>
          <h3>Visualizer</h3>
          <p>Trace how each request flows through the Fastly Compute edge.</p>
        </div>
        <div class="lc-flow-v">

          <div class="lc-v-node">
            <div class="lc-v-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div>
              <div class="lc-v-title">User Browser</div>
              <div class="lc-v-detail">GET / + Cookie</div>
            </div>
          </div>

          <div class="lc-v-arrow">&#9663;</div>

          <div class="lc-v-node lc-v-edge">
            <div class="lc-v-edge-header">
              <div class="lc-v-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div>
                <div class="lc-v-title">Fastly Edge POP</div>
                <div class="lc-v-detail">Compute Service</div>
              </div>
            </div>
            <div class="lc-v-steps">
              <span class="lc-v-step">Parse Cookie</span>
              <span class="lc-v-step-arrow">&#10132;</span>
              <span class="lc-v-step">Assign Bucket</span>
              <span class="lc-v-step-arrow">&#10132;</span>
              <span class="lc-v-step">Synth HTML</span>
            </div>
            <div class="lc-v-fork">
              <div class="lc-v-path ${isA ? "active" : ""}">
                <div class="lc-v-path-lbl">Path A</div>
                <div class="lc-v-path-name">Flash Sale</div>
              </div>
              <div class="lc-v-path ${!isA ? "active" : ""}">
                <div class="lc-v-path-lbl">Path B</div>
                <div class="lc-v-path-name">Free Shipping</div>
              </div>
            </div>
            <div class="lc-v-blocked">
              <div class="lc-v-blocked-x">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.5" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
              <div>
                <div class="lc-v-blocked-title">Origin Server</div>
                <div class="lc-v-blocked-detail">Bypassed &#8212; 0ms cost</div>
              </div>
            </div>
          </div>

          <div class="lc-v-arrow">&#9663;</div>

          <div class="lc-v-node">
            <div class="lc-v-icon" style="background: ${isA ? "var(--red-light)" : "var(--green-light)"}">
              <svg viewBox="0 0 24 24" fill="none" stroke="${isA ? "#ff282d" : "#00a862"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div>
              <div class="lc-v-title">Client View</div>
              <div class="lc-v-detail">Variant ${bucket} rendered</div>
            </div>
          </div>

        </div>
      </section>

      <!-- X-Ray -->
      <footer class="xray">
        <div class="xray-head">
          <div class="section-tag">Edge Logic X-Ray</div>
          <h3>Zero-Latency Allocation</h3>
          <p>Real-time edge split testing decisions.</p>
        </div>
        <div class="xray-rows">
          <div class="xray-row">
            <div class="xray-row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="${cookieDetected ? "#00a862" : "#ff282d"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${cookieDetected
                  ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                  : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
              </svg>
            </div>
            <div class="xray-row-text">
              <div class="xray-row-label">Cookie</div>
            </div>
            <div class="xray-row-val">${cookieDetected ? "Detected" : "Generated"}</div>
          </div>
          <div class="xray-row">
            <div class="xray-row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#ff282d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div class="xray-row-text">
              <div class="xray-row-label">Edge Decision</div>
            </div>
            <div class="xray-row-val">&lt;1ms</div>
          </div>
          <div class="xray-row">
            <div class="xray-row-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <div class="xray-row-text">
              <div class="xray-row-label">Origin Cost</div>
            </div>
            <div class="xray-row-val">0ms</div>
          </div>
        </div>
      </footer>

    </div>

  </div>

  </div>

</body>
</html>`;
}
