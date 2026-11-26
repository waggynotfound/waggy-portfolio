(() => {
  'use strict';
  const user = 'waggynotfound';
  const dayMs = 86400000;
  const colors = ['#302836', '#583b75', '#8858b4', '#b486e7', '#dfc5ff'];
  const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
  const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  // Only calculated coordinates, fixed colors and formatted UTC month names enter the SVG.
  function calendar(days) {
    if (!Array.isArray(days) || days.length < 365 || days.length > 371) throw Error('Incomplete calendar');
    const first = Date.parse(days[0].date + 'T00:00:00Z');
    const offset = new Date(first).getUTCDay();
    const strip = Math.ceil(Math.ceil((days.length + offset) / 7) / 2);
    let cells = '', labels = '', prevLabel = -5, prevMonth = -1;
    days.forEach(({ date, level }, i) => {
      const stamp = Date.parse(date + 'T00:00:00Z');
      if (!Number.isFinite(stamp) || stamp !== first + i * dayMs || !Number.isInteger(level) || !colors[level]) throw Error('Invalid day');
      const d = new Date(stamp), dow = d.getUTCDay(), week = Math.floor((i + offset) / 7);
      const column = week % strip, y = 24 + Math.floor(week / strip) * 98, x = 32 + column * 13;
      if (!i || (column === 0 && dow === 0)) {
        prevLabel = -5; prevMonth = -1;
        for (const [r, text] of [[1, 'M'], [3, 'W'], [5, 'F']]) labels += `<text x="7" y="${y + r * 10 + 8}">${text}</text>`;
      }
      if ((!i || dow === 0) && d.getUTCMonth() !== prevMonth) {
        if (column - prevLabel >= 3 && column < strip - 1) {
          labels += `<text x="${x}" y="${y - 6}">${month.format(d)}</text>`; prevLabel = column;
        }
        prevMonth = d.getUTCMonth();
      }
      cells += `<rect x="${x}" y="${y + dow * 10}" width="10" height="8" rx="1" fill="${colors[level]}"/>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="388" height="203" viewBox="0 0 388 203"><title>GitHub contribution calendar for ${user}</title><rect width="388" height="203" fill="#100c18"/><g fill="#c8bcd5" font-family="monospace" font-size="11">${labels}</g>${cells}</svg>`;
  }

  const card = document.querySelector('.gh-work');
  if (!card) return;
  async function getJSON(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { credentials: 'omit', signal: controller.signal });
      if (!res.ok) throw Error('Feed unavailable');
      return await res.json();
    } finally { clearTimeout(timer); }
  }
  async function repositories() {
    const repos = await getJSON(`https://api.github.com/users/${user}/repos?type=owner&sort=updated&direction=desc&per_page=3`);
    if (!Array.isArray(repos)) throw Error('Invalid repositories');
    const rows = repos.slice(0, 3).map(repo => {
      if (repo.owner?.login?.toLowerCase() !== user || !/^[\w.-]+$/.test(repo.name) || ['.', '..'].includes(repo.name)) throw Error('Invalid repository');
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = `https://github.com/${user}/${repo.name}`;
      a.textContent = repo.name;
      li.append(a);
      return li;
    });
    card.querySelector('.gh-repos').replaceChildren(...rows);
    card.querySelector('.gh-repo-status').textContent = rows.length ? `Checked ${dateLabel.format(Date.now())}` : 'No public repositories.';
  }
  async function contributions() {
    // Tokenless CORS-enabled mirror of GitHub's profile calendar. Keep the official
    // local snapshot if the mirror is unavailable or returns older/incomplete data.
    const data = await getJSON(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`);
    const days = data.contributions, total = data.total?.lastYear;
    const svg = calendar(days), start = Date.parse(days[0].date), end = Date.parse(days[days.length - 1].date);
    if (!Number.isInteger(total) || total < 0 || end < Date.UTC(2026, 10, 26) || end > Date.now() + dayMs) throw Error('Invalid calendar');
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    card.querySelectorAll('.gh-chart').forEach(img => { img.src = src; });
    card.querySelector('.gh-total').textContent = `${total.toLocaleString('en')} contribution${total === 1 ? '' : 's'}`;
    card.querySelector('.gh-range').textContent = `${monthYear.format(start)} – ${monthYear.format(end)}`;
    card.querySelector('.gh-chart-status').textContent = `Through ${dateLabel.format(end)}`;
  }
  let lastAttempt = -Infinity;
  function refresh() {
    if (performance.now() - lastAttempt < 300000) return;
    lastAttempt = performance.now();
    // Each section retains its own dated snapshot or last successful response.
    repositories().catch(() => {});
    contributions().catch(() => {});
  }
  card.querySelector('.work-head').addEventListener('click', () => {
    if (card.classList.contains('is-open')) refresh();
  });
  refresh();
})();
