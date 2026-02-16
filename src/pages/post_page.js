import { fetchPosts } from '../data/post_api.js';
import { escapeHTML, formatDate } from '../utils.js';
import { setupMarkdown, mdToSafeHTML, highlightCode, enableCodeCopy } from '../components/mark_down.js';

function getSlug() {
  return new URLSearchParams(location.search).get('post')?.trim() || '';
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function setMeta(title, desc) {
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', desc);
}

// ✅ 仅移除开头的 --- ... --- 段
function stripFrontmatter(md) {
  const s = String(md ?? '');
  return s.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/m, '');
}

/** slugify for heading ids */
function slugify(text) {
  const s = String(text || '').trim();
  return (
    s
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}\u4e00-\u9fa5\-]+/gu, '-')
      .replace(/\-+/g, '-')
      .replace(/^\-|\-$/g, '') || 'section'
  );
}

function render404(container, slug) {
  setMeta('404 - VN Blog', 'Post not found');
  container.innerHTML = `
    <section class="post-404">
      <h2>404</h2>
      <p class="muted">没有找到文章：<code>${escapeHTML(slug)}</code></p>
      <a class="pill" href="./posts.html">返回列表</a>
    </section>
  `;
}

function linkBtn(el, post, labelFallback) {
  if (!el) return;
  if (!post) {
    el.style.visibility = 'hidden';
    el.href = '#';
    el.textContent = labelFallback;
    return;
  }
  el.style.visibility = 'visible';
  el.href = `./post.html?post=${encodeURIComponent(post.slug || post.id)}`;
  el.textContent = post.title || labelFallback;
}

/**
 * Build TOC from headings in `.prose`
 * - supports h2/h3
 * - auto assigns ids if missing
 * - ✅ scroll spy uses the scroll container (.post-content), not window
 */
function buildToc(rootEl, scrollEl) {
  const tocEl = document.getElementById('toc');
  if (!tocEl) return;

  const prose = rootEl.querySelector('.prose');
  if (!prose) {
    tocEl.innerHTML = `<p class="muted">暂无目录</p>`;
    return;
  }

  const headings = Array.from(prose.querySelectorAll('h2, h3'));
  if (headings.length === 0) {
    tocEl.innerHTML = `<p class="muted">暂无目录</p>`;
    return;
  }

  // assign unique ids
  const used = new Set();
  headings.forEach((h) => {
    const level = h.tagName.toLowerCase();
    let id = h.id ? String(h.id) : slugify(h.textContent);
    if (level === 'h3') id = `sub-${id}`;

    const base = id;
    let n = 2;
    while (used.has(id) || document.getElementById(id)) {
      id = `${base}-${n++}`;
    }
    used.add(id);
    h.id = id;
  });

  tocEl.innerHTML = headings
    .map((h) => {
      const level = h.tagName.toLowerCase();
      const cls = level === 'h2' ? 'toc-l2' : 'toc-l3';
      const text = escapeHTML(h.textContent || '');
      return `<a class="${cls}" href="#${escapeHTML(h.id)}">${text}</a>`;
    })
    .join('');

  // ✅ 点击 TOC：在 scrollEl 内滚动到对应标题
  tocEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();

    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    const top =
      target.getBoundingClientRect().top -
      scrollEl.getBoundingClientRect().top +
      scrollEl.scrollTop -
      16;

    scrollEl.scrollTo({ top, behavior: 'smooth' });
  });

  // ✅ scroll spy（监听 scrollEl）
  const links = Array.from(tocEl.querySelectorAll('a[href^="#"]'));
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));

  function markActive() {
    let activeId = headings[0].id;

    // headings 的位置相对 scrollEl
    const baseTop = scrollEl.getBoundingClientRect().top;
    const currentTop = scrollEl.scrollTop;

    for (const h of headings) {
      const hTop = h.getBoundingClientRect().top - baseTop + currentTop;
      if (hTop <= currentTop + 120) activeId = h.id;
      else break;
    }

    links.forEach((a) => a.classList.remove('is-active'));
    const activeLink = byId.get(activeId);
    if (activeLink) activeLink.classList.add('is-active');
  }

  scrollEl.addEventListener('scroll', markActive, { passive: true });
  markActive();
}

async function loadMarkdownContent(post) {
  if (post.md_path) {
    const postsJsonUrl = new URL('../data/posts.json', window.location.href);
    const mdUrl = new URL(post.md_path, postsJsonUrl);
    const res = await fetch(mdUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load markdown: ${res.status}`);
    return await res.text();
  }
  return String(post?.content || '');
}

async function initApp() {
  setupMarkdown();
  enableCodeCopy();

  const slug = getSlug();
  const container = document.getElementById('post');
  const scrollEl = document.querySelector('.post-content');

  if (!container || !scrollEl) return;

  container.setAttribute('aria-busy', 'true');

  if (!slug) {
    render404(container, '(missing slug)');
    container.setAttribute('aria-busy', 'false');
    return;
  }

  try {
    const posts = await fetchPosts();
    const sorted = posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    const idx = sorted.findIndex((p) => String(p.slug) === slug || String(p.id) === slug);
    if (idx === -1) {
      render404(container, slug);
      return;
    }

    const post = sorted[idx];
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

    let markdown = await loadMarkdownContent(post);
    markdown = stripFrontmatter(markdown);

    const safeHTML = mdToSafeHTML(markdown || '');
    const desc = stripHtml(safeHTML).slice(0, 160) || post.title || 'VN Blog post';
    setMeta(`${post.title || '文章'} - VN Blog`, desc);

    const title = escapeHTML(post.title || '');
    const dateISO = escapeHTML(post.date || '');
    const dateText = escapeHTML(formatDate(post.date, { year: 'numeric', month: 'long', day: 'numeric' }));

    // ✅ 关键：把正文真正插入 DOM
    container.innerHTML = `
      <header class="post-head">
        <h2 class="post-h2">${title}</h2>
        <p class="post-meta muted">
          <time datetime="${dateISO}">${dateText}</time>
          ${post.category ? `<span aria-hidden="true"> · </span><span class="badge">${escapeHTML(post.category)}</span>` : ''}
          ${Array.isArray(post.tags) && post.tags.length
            ? `<span aria-hidden="true"> · </span>${post.tags.map(t => `<span class="badge">#${escapeHTML(String(t))}</span>`).join(' ')}`
            : ''
          }
        </p>
      </header>

      <section class="prose">
        ${safeHTML}
      </section>
    `;

 
    highlightCode(container);


    buildToc(container, scrollEl);

    // prev/next
    linkBtn(document.getElementById('prevPost'), prev, '← Prev');
    linkBtn(document.getElementById('nextPost'), next, 'Next →');
  } catch (e) {
    console.error(e);
    render404(container, slug);
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

initApp();
