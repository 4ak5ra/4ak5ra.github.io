/**
 * @file Menu component renderer (view-only)
 */

import { el, bindHoverSwap } from '../utils.js';
import { validateMenuItem } from '../data/menu_items.js';

/**
 * Render menu items into container.
 * @param {HTMLElement} menuEl
 * @param {Array<any>} items
 */

export function renderMenu(menuEl, items) {
  if (!(menuEl instanceof HTMLElement)) {
    throw new TypeError('renderMenu: menuEl must be an HTMLElement');
  }
  if (!Array.isArray(items)) {
    throw new TypeError('renderMenu: items must be an array');
  }

  // Optional: validate items (fail fast but not too strict)
  for (const it of items) {
    if (!validateMenuItem(it)) {
      throw new Error(`renderMenu: invalid menu item: ${JSON.stringify(it)}`);
    }
  }

  menuEl.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const it of items) {
    frag.appendChild(createMenuItem(it));
  }

  menuEl.appendChild(frag);
}

/**
 * @param {any} it
 * @returns {HTMLElement}
 */
function createMenuItem(it) {
  const img = el('img', { src: it.img, alt: it.title });

  // hover 换图（可选）
  if (it.imgHover) {
    bindHoverSwap(img, it.img, it.imgHover);
  }

  return el(
    'a',
    {
      class: `menu-item${it.featured ? ' menu-item--featured' : ''}`,
      href: it.href,
      style: { left: `${it.x}%`, top: `${it.y}%` }
    },
    [
      el('div', { class: 'avatar' }, [img]),
      el('div', { class: 'ribbon' }, [
        document.createTextNode(it.title)
        // 移除了desc部分
      ])
    ]
  );
}
