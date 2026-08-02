// Self-hosted GitHub stats generator.
// Runs in CI (where api.github.com is reachable), reads PUBLIC user data with the
// default GITHUB_TOKEN, and renders two SVG cards: github-stats.svg + top-langs.svg.
// Writing to out/ -> pushed to the `output` branch -> served via raw.githubusercontent.com
// (China-accessible, rate-limit-free). No external service, no PAT needed.

import fs from 'node:fs';

const USER = process.env.GITHUB_USER;
const TOKEN = process.env.GITHUB_TOKEN;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'profile-stats-gen',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: HEADERS });
    if (r.status === 200) return r.json();
    if (r.status === 404) return null;
    if (r.status === 403 || r.status === 429) {
      const wait = Number(r.headers.get('retry-after') || 5) * 1000;
      await sleep(wait + i * 1000);
      continue;
    }
    await sleep(1500 * (i + 1));
  }
  throw new Error(`github api failed: ${url}`);
}

async function getOwnedRepos() {
  let repos = [];
  for (let page = 1; page <= 10; page++) {
    const r = await gh(
      `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&type=owner`
    );
    if (!r || !r.length) break;
    repos = repos.concat(r);
    if (r.length < 100) break;
  }
  return repos.filter((r) => !r.fork); // exclude forks -> truthful language profile
}

const FONT = "Segoe UI, Helvetica, Arial, sans-serif";

