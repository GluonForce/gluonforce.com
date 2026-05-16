# AGENTS.md

## Cursor Cloud specific instructions

This is a static HTML/CSS/JS website (no build system, no package manager, no dependencies to install).

### Serving locally
Run `python3 -m http.server 8080` from the repo root to serve the site on `http://localhost:8080/`.

### Key files
- `index.html` — Single-page site with scroll-driven experience
- `styles.css` — All styles including glassmorphism theme and scroll viewport
- `script.js` — Scroll tracking, scene management, navbar, form handling
- `assets/` — Logo images (PNG, SVG)

### Scroll-driven architecture
The site uses a sticky viewport pattern: `.scroll-experience` is a tall container (600vh) with a `position: sticky` inner viewport. JavaScript tracks scroll progress and toggles `.active` on scene elements. CSS handles transitions and entry animations.

### No lint/test/build tooling
There is no linter, test framework, or build step configured. Validate changes by serving the site and testing in the browser.
