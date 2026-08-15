'use strict';

/**
 * Static site generator. Writes a complete dist/ directory: every page as
 * pre-rendered HTML (no client-side routing, no runtime data fetch), the
 * two browser client modules, the pure page-range parser (also loaded
 * client-side), the self-hosted vendor libraries, and the identity/SEO
 * files (sitemap.xml, robots.txt, ads.txt, favicon, og-image).
 *
 * Usage: npm run build
 */

const fs = require('fs');
const path = require('path');

const { copyVendor } = require('../scripts/copy-vendor.js');
const { renderHomePage } = require('./pages/home.js');
const { renderHowThisWorksPage } = require('./pages/howThisWorks.js');
const { renderPrivacyPage } = require('./pages/privacy.js');
const { renderToolPage } = require('./pages/toolPage.js');
const { render404Page } = require('./shell.js');
const { TOOLS } = require('./tools/index.js');
const { renderSitemapXml, robotsTxtContent } = require('./sitemap.js');
const { renderRssXml } = require('./rss.js');
const { ICON_SVG } = require('./icon.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const ASSETS_DIR = path.join(ROOT, 'assets');

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeHtml(relDirPath, html) {
  const dir = path.join(OUT_DIR, relDirPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function adsTxtContent() {
  return `# ads.txt for filetools\n# Declares authorized sellers of this site's ad inventory.\n# See https://iabtechlab.com/ads-txt/ for the spec.\ngoogle.com, pub-9767914878112531, DIRECT, f08c47fec0942fa0\n`;
}

function build() {
  rimraf(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Pages
  writeHtml('', renderHomePage());
  writeHtml('how-this-works', renderHowThisWorksPage());
  writeHtml('privacy', renderPrivacyPage());
  TOOLS.forEach((tool) => {
    writeHtml(path.join(tool.category, tool.slug), renderToolPage(tool));
  });
  fs.writeFileSync(path.join(OUT_DIR, '404.html'), render404Page(), 'utf8');

  // 2. Browser client modules -> dist/js/
  const jsDir = path.join(OUT_DIR, 'js');
  fs.mkdirSync(jsDir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'dropzone.client.js'), path.join(jsDir, 'dropzone.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'pdfPages.client.js'), path.join(jsDir, 'pdfPages.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'pdfTables.client.js'), path.join(jsDir, 'pdfTables.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'statementToCsv.client.js'), path.join(jsDir, 'statementToCsv.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'htmlTableToCsv.client.js'), path.join(jsDir, 'htmlTableToCsv.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'dedupeLines.client.js'), path.join(jsDir, 'dedupeLines.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'sortLines.client.js'), path.join(jsDir, 'sortLines.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'flattenJson.client.js'), path.join(jsDir, 'flattenJson.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'jsonToCsv.client.js'), path.join(jsDir, 'jsonToCsv.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'csvMerge.client.js'), path.join(jsDir, 'csvMerge.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'splitCsv.client.js'), path.join(jsDir, 'splitCsv.client.js'));
  fs.copyFileSync(path.join(ROOT, 'src', 'browser', 'newsletter.client.js'), path.join(jsDir, 'newsletter.client.js'));

  // 3. Pure modules also loaded client-side -> dist/pure/
  const pureDir = path.join(OUT_DIR, 'pure');
  fs.mkdirSync(pureDir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'pageRange.mjs'), path.join(pureDir, 'pageRange.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'tableExtract.mjs'), path.join(pureDir, 'tableExtract.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'csv.mjs'), path.join(pureDir, 'csv.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'statementMerge.mjs'), path.join(pureDir, 'statementMerge.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'htmlTableExtract.mjs'), path.join(pureDir, 'htmlTableExtract.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'dedupeLines.mjs'), path.join(pureDir, 'dedupeLines.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'sortLines.mjs'), path.join(pureDir, 'sortLines.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'flattenJson.mjs'), path.join(pureDir, 'flattenJson.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'jsonToCsv.mjs'), path.join(pureDir, 'jsonToCsv.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'csvMerge.mjs'), path.join(pureDir, 'csvMerge.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src', 'pure', 'splitCsv.mjs'), path.join(pureDir, 'splitCsv.mjs'));

  // 4. Vendor libraries (pdf-lib, pdfjs-dist, fflate) -> dist/vendor/
  copyVendor();
  copyDir(path.join(ROOT, 'vendor'), path.join(OUT_DIR, 'vendor'));

  // 5. Identity assets: favicon.svg always generated fresh from icon.js;
  // apple-touch-icon.png / og-default.png are pre-generated by
  // scripts/build-og-image.js (a Playwright script, not part of the plain
  // static build); google679d03facc8b0931.html is a Search Console
  // site-verification file that must keep serving at the site root
  // indefinitely, even after verification succeeds -- do not remove it.
  // All three are just copied in here if present.
  fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), ICON_SVG, 'utf8');
  if (fs.existsSync(ASSETS_DIR)) {
    for (const file of ['og-default.png', 'apple-touch-icon.png', 'google679d03facc8b0931.html']) {
      const src = path.join(ASSETS_DIR, file);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT_DIR, file));
    }
  }

  // 6. sitemap.xml / robots.txt / ads.txt, derived from what was actually
  // written above.
  const sitemapPaths = ['', 'how-this-works/', 'privacy/', ...TOOLS.map((t) => `${t.category}/${t.slug}/`)];
  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), renderSitemapXml(sitemapPaths), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robotsTxtContent(), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'ads.txt'), adsTxtContent(), 'utf8');

  // 7. feed.xml -- RSS of tool launches (see src/rss.js's header comment).
  fs.writeFileSync(path.join(OUT_DIR, 'feed.xml'), renderRssXml(TOOLS), 'utf8');

  console.log(`Built ${TOOLS.length + 3} pages plus 404.html into dist/.`);
}

if (require.main === module) {
  build();
}

module.exports = { build };
