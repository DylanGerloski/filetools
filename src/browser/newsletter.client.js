// Sitewide newsletter-signup embed loader. Loaded as a plain
// <script type="module"> on every page (see renderFooter() in src/shell.js
// and its two call sites, renderPage() and render404Page()).
//
// The signup box in the footer reserves its layout space immediately (see
// .newsletter-embed in src/css.js) but the actual third-party iframe is
// only created once its container scrolls near the viewport. Substack's
// embed loads its own scripts/analytics on request, and doing that
// unconditionally on every page load (the footer is sitewide) cost this
// site's whole Lighthouse Performance budget -- see docs/CHANGELOG.md for
// the measured before/after. Deferring to visibility keeps the signup box
// fully functional while keeping it off the initial-load critical path.
(function () {
  const slots = document.querySelectorAll('[data-newsletter-slot]');
  if (!slots.length) return;

  function loadEmbed(slot) {
    const src = slot.getAttribute('data-newsletter-src');
    const title = slot.getAttribute('data-newsletter-title') || 'Email signup form';
    if (!src || !/^https:\/\//.test(src)) return;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = '480';
    iframe.height = '320';
    iframe.loading = 'lazy';
    iframe.title = title;
    iframe.className = 'newsletter-embed';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    slot.replaceWith(iframe);
  }

  if (!('IntersectionObserver' in window)) {
    // No IntersectionObserver support: fail open rather than leaving the
    // signup box permanently empty.
    slots.forEach(loadEmbed);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          loadEmbed(entry.target);
        }
      }
    },
    { rootMargin: '200px 0px' }
  );
  slots.forEach((slot) => observer.observe(slot));
})();
