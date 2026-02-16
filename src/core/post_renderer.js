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
  // 创建卡片元素
  const card = document.createElement('article');
  card.className = 'post-card fade-in';
  
  if (clickable && post.id) {
    card.dataset.href = `../pages/post.html?post=${encodeURIComponent(post.slug || post.id)}`;
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', tabindex);
    card.setAttribute('aria-label', `打开文章：${post.title || ''}`);
  }
  
  card.dataset.postId = post.id || '';
  
  // 创建封面图片
  const coverDiv = document.createElement('div');
  coverDiv.className = 'post-cover';
  
  const img = document.createElement('img');
  img.src = post.featuredImage || '../assets/images/placeholder.jpg';
  img.alt = post.title || '';
  img.loading = 'lazy';
  img.onerror = function() {
    this.onerror = null;
    this.src = '../assets/images/placeholder.jpg';
  };
  
  coverDiv.appendChild(img);
  
  // 创建内容区域
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'post-body';
  
  // 创建元信息
  const metaDiv = document.createElement('div');
  metaDiv.className = 'post-meta';
  
  const time = document.createElement('time');
  const date = new Date(post.date || '');
  time.setAttribute('datetime', date.toISOString());
  time.textContent = formatDate(post.date, { year: 'numeric', month: 'long', day: 'numeric' });
  
  metaDiv.appendChild(time);
  
  // 如果有分类，添加分类徽章
  if (post.category) {
    const categoryLink = document.createElement('a');
    categoryLink.className = 'badge';
    categoryLink.href = `../pages/category.html?cat=${encodeURIComponent(post.category)}`;
    categoryLink.setAttribute('aria-label', `查看分类：${post.category}`);
    categoryLink.textContent = post.category;
    metaDiv.appendChild(categoryLink);
  }
  
  // 创建标题
  const title = document.createElement('h3');
  title.className = 'post-title';
  title.textContent = post.title || '无标题';
  
  // 组装
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

// 辅助函数：格式化日期
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