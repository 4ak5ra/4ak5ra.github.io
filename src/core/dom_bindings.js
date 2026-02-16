// 契约：处理DOM事件绑定，副作用集中管理
// 所有函数都返回清理函数（用于卸载时清理）

export function setupCardNavigation(listContainer) {
  if (!listContainer) return () => {};
  
  function openCard(card) {
    const href = card?.dataset?.href;
    if (href) window.location.href = href;
  }
  
  // 鼠标点击：点卡片任意区域进入（但点到内部 <a> 比如分类 badge，不拦截）
  const handleClick = (e) => {
    if (e.target.closest('a')) return;
    
    const card = e.target.closest('.post-card[data-href]');
    if (!card) return;
    
    // 防误触：如果正在选中文字，就不跳
    const sel = window.getSelection?.();
    if (sel && String(sel).trim()) return;
    
    openCard(card);
  };
  
  // 键盘：Enter / Space 打开（因为 post-card 有 tabindex=0）
  const handleKeydown = (e) => {
    const card = e.target.closest('.post-card[data-href]');
    if (!card) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCard(card);
    }
  };
  
  listContainer.addEventListener('click', handleClick);
  listContainer.addEventListener('keydown', handleKeydown);
  
  // 返回清理函数
  return () => {
    listContainer.removeEventListener('click', handleClick);
    listContainer.removeEventListener('keydown', handleKeydown);
  };
}

// 绑定搜索输入
// 契约：接受输入元素和回调函数，返回清理函数
export function setupSearchInput(inputEl, onSearch, debounceDelay = 120) {
  if (!inputEl || !onSearch) return () => {};
  
  import('../utils.js').then(({ debounce }) => {
    const debouncedSearch = debounce((e) => {
      onSearch(e.target.value);
    }, debounceDelay);
    
    inputEl.addEventListener('input', debouncedSearch);
    
    // 存储清理函数在元素上，以便后续清理
    inputEl._searchCleanup = () => {
      inputEl.removeEventListener('input', debouncedSearch);
    };
  }).catch(console.error);
  
  // 返回清理函数
  return () => {
    if (inputEl._searchCleanup) {
      inputEl._searchCleanup();
      delete inputEl._searchCleanup;
    }
  };
}

// 绑定分类过滤器
// 契约：接受容器元素和回调函数，返回清理函数
export function setupCategoryFilters(container, onCategoryChange) {
  if (!container || !onCategoryChange) return () => {};
  
  const handleClick = (e) => {
    const btn = e.target.closest('.tag-filter');
    if (!btn) return;
    
    const category = btn.dataset.category || null;
    onCategoryChange(category);
  };
  
  container.addEventListener('click', handleClick);
  
  return () => {
    container.removeEventListener('click', handleClick);
  };
}