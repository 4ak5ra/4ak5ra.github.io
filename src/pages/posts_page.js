// posts页面 - 组合模块实现无限滚动文章列表
import { fetchPosts } from '../data/post_api.js';
import { createPostStore, createTextFilter, sortByDateDesc } from '../core/post_store.js';
import { renderPostList } from '../core/post_renderer.js';
import { createInfiniteScroll } from '../modules/infinite_scroll.js';
import { setupCardNavigation, setupSearchInput } from '../core/dom_bindings.js';

// 1. 初始化核心存储（保持单例没问题）
const store = createPostStore(async () => {
  const posts = await fetchPosts();
  return sortByDateDesc(posts);
});

// 2. 状态变量
let currentPage = 1;
const pageSize = 10;
let cleanupFunctions = [];


function getEls() {
  const shellEl = document.querySelector('.posts-shell');
  const listEl = document.getElementById('posts-list');
  const metaEl = document.getElementById('meta');
  const loadMoreEl = document.getElementById('loadMore');
  const searchEl = document.getElementById('search');
  return { shellEl, listEl, metaEl, loadMoreEl, searchEl };
}

// 4. 渲染当前页面的文章
function renderCurrentPage(els) {
  const { listEl, metaEl, loadMoreEl } = els;
  if (!listEl || !metaEl) return;

  const state = store.getState();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 清除当前页内容
  if (currentPage === 1) {
    listEl.innerHTML = '';
  }

  const start = (currentPage - 1) * pageSize;
  const items = state.filtered.slice(start, start + pageSize);

  const fragment = renderPostList(items, { clickable: true });
  listEl.appendChild(fragment);

  const loadedCount = Math.min(start + items.length, total);
  metaEl.textContent = state.loading
    ? '加载中...'
    : `共 ${total} 篇 · 已加载 ${loadedCount} 篇`;

  if (loadMoreEl) {
    if (state.loading) {
      loadMoreEl.textContent = '加载中...';
      loadMoreEl.style.display = 'block';
      loadMoreEl.setAttribute('aria-hidden', 'false');
    } else if (currentPage >= totalPages) {
      loadMoreEl.textContent = total > 0 ? '已加载全部' : '';
      loadMoreEl.style.display = total > 0 ? 'block' : 'none';
      loadMoreEl.setAttribute('aria-hidden', total > 0 ? 'false' : 'true');
    } else {
      loadMoreEl.textContent = 'Loading…';
      loadMoreEl.style.display = 'block';
      loadMoreEl.setAttribute('aria-hidden', 'false');
    }
  }
}

// 5. 加载下一页
function loadNextPage(els) {
  const state = store.getState();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (state.loading || currentPage >= totalPages) return;

  currentPage++;
  renderCurrentPage(els);
}

// 6. 重置并重新加载
function resetAndLoad(els) {
  currentPage = 1;
  renderCurrentPage(els);
}

// 8. 清理函数
function cleanup() {
  cleanupFunctions.forEach((fn) => {
    try {
      if (typeof fn === 'function') fn();
    } catch (e) {
      console.error('清理函数执行失败:', e);
    }
  });
  cleanupFunctions = [];
}

// 7. 初始化应用
async function initApp() {
  cleanup();           
  currentPage = 1;    

  const els = getEls();
  const { shellEl, listEl, loadMoreEl, searchEl } = els;

  if (!listEl) return;

  listEl.innerHTML = '<p class="muted">Loading…</p>';

  try {

    const unsubscribe = store.subscribe(() => renderCurrentPage(els));
    cleanupFunctions.push(unsubscribe);

    // 无限滚动：root 就是 posts-shell
    if (shellEl && loadMoreEl) {
      const scrollModule = createInfiniteScroll(shellEl, loadMoreEl, {
        rootMargin: '400px',
        onLoad: () => loadNextPage(els),
      });

      scrollModule.attach();
      cleanupFunctions.push(() => scrollModule.detach());
    }

    // 卡片导航（事件委托，绑定在 listEl 上）
    cleanupFunctions.push(setupCardNavigation(listEl));

    // 搜索输入
    if (searchEl) {
      cleanupFunctions.push(
        setupSearchInput(
          searchEl,
          (query) => {
            store.applyFilter(createTextFilter(query));
            resetAndLoad(els);
          },
          120
        )
      );
    }

    // 加载数据
    await store.refresh();
  } catch (error) {
    console.error('初始化失败:', error);
    listEl.innerHTML = '<p class="muted">加载失败，请刷新重试</p>';
  }
}


initApp();

// 处理：返回时重新 init
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return; 
    cleanup();
  });

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    initApp(); 
  });

  window.addEventListener('beforeunload', cleanup);
}
