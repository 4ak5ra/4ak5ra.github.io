/**
 * @file Menu config (data-only)
 */

export const MENU_ITEMS = Object.freeze([
  Object.freeze({
    key: 'posts',
    title: '文章',
    desc: '全部文章',
    href: './pages/posts.html',
    img: './assets/images/btn/posts.jpg',
    imgHover: './assets/images/btn/posts-hover.jpg',
    x: 10,
    y: 39,
    featured: true
  }),
  Object.freeze({
    key: 'category',
    title: '分类文章',
    desc: '按属性方便查找',
    href: './pages/category.html',
    img: './assets/images/btn/category.jpg',
    imgHover: './assets/images/btn/category-hover.jpg',
    x: 23,
    y: 42
  }),
  Object.freeze({
    key: 'links',
    title: '友链',
    desc: '朋友们的站点',
    href: './pages/links.html',
    img: './assets/images/btn/links.jpg',
    imgHover: './assets/images/btn/category-hover.jpg', //后续拓展改这里
    x: 7,
    y: 67
  }),
  Object.freeze({
    key: 'about',
    title: '关于',
    desc: '我自己',
    href: './pages/about.html',
    img: './assets/images/btn/about.jpg',
    imgHover: './assets/images/btn/category-hover.jpg',
    x: 18,
    y: 65
  })
]);

/**
 * Optional validation helper.
 * @param {any} item
 * @returns {boolean}
 */
export function validateMenuItem(item) {
  const required = ['key', 'title', 'href', 'img', 'x', 'y'];
  return !!item && required.every((k) => k in item);
}
