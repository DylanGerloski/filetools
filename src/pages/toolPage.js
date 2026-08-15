'use strict';

const { renderPage, adSlot, escapeHtml } = require('../shell.js');
const { breadcrumbJsonLd, softwareApplicationJsonLd, faqPageJsonLd } = require('../structuredData.js');
const { toolBySlug } = require('../tools/index.js');
const { url, absoluteUrl } = require('../site.js');

// Kept in sync BY HAND with src/browser/dropzone.client.js's own
// MAX_BYTES_BY_CLIENT/DEFAULT_MAX_BYTES (this file is Node/CommonJS
// build-time code, that one is a browser ES module copied verbatim into
// dist/ -- see src/build.js -- so there's no single runtime-shared module
// today). Only used here to render an honest per-tool caption; the actual
// enforcement is dropzone.client.js's job. If you change one, change both.
const MAX_BYTES_BY_CLIENT = {
  pdfPages: 200 * 1024 * 1024,
  pdfTables: 100 * 1024 * 1024,
  statementToCsv: 100 * 1024 * 1024,
  htmlTableToCsv: 20 * 1024 * 1024,
  dedupeLines: 20 * 1024 * 1024,
  sortLines: 20 * 1024 * 1024,
  jsonToCsv: 20 * 1024 * 1024,
};
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

function formatMb(bytes) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * @param {object} tool one entry from src/tools/index.js.
 * @returns {string} the complete standalone HTML document for that tool's
 *   page. Shared by all three merge/split/rotate tool pages -- the client
 *   module (src/browser/pdfPages.client.js) reads data-mode off #tool to
 *   decide which controls to render/behave as, so this template does not
 *   fork per tool beyond copy and the accept/multiple attributes.
 */
function renderToolPage(tool) {
  const canonical = absoluteUrl(`${tool.category}/${tool.slug}/`);

  const howItems = tool.howSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('\n        ');
  const faqItems = tool.faqs.map((f) => `<div class="faq-item">
        <h3>${escapeHtml(f.q)}</h3>
        <p>${f.answerHtml}</p>
      </div>`).join('\n      ');

  const related = tool.relatedSlugs
    .map((slug) => toolBySlug(slug))
    .filter(Boolean)
    .map((t) => `<a class="related-card" href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">
        <h3>${escapeHtml(t.navLabel)}</h3>
        <p>${escapeHtml(t.deck)}</p>
      </a>`)
    .join('\n      ');

  const fileTypeLabel = tool.fileTypeLabel || 'PDF';
  const dzTitle = tool.multiple ? `Drop your ${fileTypeLabel} files here` : `Drop your ${fileTypeLabel} here`;
  const chooseLabel = tool.multiple ? 'Choose files' : 'Choose file';

  const pasteHtml = tool.pasteInput
    ? `<div class="or-divider" role="separator" aria-label="or"><span>or</span></div>
      <div class="paste-input">
        <label for="paste-textarea">${escapeHtml(tool.pasteInput.label)}</label>
        <textarea id="paste-textarea" class="paste-textarea" placeholder="${escapeHtml(tool.pasteInput.placeholder)}" rows="6" spellcheck="false"></textarea>
        <button type="button" id="paste-convert" class="btn-secondary paste-convert-btn">${escapeHtml(tool.pasteInput.buttonLabel)}</button>
      </div>`
    : '';

  const mainHtml = `    <h1>${escapeHtml(tool.h1)}</h1>
    <p class="deck">${escapeHtml(tool.deck)}</p>
    <section id="tool" aria-labelledby="tool-h" data-mode="${escapeHtml(tool.mode)}" data-client="${escapeHtml(tool.clientEntry)}" data-accept="${escapeHtml(tool.accepts)}"${tool.multiple ? ' data-multiple="true"' : ''}>
      <h2 id="tool-h" class="sr-only">${escapeHtml(tool.h1)}</h2>
      <div class="dropzone" data-state="idle">
        <svg class="dz-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M17 8h20l14 14v34a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M37 8v14h14" fill="none" stroke="currentColor" stroke-width="3"/></svg>
        <p class="dz-title">${escapeHtml(dzTitle)}</p>
        <label class="btn-primary" for="file-input">${escapeHtml(chooseLabel)}</label>
        <input id="file-input" type="file" class="sr-only" accept="${escapeHtml(tool.accepts)}"${tool.multiple ? ' multiple' : ''}>
        <p class="dz-caption">Up to ${formatMb(MAX_BYTES_BY_CLIENT[tool.clientEntry] || DEFAULT_MAX_BYTES)} per file. Stays on this device.</p>
      </div>
      <p class="dz-proof">Nothing is sent anywhere. Turn off your Wi-Fi and this page still works — try it.</p>
      ${pasteHtml}
      <div class="dz-status" role="status" aria-live="polite"></div>
      <div class="result" hidden></div>
    </section>

    <section class="how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol class="how-steps">
        ${howItems}
      </ol>
    </section>

    <section class="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">Frequently asked questions</h2>
      ${faqItems}
    </section>

    ${adSlot('inContent')}

    <section class="related" aria-labelledby="related-h">
      <h2 id="related-h">Related tools</h2>
      <div class="related-grid">
      ${related}
      </div>
    </section>

    <p class="caption">Files are processed locally in your browser and never uploaded. Read more on the <a href="${escapeHtml(url('privacy/'))}">privacy page</a>.</p>

    <script type="module" src="${escapeHtml(url('js/dropzone.client.js'))}"></script>
`;

  const jsonLd = [
    softwareApplicationJsonLd({ name: tool.h1, description: tool.metaDescription, url: canonical }),
    breadcrumbJsonLd([
      { name: 'Home', url: absoluteUrl() },
      { name: tool.h1, url: canonical },
    ]),
    faqPageJsonLd(tool.faqs.map((f) => ({ q: f.q, answerHtml: f.answerHtml }))),
  ];

  // Note: only two breadcrumb levels (Home / <Tool>) -- there's no
  // dedicated category hub page (e.g. /pdf/) in this build for a "PDF
  // tools" crumb to link to, and linking structured data at a page that
  // doesn't exist would be worse than omitting the level.
  return renderPage({
    slug: tool.slug,
    title: tool.title,
    metaDescription: tool.metaDescription,
    breadcrumb: [
      { name: 'Home', href: url() },
      { name: tool.h1 },
    ],
    mainHtml,
    jsonLd,
    canonical,
    wide: true,
    skipTarget: '#tool',
  });
}

module.exports = { renderToolPage };
