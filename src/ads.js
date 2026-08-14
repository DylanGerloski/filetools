'use strict';

// Renders ad-slot placeholders and the AdSense loader script, gated by
// src/adConfig.js. No network calls, no ToS action -- this module only
// emits static markup. Placement rule (binding): never
// above or beside the drop zone -- callers only place a slot after the FAQ
// (in-content) or in the footer.

const adConfig = require('./adConfig.js');

/**
 * @param {'inContent'|'footer'} slotName
 * @returns {string} an <aside class="ad-slot"> block. When adConfig.enabled
 *   is true and this slot has a real slot id, emits the standard responsive
 *   AdSense unit. Otherwise emits the same reserved-height placeholder with
 *   no <script> tag, so a disabled build is fully deterministic.
 */
function adSlot(slotName) {
  const slotId = adConfig.slots[slotName];
  if (adConfig.enabled && slotId) {
    return `<aside class="ad-slot" aria-label="Advertisement">
  <span class="ad-slot-label">Advertisement</span>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${adConfig.client}" data-ad-slot="${slotId}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</aside>`;
  }
  return `<aside class="ad-slot" aria-label="Advertisement">
  <span class="ad-slot-label">Advertisement</span>
</aside>`;
}

/**
 * @returns {string} the async adsbygoogle.js Auto ads loader <script> tag.
 *   Unconditional -- uses the human's existing, approved AdSense account,
 *   same as both live sibling assets.
 */
function adsScriptTag() {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adConfig.client}" crossorigin="anonymous"></script>`;
}

module.exports = { adSlot, adsScriptTag };