function esc(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function renderStats(rows) {
  const W = 470;
  const H = 56 + rows.length * 30 + 16;
  let y = 56;
  let body = '';
  for (const [label, value] of rows) {
    body += `<circle cx="22" cy="${y - 4}" r="4" fill="#F7B93E"/>`;
    body += `<text x="34" y="${y}" fill="#586069" font-family="${FONT}" font-size="14">${esc(label)}</text>`;
    body += `<text x="${W - 22}" y="${y}" fill="#24292e" font-family="${FONT}" font-size="14" text-anchor="end" font-weight="bold">${esc(value)}</text>`;
    y += 30;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="none"/>
<text x="22" y="30" fill="#F7B93E" font-family="${FONT}" font-size="16" font-weight="bold">Daniel's GitHub Stats</text>
${body}
</svg>`;
}

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  HTML: '#e34c26', CSS: '#563d7c', Java: '#b07219', C: '#555555',
  'C++': '#f34b7d', Go: '#00ADD8', Rust: '#dea584', Shell: '#89e051',
  Vue: '#41b883', Dockerfile: '#384d54', SCSS: '#c6538c', PHP: '#4F5D95',
};

function renderLangs(items) {
  const W = 380;
  const top = items.slice(0, 6);
  const total = top.reduce((s, [, b]) => s + b, 0) || 1;
  const H = 56 + top.length * 26 + 16;
  let y = 56;
  let body = '';
  for (const [lang, bytes] of top) {
    const pct = (bytes / total) * 100;
    const barW = Math.max(2, Math.round((pct / 100) * 200));
    const color = LANG_COLORS[lang] || '#F7B93E';
    body += `<text x="14" y="${y}" fill="#586069" font-family="${FONT}" font-size="12">${esc(lang)}</text>`;
    body += `<rect x="120" y="${y - 10}" width="200" height="9" rx="3" fill="#e1e4e8"/>`;
    body += `<rect x="120" y="${y - 10}" width="${barW}" height="9" rx="3" fill="${color}"/>`;
    body += `<text x="332" y="${y}" fill="#586069" font-family="${FONT}" font-size="11" text-anchor="end">${pct.toFixed(1)}%</text>`;
    y += 26;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="none"/>
<text x="14" y="30" fill="#F7B93E" font-family="${FONT}" font-size="16" font-weight="bold">Top Languages</text>
${body}
</svg>`;
}

function safeWrite(file, content) {
  // write to .tmp then rename so a failure never deletes a previous good version
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

// Animated header (replaces the unstable trinib banner).
// Pure SMIL animation — runs in <img> refs, no external service, China-safe.
// Design: dark navy base + soft radial glow sweep + two calm waves + monogram.
function renderHeader() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="140" viewBox="0 0 880 140" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="60%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#2a200f"/>
    </linearGradient>
    <radialGradient id="orb" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#F7B93E" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#F7B93E" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#F7B93E" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>
  <rect width="880" height="140" fill="url(#bg)"/>

  <!-- Soft glowing orb that drifts across (blurred radial gradient, no hard edges) -->
  <circle cx="0" cy="70" r="200" fill="url(#orb)" filter="url(#blur)">
    <animate attributeName="cx" values="140;740;140" dur="9s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="60;82;60" dur="11s" repeatCount="indefinite"/>
  </circle>

  <!-- Subtle twinkling stars (small bright dots) -->
  <circle cx="80" cy="30" r="1.2" fill="#F7B93E" opacity="0.6">
    <animate attributeName="opacity" values="0.2;0.9;0.2" dur="3s" repeatCount="indefinite"/>
  </circle>
  <circle cx="180" cy="50" r="1" fill="#FFFFFF" opacity="0.5">
    <animate attributeName="opacity" values="0.1;0.8;0.1" dur="4s" begin="0.5s" repeatCount="indefinite"/>
  </circle>
  <circle cx="720" cy="35" r="1.2" fill="#F7B93E" opacity="0.6">
    <animate attributeName="opacity" values="0.2;0.9;0.2" dur="3.5s" begin="1.2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="820" cy="55" r="1" fill="#FFFFFF" opacity="0.5">
    <animate attributeName="opacity" values="0.1;0.8;0.1" dur="4.5s" begin="0.8s" repeatCount="indefinite"/>
  </circle>
  <circle cx="420" cy="22" r="1" fill="#F7B93E" opacity="0.5">
    <animate attributeName="opacity" values="0.2;0.7;0.2" dur="5s" begin="2s" repeatCount="indefinite"/>
  </circle>

  <!-- Two calm waves (subtle amplitude, clear separation) -->
  <path fill="#F7B93E" fill-opacity="0.22">
    <animate attributeName="d" dur="8s" repeatCount="indefinite"
      values="M0,98 Q220,90 440,98 T880,98 V140 H0 Z;
              M0,98 Q220,106 440,98 T880,98 V140 H0 Z;
              M0,98 Q220,90 440,98 T880,98 V140 H0 Z"/>
  </path>
  <path fill="#586069" fill-opacity="0.35">
    <animate attributeName="d" dur="10s" repeatCount="indefinite"
      values="M0,118 Q220,112 440,118 T880,118 V140 H0 Z;
              M0,118 Q220,124 440,118 T880,118 V140 H0 Z;
              M0,118 Q220,112 440,118 T880,118 V140 H0 Z"/>
  </path>

  <!-- Monogram + tagline (centered, gives the banner actual content) -->
  <text x="440" y="58" fill="#F7B93E" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" text-anchor="middle" letter-spacing="3">DANIEL MUI</text>
  <text x="440" y="80" fill="#8b949e" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="11" text-anchor="middle" letter-spacing="5">PRODUCT · AI · IDEALIST</text>
</svg>`;
}

// Lightweight animated wave divider — reusable section separator.
function renderDivider(dark = false) {
  const fg = dark ? '#F7B93E' : '#24292e';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="28" viewBox="0 0 880 28" preserveAspectRatio="none">
  <path fill="${fg}" fill-opacity="0.9">
    <animate attributeName="d" dur="6s" repeatCount="indefinite"
      values="M0,14 Q220,2 440,14 T880,14 V28 H0 Z;
              M0,14 Q220,26 440,14 T880,14 V28 H0 Z;
              M0,14 Q220,2 440,14 T880,14 V28 H0 Z"/>
  </path>
</svg>`;
}

(async () => {
  fs.mkdirSync('out', { recursive: true });
  const log = (m) => {
    try { fs.appendFileSync('out/gen-stats.log', `${new Date().toISOString()} ${m}\n`); } catch (_) {}
    console.log(m);
  };
  log(`start USER=${USER} TOKEN_len=${TOKEN ? TOKEN.length : 'undef'} node=${process.version} fetch=${typeof fetch}`);

  // Decorative assets first — they don't depend on the GitHub API, so they
  // generate even if the network/REST calls below fail.
  try {
    safeWrite('out/header.svg', renderHeader());
    safeWrite('out/wave-divider.svg', renderDivider(false));
    safeWrite('out/wave-divider-dark.svg', renderDivider(true));
    log('wrote header.svg + wave dividers');
  } catch (e) {
    log(`decor assets failed: ${e.message}`);
  }

  const u = await gh(`https://api.github.com/users/${USER}`);
  log(`user ok public_repos=${u && u.public_repos} followers=${u && u.followers}`);
  const repos = await getOwnedRepos();
  log(`repos=${repos.length} stars=${repos.reduce((s, r) => s + r.stargazers_count, 0)}`);
  const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const forks = repos.reduce((s, r) => s + r.forks_count, 0);

  const rows = [
    ['Public Repos', u.public_repos ?? repos.length],
    ['Total Stars', stars],
    ['Total Forks', forks],
    ['Followers', u.followers],
    ['Following', u.following],
  ];
  safeWrite('out/github-stats.svg', renderStats(rows));
  log('wrote github-stats.svg');

  const langBytes = {};
  for (const r of repos) {
    const langs = await gh(`https://api.github.com/repos/${r.full_name}/languages`);
    if (!langs) continue;
    for (const [lang, bytes] of Object.entries(langs)) {
      langBytes[lang] = (langBytes[lang] || 0) + bytes;
    }
  }
  const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
  safeWrite('out/top-langs.svg', renderLangs(sorted));
  log(`wrote top-langs.svg langs=${sorted.length}`);
})().catch((e) => {
  console.error('gen-stats failed:', e.message);
  try {
    fs.mkdirSync('out', { recursive: true });
    fs.appendFileSync('out/gen-stats.log', `${new Date().toISOString()} FAILED: ${e.stack || e.message}\n`);
  } catch (_) {}
  process.exitCode = 0; // non-fatal: keep snake/streak commit intact
});
