# filetools

Free file utilities that run entirely in your browser. No account, no file
uploads, no sign-up — every tool works by processing your file locally, on
your own device.

Live tools:

- **Merge PDF** — combine multiple PDF files into one.
- **Split a PDF** — extract specific pages, or split every page into its
  own file.
- **Rotate a PDF** — fix sideways pages, one at a time or all at once.
- **Extract Tables from PDF to CSV** — finds tables in a PDF, shows exactly
  what it found so you can fix a column before exporting, then downloads a
  CSV per table.

## Why it's built this way

Most free PDF tools upload your file to a server, process it there, and
send a result back. This site does the same work directly in your browser
instead — nothing about your file's contents ever travels over the network.
See `/how-this-works/` on the live site for the detail.

## Development

```
npm install
npm run build      # writes the static site to dist/
npm run serve       # serve dist/ locally on http://localhost:8080
npm test             # unit + end-to-end tests (requires a fresh `npm run build`)
npm run visual-qa -- dist/index.html   # screenshots + a Lighthouse summary
```

Static output only — no server-side code, no database, no build-time
secrets. `src/build.js` writes a complete `dist/` directory: pre-rendered
HTML for every page, the browser-side tool logic, and the (self-hosted)
third-party libraries each tool depends on.

## Stack

- Plain Node.js as a static site generator — no framework, no bundler.
- [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT) for PDF page
  manipulation.
- [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0) for reading and
  rendering PDF pages in the browser.

Both libraries are copied into `vendor/` at build time and served from this
site's own origin — never a CDN — so a tool page keeps working even with no
network connection once it's loaded.

## Third-party origins

Every origin loaded by the live site, and why:

- `pagead2.googlesyndication.com` — Google AdSense, the site's ad script.
- `gc.zgo.at` — GoatCounter, privacy-friendly visit-count analytics (no
  cookies, no personal data collected).

Nothing else is fetched from a third-party origin at runtime — `pdf-lib` and
`pdf.js` are vendored into this site's own origin (see Stack, above), not
loaded from a CDN.
