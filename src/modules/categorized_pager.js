// 契约：分类分页模块，管理分类状态和分页逻辑
// 输入：store（状态管理）、filtersContainer（分类过滤器容器）、pagerContainer（分页容器）
// 输出：具有分类设置和分页渲染功能的模块

export function createCategorizedPager(store, filtersContainer, pagerContainer) {
  let currentCategory = null;
  let currentPage = 1;
  const pageSize = 10;
  
  // 渲染分类过滤器
  const renderCategoryFilters = (categories) => {
    if (!filtersContainer) return;
    
    filtersContainer.innerHTML = '';
    
    // 添加“全部”按钮
    const allBtn = document.createElement('button');
    allBtn.className = `tag-filter ${!currentCategory ? 'active' : ''}`;
    allBtn.textContent = '全部';
    allBtn.dataset.category = '';
    allBtn.addEventListener('click', () => setCategory(''));
    filtersContainer.appendChild(allBtn);
    
    // 添加分类按钮
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `tag-filter ${currentCategory === cat ? 'active' : ''}`;
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener('click', () => setCategory(cat));
      filtersContainer.appendChild(btn);
    });
  };
  
  // 设置当前分类
  const setCategory = (category) => {
    currentCategory = category || null;
    currentPage = 1;
    
    // 更新按钮激活状态
    if (filtersContainer) {
      const buttons = filtersContainer.querySelectorAll('.tag-filter');
      buttons.forEach(btn => {
        const cat = btn.dataset.category || null;
        btn.classList.toggle('active', cat === (category || ''));
      });
    }
    
    // 应用分类过滤
    store.applyFilter(posts => {
      return category ? posts.filter(p => p.category === category) : posts;
    });
    
    // 重新渲染当前页
    renderPage(currentPage);
  };
  
  // 渲染分页
  const renderPage = (page) => {
    currentPage = page;
    const state = store.getState();
    const filtered = state.filtered;
    
    // 计算分页数据
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    
    // 渲染分页信息
    if (pagerContainer) {
      // 清空容器
      pagerContainer.innerHTML = '';
      
      // 创建分页信息元素
      const pageInfo = document.createElement('span');
      pageInfo.id = 'page_info';
      pageInfo.className = 'muted';
      pageInfo.textContent = `第 ${page} 页，共 ${totalPages} 页`;
      
      // 上一页按钮
      const prevBtn = document.createElement('button');
      prevBtn.id = 'prev';
      prevBtn.className = 'pill';
      prevBtn.textContent = '上一页';
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', () => {
        if (page > 1) renderPage(page - 1);
      });
      
      // 下一页按钮
      const nextBtn = document.createElement('button');
      nextBtn.id = 'next';
      nextBtn.className = 'pill';
      nextBtn.textContent = '下一页';
      nextBtn.disabled = page >= totalPages;
      nextBtn.addEventListener('click', () => {
        if (page < totalPages) renderPage(page + 1);
      });
      
      // 组装分页导航
      const nav = document.createElement('nav');
      nav.className = 'posts-pagination';
      nav.setAttribute('aria-label', '分页');
      nav.appendChild(prevBtn);
      nav.appendChild(pageInfo);
      nav.appendChild(nextBtn);
      
      pagerContainer.appendChild(nav);
    }
    
    return items;
  };
  
  // 初始化：获取所有分类并渲染过滤器
  const init = () => {
    const state = store.getState();
    const categories = [...new Set(state.all.map(p => p.category).filter(Boolean))];
    renderCategoryFilters(categories);
    renderPage(currentPage);
  };
  
  // 订阅store变化，当数据刷新时重新初始化分类过滤器
  const unsubscribe = store.subscribe((state) => {
    if (!state.loading) {
      const categories = [...new Set(state.all.map(p => p.category).filter(Boolean))];
      renderCategoryFilters(categories);
    }
  });
  
  return {
    setCategory,
    renderPage,
    init,
    getCurrentCategory: () => currentCategory,
    getCurrentPage: () => currentPage,
    // 清理函数
    destroy: () => {
      unsubscribe();
    }
  };
}