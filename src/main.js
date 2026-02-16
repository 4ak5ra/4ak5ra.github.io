/**
 * @file App entry (composition + mounting)
 */

import { MENU_ITEMS } from './data/menu_items.js';
import { renderMenu } from './components/menu.js';
import { init_sakura } from './effects/sakura.js';

export function initApp() {
  const menuEl = document.getElementById('menu');
  if (!menuEl) {
    console.error('initApp: #menu container not found');
    return;
  }

  try {
    renderMenu(menuEl, MENU_ITEMS);
  } catch (err) {
    console.error('initApp: failed to render menu', err);
    menuEl.innerHTML = '<p class="muted">菜单加载失败，请刷新页面</p>';
  }
  // 缺少错误处理，应该使用 try-catch 包裹（后面再优化）
  init_sakura({
      canvas_id: 'sakura',
      num_flowers: 1000,
      speed: 1.3,
      size_min: 0.7,
      size_max: 1.1,
      rotation: 0.25,
      area: 18,
      time_scale: 1.0,
  });
}

// 启动：模块脚本默认 defer
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
