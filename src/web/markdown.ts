// File: src/web/markdown.ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Markdown bodies in CAP are untrusted input, not authored copy: document
 * content, card descriptions and comments are all writable by any MCP client
 * via `create_document` / `update_document` / `update_card` / `add_comment`.
 * A compromised or hostile agent can therefore put arbitrary HTML in front of
 * the human operator.
 *
 * Every `dangerouslySetInnerHTML` in the web UI must go through this function.
 * Never call `marked.parse` directly at a render site — that is the mistake
 * this module exists to make hard to repeat.
 */

// Links come from untrusted content, so they open detached from this window.
// `noopener` also denies the opened page a handle back via `window.opener`.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const SANITIZE_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  // HTML only. SVG and MathML are not used by any document in this app and
  // carry most of the known mXSS surface, so they are not worth allowing.
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target'],
  // DOMPurify's html profile permits forms. Script injection is not the only
  // risk here: a form posting to an attacker's endpoint, rendered inside the
  // operator's trusted UI, is a credential-phishing surface. No legitimate
  // document, card or comment needs interactive controls.
  FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'option'],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parses markdown and sanitizes the result. Returns HTML safe to hand to
 * `dangerouslySetInnerHTML`.
 *
 * @param content  Untrusted markdown. Null/undefined/blank yields `fallback`.
 * @param fallback Markdown to render when `content` is empty.
 */
export function renderMarkdown(content: string | null | undefined, fallback = ''): string {
  const source = content && content.trim() ? content : fallback;
  if (!source) return '';

  const html = marked.parse(source, { async: false }) as string;

  // DOMPurify needs a DOM. Without one it reports `isSupported: false` and
  // `sanitize` passes input through untouched — so check rather than trust it,
  // and degrade to escaped plain text instead of emitting raw HTML.
  if (!DOMPurify.isSupported) {
    return `<pre>${escapeHtml(source)}</pre>`;
  }

  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as string;
}
