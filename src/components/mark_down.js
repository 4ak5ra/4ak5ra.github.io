import { escapeHTML } from '../utils.js';

function normalizeLang(info) {
  const lang = String(info || '').trim().toLowerCase();
  if (!lang) return 'markup';
  // 你也可以在这里做 alias：例如 'js' -> 'javascript'
  if (lang === 'js') return 'javascript';
  if (lang === 'html') return 'markup';
  if (lang === 'c++' || lang === 'cpp') return 'cpp';
  if (lang === 'c') return 'c';
  if (lang === 'asm' || lang === 'assembly') return 'asm6502';
  return lang;
}

export function setupMarkdown() {
  if (!window.marked) return;

  const renderer = new window.marked.Renderer();


  renderer.code = (code, info = '') => {
    let text = code;
    let lang = info;

    // 如果传进来的是对象（新版）
    if (code && typeof code === 'object') {
      text = code.text ?? '';
      lang = code.lang ?? '';
    }

    const L = normalizeLang(lang);

    // ✅ 给 pre 和 code 都加 language-xxx，让 Prism 主题 + 高亮完整生效
    return `
<pre class="code-block language-${escapeHTML(L)}" data-lang="${escapeHTML(L)}">
  <button class="copy-btn" type="button" data-action="copy-code" aria-label="Copy code">Copy</button>
  <code class="language-${escapeHTML(L)}">${escapeHTML(text)}</code>
</pre>
`.trim();
  };


  
  window.marked.setOptions({
    gfm: true,
    breaks: false,
    renderer
  });
}

export function preprocessMdUrls(md) {
  const s = String(md ?? '');

  // 1) 修复图片：![]( ... )
  // 捕获括号内直到 ')' 为止（包含空格/中文），然后 encodeURI
  const fixedImages = s.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/g, (m, alt, dest) => {
    const raw = String(dest).trim();
    // 如果有 title（例如: url "title"），这里简单处理：只在没有引号 title 的情况下全量 encode
    // 你这种 GitHub raw 图片一般没有 title，所以够用
    const encoded = encodeURI(raw);
    return `![${alt}](${encoded})`;
  });

  // 2) （可选）修复普通链接：[]( ... )
  const fixedLinks = fixedImages.replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (m, text, dest) => {
    const raw = String(dest).trim();
    const encoded = encodeURI(raw);
    return `[${text}](${encoded})`;
  });

  return fixedLinks;
}

/**
 * Markdown -> sanitized HTML
 * @param {string} md
 */
export function mdToSafeHTML(md) {
  const pre = preprocessMdUrls(md);              
  const raw = window.marked ? window.marked.parse(pre) : String(pre);

  if (window.DOMPurify) {
    return window.DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      // ✅ 允许 img 需要的属性
      ADD_TAGS: ['img'],
      ADD_ATTR: [
        'class','data-lang','data-action','aria-label','type',
        'src','alt','title','loading'
      ]
    });
  }
  return raw;
}


/**
 * Prism highlight inside container
 * @param {HTMLElement} container
 */
export function highlightCode(container) {
  if (window.Prism) window.Prism.highlightAllUnder(container);
}

/**
 * Enable copy button via event delegation (call once)
 */
export function enableCodeCopy() {
  document.addEventListener('click', async (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;

    const btn = target.closest('[data-action="copy-code"]');
    if (!(btn instanceof HTMLButtonElement)) return;

    const pre = btn.closest('pre');
    const codeEl = pre?.querySelector('code');
    const text = codeEl?.textContent ?? '';

    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied!';
      window.setTimeout(() => (btn.textContent = 'Copy'), 900);
    } catch {
      btn.textContent = 'Failed';
      window.setTimeout(() => (btn.textContent = 'Copy'), 900);
    }
  });
}
