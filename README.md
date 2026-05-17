# gluonforce.com

Marketing site for [Gluon Force](https://gluonforce.com) — AI-powered Sri Lankan engineering teams building products alongside founders.

Static HTML, CSS, and vanilla JavaScript. No build step, package manager, or dependencies.

## Local development

From the repo root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/](http://localhost:8080/) in your browser.

## Project structure

| File / folder   | Purpose |
|-----------------|---------|
| `index.html`    | Single-page layout: hero, scroll-driven services, contact |
| `styles.css`    | Glassmorphism theme, layout, scroll viewport, animations |
| `script.js`     | Scroll tracking, scene management, navbar, form handling |
| `assets/`       | Logo mark (PNG), SVG logo, legacy assets |

## Scroll-driven experience

The services section uses a sticky viewport pattern:

- `.scroll-experience` is a tall scroll container; `.scroll-viewport` stays `position: sticky` in the viewport.
- `script.js` tracks scroll progress and toggles `.active` on `.scene` elements.
- `styles.css` handles transitions and entry animations.

Validate changes by serving locally and testing scroll behavior, mobile nav, and the contact form in the browser.

## Deployment

Serve the repo root as static files (e.g. GitHub Pages, S3 + CloudFront, Netlify, or any static host). No compile or bundle step required.
