  // 契约：纯渲染函数，返回DocumentFragment，无副作用
  // 输入：posts数组，渲染选项
  // 输出：DocumentFragment，可插入DOM

  export function renderPostList(posts, options = {}) {
    const fragment = document.createDocumentFragment();
    
    posts.forEach(post => {
      const card = renderPostCard(post, options);
      if (card) fragment.appendChild(card);
    });
    
    return fragment;
  }

 export function renderPostCard(post, { clickable = true, tabindex = 0 } = {}) {
  const card = document.createElement('article');
  card.className = 'post-card fade-in';

  const slug = (post.slug || post.id || '').trim();

  if (clickable && slug) {
   
    card.dataset.href = `./post.html?post=${encodeURIComponent(slug)}`;
    card.dataset.slug = slug;

    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', String(tabindex));
    card.setAttribute('aria-label', `打开文章：${post.title || ''}`);
  }

  card.dataset.postId = post.id || '';

  // cover
  const coverDiv = document.createElement('div');
  coverDiv.className = 'post-cover';

  const img = document.createElement('img');
 
  img.src = post.featuredImage || '/assets/images/placeholder.jpg';
  img.alt = post.title || '';
  img.loading = 'lazy';
  img.onerror = function () {
    this.onerror = null;
    this.src = '/assets/images/placeholder.jpg';
  };
  coverDiv.appendChild(img);

  // body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'post-body';

  const metaDiv = document.createElement('div');
  metaDiv.className = 'post-meta';

  const time = document.createElement('time');
  const date = new Date(post.date || '');
  if (!isNaN(date.getTime())) time.setAttribute('datetime', date.toISOString());
  time.textContent = formatDate(post.date, { year: 'numeric', month: 'long', day: 'numeric' });
  metaDiv.appendChild(time);

  if (post.category) {
    const categoryLink = document.createElement('a');
    categoryLink.className = 'badge';
    categoryLink.href = `./category.html?cat=${encodeURIComponent(post.category)}`;
    categoryLink.setAttribute('aria-label', `查看分类：${post.category}`);
    categoryLink.textContent = post.category;
    metaDiv.appendChild(categoryLink);
  }

  const title = document.createElement('h3');
  title.className = 'post-title';
  title.textContent = post.title || '无标题';

  bodyDiv.appendChild(metaDiv);
  bodyDiv.appendChild(title);

  if (post.excerpt) {
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = post.excerpt;
    bodyDiv.appendChild(excerpt);
  }

  card.appendChild(coverDiv);
  card.appendChild(bodyDiv);

  return card;
}


  function formatDate(dateStr, options = {}) {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
      });
    } catch {
      return '';
    }
  }