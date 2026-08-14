'use strict';

/**
 * Local, one-off generator for the site's identity artwork: the default
 * social-share image (og-default.png, 1200x630) and the Apple home-screen
 * icon (apple-touch-icon.png, 180x180) -- both derived from the same mark
 * as favicon.svg (src/icon.js), so nothing here introduces a second brand
 * mark. Uses Playwright (already a devDependency) to render a small
 * self-contained HTML template and screenshot it.
 *
 * NOT part of `npm run build` -- the main static build must not depend on a
 * browser being available. Run by hand whenever the artwork needs to
 * change, then commit the two files it writes under assets/:
 *
 *   node scripts/build-og-image.js
 *
 * src/build.js copies assets/og-default.png and assets/apple-touch-icon.png
 * into dist/ on every build if they exist.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { ICON_SVG, ACCENT } = require('../src/icon.js');
const { SITE_TAGLINE } = require('../src/site.js');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

function ogImageHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative;
    overflow: hidden;
    background: #f6f7f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .frame {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 96px;
  }
  .mark { width: 88px; height: 88px; margin-bottom: 28px; }
  .wordmark { font-weight: 700; color: #14181f; font-size: 84px; line-height: 1.15; letter-spacing: -0.02em; }
  .wordmark .tail { color: ${ACCENT}; }
  .tagline { color: #5a6472; font-size: 30px; line-height: 1.6; max-width: 820px; margin-top: 24px; }
</style></head>
<body>
  <div class="frame">
    <div class="mark">${ICON_SVG}</div>
    <div class="wordmark">file<span class="tail">tools</span></div>
    <div class="tagline">${SITE_TAGLINE}</div>
  </div>
</body></html>`;
}

function appleTouchIconHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 180px; height: 180px; }
  body { display: flex; align-items: center; justify-content: center; background: ${ACCENT}; }
  .mark { width: 150px; height: 150px; }
  .mark svg { display: block; width: 100%; height: 100%; }
</style></head>
<body><div class="mark">${ICON_SVG}</div></body></html>`;
}

async function screenshotHtml(browser, html, width, height, outFile) {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width, height } });
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    const ogPath = path.join(ASSETS_DIR, 'og-default.png');
    await screenshotHtml(browser, ogImageHtml(), 1200, 630, ogPath);
    console.log(`Wrote ${ogPath} (1200x630)`);

    const iconPath = path.join(ASSETS_DIR, 'apple-touch-icon.png');
    await screenshotHtml(browser, appleTouchIconHtml(), 180, 180, iconPath);
    console.log(`Wrote ${iconPath} (180x180)`);
  } finally {
    await browser.close();
  }

  console.log('Done. Run `npm run build` to copy these into dist/.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('build-og-image failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { ogImageHtml, appleTouchIconHtml };
