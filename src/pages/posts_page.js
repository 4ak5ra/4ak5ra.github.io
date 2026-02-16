// posts页面 - 组合模块实现无限滚动文章列表
import { fetchPosts } from '../data/post_api.js';
import { createPostStore, createTextFilter, sortByDateDesc } from '../core/post_store.js';
import { renderPostList } from '../core/post_renderer.js';
import { createInfiniteScroll } from '../modules/infinite_scroll.js';
import { setupCardNavigation, setupSearchInput } from '../core/dom_bindings.js';

// 1. 初始化核心存储
const store = createPostStore(async () => {
  const posts = await fetchPosts();
  return sortByDateDesc(posts);
});

// 2. 状态变量
let currentPage = 1;
const pageSize = 10;
let cleanupFunctions = [];

// 3. 获取DOM元素
const listEl = document.getElementById('posts-list');
const metaEl = document.getElementById('meta');
const loadMoreEl = document.getElementById('loadMore');
const searchEl = document.getElementById('search');

// 4. 渲染当前页面的文章
function renderCurrentPage() {
  if (!listEl || !metaEl) return;
  
  const state = store.getState();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  
  // 清除当前页内容
  if (currentPage === 1) {
    listEl.innerHTML = '';
  }
  
  // 计算当前页的项目
  const start = (currentPage - 1) * pageSize;
  const items = state.filtered.slice(start, start + pageSize);
  
  // 渲染文章列表
  const fragment = renderPostList(items, { clickable: true });
  listEl.appendChild(fragment);
  
  // 更新元信息
  const loadedCount = Math.min(start + items.length, total);
  metaEl.textContent = state.loading 
    ? '加载中...' 
    : `共 ${total} 篇 · 已加载 ${loadedCount} 篇`;
  
  // 更新加载更多按钮
  if (loadMoreEl) {
    if (state.loading) {
      loadMoreEl.textContent = '加载中...';
    } else if (currentPage >= totalPages) {
      loadMoreEl.textContent = total > 0 ? '已加载全部' : '';
    } else {
      loadMoreEl.textContent = '加载更多';
    }
  }
}

// 5. 加载下一页
function loadNextPage() {
  const state = store.getState();
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  
  if (state.loading || currentPage >= totalPages) return;
  
  currentPage++;
  renderCurrentPage();
}

// 6. 重置并重新加载
function resetAndLoad() {
  currentPage = 1;
  renderCurrentPage();
}

// 7. 初始化应用
async function initApp() {
  if (!listEl) return;

  listEl.innerHTML = '<p class="muted">Loading…</p>';
  
  try {
    // 订阅状态变化
    const unsubscribe = store.subscribe(() => {
      renderCurrentPage();
    });
    cleanupFunctions.push(unsubscribe);
    
    // 初始化无限滚动
    if (listEl && loadMoreEl) {
      const scrollModule = createInfiniteScroll(
        document.querySelector('.posts-shell'),
        loadMoreEl,
        {
          rootMargin: '200px',
          onLoad: loadNextPage
        }
      );
      
      scrollModule.attach();
      cleanupFunctions.push(() => scrollModule.detach());
    }
    
    // 设置卡片导航
    if (listEl) {
      const cleanupNav = setupCardNavigation(listEl);
      cleanupFunctions.push(cleanupNav);
    }
    
    // 设置搜索输入
    if (searchEl) {
      const cleanupSearch = setupSearchInput(searchEl, (query) => {
        store.applyFilter(createTextFilter(query));
        resetAndLoad();
      }, 120);
      cleanupFunctions.push(cleanupSearch);
    }
    
    // 加载数据
    await store.refresh();
    
  } catch (error) {
    console.error('初始化失败:', error);
    if (listEl) {
      listEl.innerHTML = '<p class="muted">加载失败，请刷新重试</p>';
    }
  }
}

// 8. 清理函数
function cleanup() {
  cleanupFunctions.forEach(fn => {
    try {
      if (typeof fn === 'function') fn();
    } catch (e) {
      console.error('清理函数执行失败:', e);
    }
  });
  cleanupFunctions = [];
}

// 9. 初始化应用
initApp();

// 10. 页面卸载时清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
}
