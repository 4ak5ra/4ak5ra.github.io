import { init_sakura, destroy_sakura } from '../effects/sakura.js';

const rand = Math.random;

const COLORS = [
  "rgba(110, 175, 245, .62)", // 淡蓝
  "rgba(120, 220, 175, .58)", // 淡绿
  "rgba(255, 140, 185, .58)", // 淡粉
  "rgba(170, 140, 245, .56)", // 淡紫
  "rgba(95, 210, 220, .56)",  // 青色
  "rgba(219, 60, 60, 0.56)"   // 红色
];
const LETTER = [
  "我的朋友们：",
  "       k4per:https://k4per-blog.xyz/|一起打pwn(坐牢)的哥们",
  "       Samsāra:https://samsara-lo.github.io/|全能的re师傅，什么都会",
  "       QYQS:https://qyqs1.github.io/|二进制扛把子",
  "       FOX:https://www.rockfox.top/|神秘密码✌🏻",
  "       komiko:https://notion-next-yeye.vercel.app/|密码大手子",
  "       KiraKiraAyu:https://www.kkayu.com/|不止是前端大王",
  "       ivory:https://ireel.github.io/|带我打web,还带我吃生蚝",
  "       sleeper:https://4ak5ra.github.io/|太好了是安卓✌🏻我们有救了",
  "       Byte:https://www.0xbyt3.com/|pwn学弟",
].join("\n");
function rgbaToOpaque(rgba) {
  // 匹配 rgba(r,g,b,a)
  const m = rgba.match(/rgba\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/i);
  if (!m) return rgba; // 万一不是 rgba 格式就原样返回
  const r = m[1], g = m[2], b = m[3];
  return `rgba(${r}, ${g}, ${b}, 1)`;
}
function pick3Distinct(arr) {
  const idx = new Set();
  while (idx.size < 3) idx.add(Math.floor(rand() * arr.length));
  return [...idx].map(i => arr[i]);
}

function randomGradient() {
  const angle = Math.floor(rand() * 360);
  // 从同一个 COLORS 池子抽 3 个，然后把 alpha 变成 1
  const [c1, c2, c3] = pick3Distinct(COLORS).map(rgbaToOpaque);
  return `linear-gradient(${angle}deg, ${c1}, ${c2}, ${c3})`;
}


const sheet = document.getElementById("sheet");
const linesEl = document.getElementById("lines");
const textEl = document.getElementById("text");





function getCSSNumber(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseLine(line) {

  if (line == null || line === "") return { type: "empty" };

  if (!line.trim()) return { type: "empty" };

  const idx = line.indexOf(":");
  if (idx === -1) return { type: "text", text: line }; 


  const left = line.slice(0, idx);

 
  const m = left.match(/^\s*/);
  const prefix = m ? m[0] : "";


  const name = left.slice(prefix.length);


  const rest = line.slice(idx + 1).trim();

  if (rest.includes("|")) {
    const [maybeUrl, ...descParts] = rest.split("|");
    const url = maybeUrl.trim();
    const desc = descParts.join("|").trim();
    return { type: "link", prefix, name, href: url || "#", desc };
  }


  const firstSpace = rest.indexOf(" ");
  if (firstSpace !== -1) {
    const first = rest.slice(0, firstSpace).trim();
    const after = rest.slice(firstSpace + 1).trim();
    const looksLikeUrl = /^(https?:\/\/|mailto:|\/)/i.test(first);
    if (looksLikeUrl) {
      return { type: "link", prefix, name, href: first, desc: after };
    }
  }

  return { type: "link", prefix, name, href: "#", desc: rest };
}


function renderTextRows(text) {
  const rows = text.split("\n");
  textEl.innerHTML = "";

  for (const raw of rows) {
    const parsed = parseLine(raw);

    const row = document.createElement("div");
    row.className = "row";

    if (parsed.type === "empty") {
      row.textContent = ""; // 保持高度
      textEl.appendChild(row);
      continue;
    }

    if (parsed.type === "text") {
      row.textContent = parsed.text;
      textEl.appendChild(row);
      continue;
    }

  
    if (parsed.prefix) {
      row.appendChild(document.createTextNode(parsed.prefix));
    }

    const a = document.createElement("a");
    a.className = "name-link";
    a.textContent = parsed.name;
    a.href = parsed.href || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.setProperty("--grad", randomGradient()); 

    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "：";

    const desc = document.createElement("span");
    desc.className = "desc";
    desc.textContent = parsed.desc ?? "";

    row.appendChild(a);
    row.appendChild(sep);
    row.appendChild(desc);

    textEl.appendChild(row);
  }

  return rows.length;
}



function renderLines(lineCount) {
  linesEl.innerHTML = "";

  const padTop = getCSSNumber("--padTop", 28);
  const lineGap = getCSSNumber("--lineGap", 34);
  const lineW = getCSSNumber("--lineW", 2);

  // 横线靠近字的“底部”，更像写信
  const baselineOffset = Math.floor(lineGap * 0.78);

  // 自适应高度：刚好够这些行
  const extraBottom = 40;
  const height = padTop + lineCount * lineGap + extraBottom;
  sheet.style.height = `${height}px`;

  for (let i = 0; i < lineCount; i++) {
    const y = padTop + i * lineGap + baselineOffset;

    const line = document.createElement("div");
    line.className = "line";
    line.style.top = `${y}px`;
    line.style.height = `${lineW}px`;

    // 从 5 色中随机选
    const c = COLORS[Math.floor(rand() * COLORS.length)];
    line.style.setProperty("--c", c);

    // 小幅随机：让每条线深浅略不同（但整体更深）
    line.style.opacity = String(0.62 + rand() * 0.18);

    linesEl.appendChild(line);
  }
}

function render() {
  const count = renderTextRows(LETTER);
  renderLines(count);
}

// 初始化樱花特效
function initSakuraEffect() {
  try {
    init_sakura({
      canvas_id: 'sakura',
      num_flowers: 260,          // 粒子数量，可根据性能调整
      speed: 0.9,               // 速度
      size_min: 0.6,            // 最小尺寸
      size_max: 0.8,            // 最大尺寸
      rotation: 0.25,           // 旋转
      area: 15,                 // 区域大小
      time_scale: 1.0,          // 时间缩放
      clear_alpha: 0.0          // 透明背景
    });
  } catch (err) {
    console.warn('樱花特效初始化失败:', err);
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    render();
    initSakuraEffect();
  });
} else {
  render();
  initSakuraEffect();
}

// 页面卸载时清理特效
window.addEventListener('beforeunload', destroy_sakura);

// 窗口大小变化时重新渲染
window.addEventListener("resize", render);