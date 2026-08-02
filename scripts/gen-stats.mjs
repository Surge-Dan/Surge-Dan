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

(async () => {
  fs.mkdirSync('out', { recursive: true });
  const log = (m) => {
    try { fs.appendFileSync('out/gen-stats.log', `${new Date().toISOString()} ${m}\n`); } catch (_) {}
    console.log(m);
  };
  log(`start USER=${USER} TOKEN_len=${TOKEN ? TOKEN.length : 'undef'} node=${process.version} fetch=${typeof fetch}`);
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
