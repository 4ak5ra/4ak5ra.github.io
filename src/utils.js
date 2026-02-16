


// 把“创建元素 + 设置属性/样式/事件 + 添加子节点”压缩成一个统一接口：
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "style" && v && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }

  for (const child of children) {
    node.append(child);
  }
  return node;
}

// 把“hover 换图”的规则统一封装
export function bindHoverSwap(imgEl, normalSrc, hoverSrc) {
  if (!hoverSrc) return;
  const onEnter = () => (imgEl.src = hoverSrc);
  const onLeave = () => (imgEl.src = normalSrc);
  imgEl.addEventListener("mouseenter", onEnter);
  imgEl.addEventListener("mouseleave", onLeave);
}

// HTML 转义函数
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 格式化日期函数
export function formatDate(dateStr, options = {}) {
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

// 截断文本函数
export function truncateText(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

// 防抖函数
export function debounce(fn, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}
