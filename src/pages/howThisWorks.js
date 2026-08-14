'use strict';

const { renderPage } = require('../shell.js');
const { url, absoluteUrl } = require('../site.js');

function renderHowThisWorksPage() {
  const mainHtml = `    <h1>How this works</h1>
    <p class="deck">Every tool on this site runs entirely inside your browser. Here’s exactly what that means and how you can check it yourself.</p>

    <h2>Nothing you process is ever sent anywhere</h2>
    <p>When you choose or drop a file, it’s read directly by your browser’s own JavaScript engine. The libraries that do the actual work — merging pages, splitting a document, rotating a page — are downloaded once from this site and then run on your device using your device’s own processing power. Your file’s contents never travel over the network at any point.</p>
    <p>You can verify this yourself: open a tool page, let it finish loading, then turn off your Wi-Fi or unplug your network cable. The tool still works. That’s not a coincidence — it’s a direct consequence of how the site is built, not a claim we’re asking you to take on faith.</p>

    <h2>What does leave your device</h2>
    <p>Two things, and we’d rather say so plainly than let a privacy pitch overstate itself:</p>
    <ul>
      <li><strong>A page-view count.</strong> This site uses GoatCounter, a privacy-focused analytics service, to count visits. It doesn’t use cookies or collect personal information.</li>
      <li><strong>Advertising.</strong> This site runs Google AdSense to help cover its costs. AdSense may set its own cookies and use data according to Google’s own policies, which we don’t control.</li>
    </ul>
    <p>Neither of those has anything to do with the files you process — that part genuinely never leaves your device. Full detail on both: see the <a href="${url('privacy/')}">privacy page</a>.</p>

    <h2>Why build it this way</h2>
    <p>Most free PDF and file tools work by sending your file to a server, doing the work there, and sending a result back. That’s simpler to build, but it means a copy of your file — which might be a contract, a statement, or anything else you didn’t necessarily want to hand to a third party — passes through someone else’s infrastructure. Running everything in the browser means that step just doesn’t exist.</p>
`;

  return renderPage({
    slug: 'how-this-works',
    title: 'How This Works — filetools',
    metaDescription: 'Exactly how filetools processes files entirely in your browser, what data actually leaves your device, and why it’s built this way.',
    breadcrumb: [
      { name: 'Home', href: url() },
      { name: 'How this works' },
    ],
    mainHtml,
    canonical: absoluteUrl('how-this-works/'),
  });
}

module.exports = { renderHowThisWorksPage };
