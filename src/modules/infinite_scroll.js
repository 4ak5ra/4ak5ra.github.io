// 契约：无限滚动模块，只提供滚动监听，不包含业务逻辑
// 输入：容器元素、加载器元素、选项
// 输出：具有 attach/detach 方法和事件监听的模块

export function createInfiniteScroll(container, loader, options = {}) {
  if (!container || !loader) {
    console.warn('InfiniteScroll: container or loader element not found');
    return {
      attach: () => {},
      detach: () => {},
      onLoad: () => () => {}
    };
  }

  const {
    rootMargin = '200px',
    threshold = 0.01,
    onLoad: userOnLoad = () => {}
  } = options;

  let observer = null;
  const listeners = [];

  const handleIntersection = (entries) => {
    if (entries.some(e => e.isIntersecting)) {
      listeners.forEach(fn => fn());
      userOnLoad();
    }
  };

  const attach = () => {
    if (observer) return;

    observer = new IntersectionObserver(handleIntersection, {
      root: container,
      rootMargin,
      threshold
    });

    observer.observe(loader);
  };

  const detach = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const onLoad = (fn) => {
    listeners.push(fn);
    return () => {
      const index = listeners.indexOf(fn);
      if (index !== -1) listeners.splice(index, 1);
    };
  };

  return {
    attach,
    detach,
    onLoad
  };
}