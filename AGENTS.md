# Repository Guidelines

## Project Structure & Module Organization
- `background.js`: Core extension logic and tab audio management.
- `options.html` / `options.js`: Settings UI and persistence for inclusion/exclusion lists.
- `manifest.chrome.json` / `manifest.firefox.json`: Browser-specific manifest files.
- `build.js`: Build script that packages per-browser outputs into `dist/`.
- `icons/`: Extension icons used by both browsers.
- `dist/`: Generated build artifacts (do not edit by hand).

## Build, Test, and Development Commands
- `node build.js chrome`: Build the Chrome package into `dist/`.
- `node build.js firefox`: Build the Firefox package into `dist/`.
- `npm test`: Currently a placeholder and exits with an error.

## Coding Style & Naming Conventions
- JavaScript is plain ES modules with browser extension APIs; prefer clear, descriptive names.
- Use 2-space indentation and keep functions short and focused.
- Filenames are lower-case with dots for variants (e.g., `manifest.chrome.json`).
- There is no configured formatter or linter; keep edits consistent with existing style.

## Testing Guidelines
- No automated tests are present.
- If adding tests, document the framework and add a runnable script in `package.json`.
- Prefer naming tests after behavior (e.g., `mutes-inactive-tabs`) and keep fixtures minimal.

## Commit & Pull Request Guidelines
- Commit messages in history are short, imperative sentences without a prefix (e.g., "Add compatibility with Chrome").
- Keep PRs focused on one change, include a short summary, and note any user-facing behavior changes.
- If UI or icon changes are included, add screenshots or a brief description of the visual impact.

## Configuration & Security Notes
- The extension’s permissions are controlled by the manifest files; review changes carefully.
- Avoid adding new host permissions unless required and document the reason in the PR.
