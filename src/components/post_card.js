import { escapeHTML, formatDate } from '../utils.js';

const PLACEHOLDER = '../assets/images/placeholder.jpg';

function to_abs_url(href) {
  try {
    return new URL(String(href || ''), window.location.href).toString();
  } catch {
    return String(href || '');
  }
}

/**
 * @param {any} p
 */
export function postCardHTML(p) {
  const post_slug = p.slug || p.id;
  const url = `../pages/post.html?post=${encodeURIComponent(post_slug)}`;

  const title = escapeHTML(p.title || '');
  const dateISO = escapeHTML(p.date || '');
  const dateText = escapeHTML(formatDate(p.date, { year: 'numeric', month: 'long', day: 'numeric' }));

  const category_html = p.category
    ? `<a class="badge" href="../pages/category.html?cat=${encodeURIComponent(p.category)}"
         aria-label="查看分类：${escapeHTML(p.category)}">${escapeHTML(p.category)}</a>`
    : '';

  const imgSrc = escapeHTML(to_abs_url(p.featuredImage || PLACEHOLDER));
  const placeholderAbs = escapeHTML(to_abs_url(PLACEHOLDER));

  return `
    <article
      class="post-card fade-in"
      data-post-id="${escapeHTML(p.id || '')}"
      role="link"
      tabindex="0"
      aria-label="打开文章：${title}"
      data-href="${escapeHTML(url)}"
    >
      <div class="post-cover">
        <img src="${imgSrc}" alt="${title}" loading="lazy"
             onerror="this.onerror=null;this.src='${placeholderAbs}';" />
      </div>

      <div class="post-body">
        <div class="post-meta">
          <time datetime="${dateISO}">${dateText}</time>
          ${category_html}
        </div>

        <h3 class="post-title">${title}</h3>
      </div>
    </article>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {any[]} posts
 */
export function renderPostCards(container, posts) {
  container.innerHTML = posts.map(postCardHTML).join('') || `<p class="muted">暂无文章</p>`;
}
