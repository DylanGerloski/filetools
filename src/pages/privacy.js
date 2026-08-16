'use strict';

const { renderPage } = require('../shell.js');
const { url, absoluteUrl } = require('../site.js');

function renderPrivacyPage() {
  const mainHtml = `    <h1>Privacy</h1>
    <p class="deck">This page states plainly what does and doesn’t happen to your data on this site.</p>

    <h2>The files you process</h2>
    <p>Files you choose or drop into any tool on this site are processed entirely on your own device, inside your browser. They are never transmitted to this site’s server, to us, or to any third party. See <a href="${url('how-this-works/')}">how this works</a> for the detail and for a way to verify it yourself.</p>

    <h2>Analytics</h2>
    <p>This site uses <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a>, a privacy-focused analytics tool, to count page views. GoatCounter’s default configuration does not use cookies and does not collect personally identifiable information. See <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter’s own privacy policy</a> for detail.</p>

    <h2>Advertising</h2>
    <p>This site displays advertisements served by Google AdSense. Google and its partners may use cookies to serve ads based on your prior visits to this or other websites. You can opt out of personalized advertising by visiting <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">Google’s Ads Settings</a>. See Google’s own <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">policy on how it uses information from sites that use its services</a>.</p>

    <h2>Support links</h2>
    <p>Pages on this site may include voluntary support links (<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>, <a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>). These are optional and have no effect on how any tool works.</p>

    <h2>What we don’t do</h2>
    <p>We don’t run our own server-side tracking beyond the analytics above. We don’t sell data - there’s no file data to sell, since it never reaches us. We don’t require an account or any personal information to use any tool on this site.</p>
`;

  return renderPage({
    slug: null,
    title: 'Privacy - filetools',
    metaDescription: 'What data filetools collects, what it doesn’t, and exactly what happens to the files you process.',
    breadcrumb: [
      { name: 'Home', href: url() },
      { name: 'Privacy' },
    ],
    mainHtml,
    canonical: absoluteUrl('privacy/'),
  });
}

module.exports = { renderPrivacyPage };
