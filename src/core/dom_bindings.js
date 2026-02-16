// 处理DOM事件绑定，副作用集中管理
// 所有函数都返回清理函数（用于卸载时清理）


export function setupCardNavigation(listContainer) {
  if (!listContainer) return () => {};

  function resolveHref(card) {
    if (!card) return "";
    const direct = card.dataset?.href?.trim();
    if (direct) return direct;


    const slug = (card.dataset?.slug || card.dataset?.id || "").trim();
    if (!slug) return "";


    return `./post.html?post=${encodeURIComponent(slug)}`;
  }

  function openCard(card) {
    const href = resolveHref(card);
    if (href) window.location.href = href;
  }

  
  const handleClick = (e) => {

    const a = e.target.closest("a");
    if (a && a.getAttribute("href")) return;

    const card = e.target.closest(".post-card");
    if (!card || !listContainer.contains(card)) return;


    const sel = window.getSelection?.();
    if (sel && String(sel).trim()) return;

    openCard(card);
  };

  const handleKeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;

    const card = e.target.closest(".post-card");
    if (!card || !listContainer.contains(card)) return;

    e.preventDefault();
    openCard(card);
  };

  listContainer.addEventListener("click", handleClick);
  listContainer.addEventListener("keydown", handleKeydown);

  // 返回清理函数
  return () => {
    listContainer.removeEventListener("click", handleClick);
    listContainer.removeEventListener("keydown", handleKeydown);
  };
}


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