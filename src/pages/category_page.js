// category页面 - 大改：无搜索/无meta/无分页
// 分类筛选 + 归档式（按年份）仅显示 日期 + 标题

import { fetchPosts } from '../data/post_api.js';
import { sortByDateDesc } from '../core/post_store.js';

// URL param
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

// 标题
function setTitle(category) {
  const titleEl = document.getElementById('title');
  const catText = category ? `分类：${category}` : '分类';
  if (titleEl) titleEl.textContent = catText;
  document.title = `${catText} - VN Blog`;
}

// 同步URL（不刷新）
function syncUrl(category) {
  const url = new URL(window.location.href);
  if (category) url.searchParams.set('cat', category);
  else url.searchParams.delete('cat');
  history.replaceState(null, '', url.toString());
}

// DOM
const listEl = document.getElementById('posts_list');
const filtersContainer = document.getElementById('category_filters');

// 状态
let allPosts = [];
let currentCategory = '';

// ---------- 工具 ----------

function getDateValue(p) {
  return p.date || p.created || p.created_at || p.updated || p.updated_at || '';
}

function safeDate(dateLike) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getYear(dateLike) {
  const d = safeDate(dateLike);
  if (d) return String(d.getFullYear());
  const m = String(dateLike || '').match(/^(\d{4})/);
  return m ? m[1] : '未知';
}

function getPostKey(p) {
  return String(p.slug || p.id || p.key || '').trim();
}

// 日期显示：13 Apr 2025
const fmtItemDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

// ---------- 分类按钮 ----------

function buildCategories(posts) {
  const set = new Set();
  for (const p of posts) if (p.category) set.add(p.category);
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
}

function renderCategoryFilters(categories) {
  if (!filtersContainer) return;

  filtersContainer.innerHTML = '';

  const mkBtn = (label, value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill cat-pill';
    btn.textContent = label;
    btn.dataset.value = value;
    btn.setAttribute('aria-pressed', value === currentCategory ? 'true' : 'false');

    btn.addEventListener('click', () => setCategory(value));
    return btn;
  };

  filtersContainer.appendChild(mkBtn('全部', ''));

  for (const c of categories) filtersContainer.appendChild(mkBtn(c, c));
}

function updatePressedState() {
  if (!filtersContainer) return;
  filtersContainer.querySelectorAll('button[data-value]').forEach((b) => {
    const v = b.dataset.value || '';
    b.setAttribute('aria-pressed', v === currentCategory ? 'true' : 'false');
  });
}

// ---------- 归档渲染：按年份 ----------

function renderArchiveByYear(posts) {
  if (!listEl) return;

  listEl.setAttribute('aria-busy', 'true');
  listEl.innerHTML = '';

  const groups = new Map(); // year -> posts
  for (const p of posts) {
    const y = getYear(getDateValue(p));
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(p);
  }

  // 年份倒序
  const years = Array.from(groups.keys()).sort((a, b) => Number(b) - Number(a));

  const frag = document.createDocumentFragment();

  for (const y of years) {
    const h2 = document.createElement('h2');
    h2.className = 'archive-year-title';
    h2.textContent = y; // 不要 '#'
    frag.appendChild(h2);

    const ul = document.createElement('ul');
    ul.className = 'archive-list';

    const items = groups.get(y).slice().sort((a, b) => {
      const da = safeDate(getDateValue(a))?.getTime() || 0;
      const db = safeDate(getDateValue(b))?.getTime() || 0;
      return db - da;
    });

    for (const p of items) {
      const li = document.createElement('li');
      li.className = 'archive-item';

      const d = safeDate(getDateValue(p));
      const dateText = d ? fmtItemDate.format(d) : '';

      const a = document.createElement('a');
      a.className = 'archive-link';

      const key = getPostKey(p);
      a.href = key ? `./post.html?post=${encodeURIComponent(key)}` : '#';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'archive-date';
      dateSpan.textContent = dateText;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'archive-title';
      titleSpan.textContent = p.title || p.name || '(untitled)';

      a.appendChild(dateSpan);
      a.appendChild(titleSpan);

      li.appendChild(a);
      ul.appendChild(li);
    }

    frag.appendChild(ul);
  }

  listEl.appendChild(frag);
  listEl.setAttribute('aria-busy', 'false');
}

// ---------- 切换分类 ----------

function getFilteredPosts() {
  if (!currentCategory) return allPosts;
  return allPosts.filter((p) => p.category === currentCategory);
}

function setCategory(category) {
  currentCategory = category || '';
  setTitle(currentCategory);
  syncUrl(currentCategory);
  updatePressedState();
  renderArchiveByYear(getFilteredPosts());
}

// ---------- init ----------

async function initApp() {
  if (!listEl) return;
  listEl.innerHTML = '<p class="muted">Loading…</p>';

  try {
    const posts = await fetchPosts();
    allPosts = sortByDateDesc(posts || []);

    const categories = buildCategories(allPosts);
    renderCategoryFilters(categories);

    const initial = getQueryParam('cat');
    setCategory(initial);

  } catch (e) {
    console.error('分类页初始化失败:', e);
    listEl.innerHTML = '<p class="muted">加载失败，请刷新重试</p>';
  }
}

initApp();
