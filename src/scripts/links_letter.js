const COLORS = [
  'rgba(110, 175, 245, .62)',
  'rgba(120, 220, 175, .58)',
  'rgba(255, 140, 185, .58)',
  'rgba(170, 140, 245, .56)',
  'rgba(95, 210, 220, .56)',
  'rgba(219, 60, 60, 0.56)',
];

const LETTER = [
  '我的朋友们：',
  '       k4per:https://k4per-blog.xyz/|一起打pwn(坐牢)的哥们',
  '       Samsāra:https://samsara-lo.github.io/|全能的re师傅，什么都会',
  '       QYQS:https://qyqs1.github.io/|二进制扛把子',
  '       FOX:https://www.rockfox.top/|神秘密码✌🏻',
  '       komiko:https://notion-next-yeye.vercel.app/|密码大手子',
  '       KiraKiraAyu:https://www.kkayu.com/|不止是前端大王',
  '       ivory:https://ireel.github.io/|带我打web,还带我吃生蚝',
  '       sleeper:https://fwmax360.github.io/|太好了是安卓✌🏻我们有救了',
].join('\n');

function rgbaToOpaque(rgba) {
  const match = rgba.match(/rgba\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/i);
  if (!match) return rgba;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, 1)`;
}

function pick3Distinct(arr) {
  const idx = new Set();
  while (idx.size < 3) idx.add(Math.floor(Math.random() * arr.length));
  return [...idx].map((i) => arr[i]);
}

function randomGradient() {
  const angle = Math.floor(Math.random() * 360);
  const [c1, c2, c3] = pick3Distinct(COLORS).map(rgbaToOpaque);
  return `linear-gradient(${angle}deg, ${c1}, ${c2}, ${c3})`;
}

function getCSSNumber(varName, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseLine(line) {
  if (line == null || line === '' || !line.trim()) return { type: 'empty' };

  const idx = line.indexOf(':');
  if (idx === -1) return { type: 'text', text: line };

  const left = line.slice(0, idx);
  const prefix = left.match(/^\s*/)?.[0] ?? '';
  const name = left.slice(prefix.length);
  const rest = line.slice(idx + 1).trim();

  if (rest.includes('|')) {
    const [maybeUrl, ...descParts] = rest.split('|');
    return { type: 'link', prefix, name, href: maybeUrl.trim() || '#', desc: descParts.join('|').trim() };
  }

  const firstSpace = rest.indexOf(' ');
  if (firstSpace !== -1) {
    const first = rest.slice(0, firstSpace).trim();
    const after = rest.slice(firstSpace + 1).trim();
    if (/^(https?:\/\/|mailto:|\/)/i.test(first)) {
      return { type: 'link', prefix, name, href: first, desc: after };
    }
  }

  return { type: 'link', prefix, name, href: '#', desc: rest };
}

function renderTextRows(textEl, text) {
  const rows = text.split('\n');
  textEl.innerHTML = '';

  for (const raw of rows) {
    const parsed = parseLine(raw);
    const row = document.createElement('div');
    row.className = 'row';

    if (parsed.type === 'empty') {
      row.textContent = '';
      textEl.appendChild(row);
      continue;
    }

    if (parsed.type === 'text') {
      row.textContent = parsed.text;
      textEl.appendChild(row);
      continue;
    }

    if (parsed.prefix) row.appendChild(document.createTextNode(parsed.prefix));

    const link = document.createElement('a');
    link.className = 'name-link';
    link.textContent = parsed.name;
    link.href = parsed.href || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.setProperty('--grad', randomGradient());

    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = '：';

    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = parsed.desc ?? '';

    row.append(link, sep, desc);
    textEl.appendChild(row);
  }

  return rows.length;
}

function renderLines(sheet, linesEl, lineCount) {
  linesEl.innerHTML = '';
  const padTop = getCSSNumber('--padTop', 28);
  const lineGap = getCSSNumber('--lineGap', 34);
  const lineW = getCSSNumber('--lineW', 2);
  const baselineOffset = Math.floor(lineGap * 0.78);
  sheet.style.height = `${padTop + lineCount * lineGap + 40}px`;

  for (let i = 0; i < lineCount; i += 1) {
    const line = document.createElement('div');
    line.className = 'line';
    line.style.top = `${padTop + i * lineGap + baselineOffset}px`;
    line.style.height = `${lineW}px`;
    line.style.setProperty('--c', COLORS[Math.floor(Math.random() * COLORS.length)]);
    line.style.opacity = String(0.62 + Math.random() * 0.18);
    linesEl.appendChild(line);
  }
}

export function renderLetter() {
  const sheet = document.getElementById('sheet');
  const linesEl = document.getElementById('lines');
  const textEl = document.getElementById('text');
  if (!sheet || !linesEl || !textEl) return;
  renderLines(sheet, linesEl, renderTextRows(textEl, LETTER));
}
