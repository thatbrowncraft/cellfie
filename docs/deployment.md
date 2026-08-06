# Deploying Cellfie — GitHub Actions → GitHub Pages

Push to `main`, wait about a minute, open the URL on your phone. That's the whole workflow once this is set up.

---

## 1. What got added

```
cellfie/
├── .github/
│   └── workflows/
│       └── deploy.yml        ← the automation: build + deploy on every push to main
├── public/
│   ├── 404.html               ← lets deep links / refreshes work on GitHub Pages
│   └── .nojekyll               ← tells GitHub Pages not to run its Jekyll processor
├── index.html                 ← small script added (decodes 404.html's redirect)
├── vite.config.ts              ← now reads BASE_PATH so the build works under a subpath
├── src/App.tsx                 ← router now uses that same base path
└── docs/
    └── deployment.md           ← you are here
```

Nothing else changed. The Library module, design system, and every existing page work exactly as before — these files are purely about *how the built app gets from your machine to a URL on your phone*.

---

## 2. Why a few of these exist (the short version)

- **GitHub Pages serves project sites from `/<repo-name>/`, not `/`.** A build that assumes it lives at the domain root will load a blank page under that subpath. `vite.config.ts` and `App.tsx` now read a `BASE_PATH` value so the same code works locally (`/`) and on Pages (`/cellfie/`, or whatever your repo is named) without you touching anything by hand — the workflow sets it automatically from your repo's name.
- **GitHub Pages has no server-side routing.** If you're on `yoursite.github.io/cellfie/library` and hit refresh, GitHub looks for a real folder called `library` and, not finding one, serves `404.html`. The `404.html` + `index.html` pair added here is a well-known workaround: `404.html` redirects back to the app with the intended path encoded in the URL, and a small script in `index.html` decodes it before React Router ever sees it. Without this, only the home page would survive a refresh or a direct link.
- **`.nojekyll`** stops GitHub from trying to process the build output as a Jekyll site, which can otherwise interfere with how folders starting with `_` (and some build tool output patterns) are served.

---

## 3. One-time setup

### Step 1 — Push this project to a GitHub repository

This workflow assumes **the repository root is the Vite project root** — i.e. `package.json` sits directly at the top of the repo, not inside a nested `cellfie/` folder. That means: push the *contents* of this `cellfie/` folder, not the folder itself.

```bash
cd cellfie
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> **Keeping the nested `cellfie/` folder instead?** Open `.github/workflows/deploy.yml` and uncomment the `working-directory: cellfie` line under the `build` job, and change `path: dist` near the bottom to `path: cellfie/dist`. Everything else works the same either way.

### Step 2 — Enable GitHub Pages, pointed at Actions

In your repository on GitHub:

**Settings → Pages → Build and deployment → Source → select "GitHub Actions"**

That's the only manual setting. You do *not* need to pick a branch or folder — the workflow handles the actual deployment.

### Step 3 — Watch the first deploy run

Go to the **Actions** tab. Pushing to `main` (which you just did in Step 1) should have already triggered a run called "Deploy to GitHub Pages." Click into it — two jobs run in sequence, `build` then `deploy`. When both are green, your **Settings → Pages** page will show a live URL:

```
https://<your-username>.github.io/<your-repo>/
```

Open that on your phone — that's it, no app store, no build step on your end.

---

## 4. Everyday workflow, after setup

```
┌──────────────────────────────────────────────────────────────────────────┐
│  YOUR COMPUTER                                                            │
│                                                                            │
│   1. Edit files in  src/  (e.g. src/modules/library/LibraryPage.tsx)     │
│   2. git add . && git commit -m "..." && git push                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                      │  push to main
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  GITHUB                                                                   │
│                                                                            │
│   3. .github/workflows/deploy.yml triggers automatically                 │
│        ├─ checkout your code                                             │
│        ├─ npm ci            (install dependencies)                       │
│        ├─ npm run build     (tsc -b && vite build → dist/)               │
│        ├─ upload dist/ as the Pages artifact                             │
│        └─ deploy it to GitHub Pages                                      │
│                                                                            │
│      ~30–90 seconds, visible under the "Actions" tab                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                      │  Pages URL now serves the new build
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  YOUR ANDROID PHONE                                                       │
│                                                                            │
│   4. Open https://<you>.github.io/<repo>/  in Chrome                     │
│   5. (First time) Chrome menu → "Add to Home screen" → installs as a     │
│      standalone PWA, offline-capable, its own icon                       │
│   6. Later visits/pushes: just reopen the app — it self-updates          │
│      quietly in the background (see note below if it seems stale)        │
└──────────────────────────────────────────────────────────────────────────┘
```

You never run a build locally, and you never touch your phone except to open the URL (once) and add it to your home screen (once).

---

## 5. Where every deployment-related file lives — quick reference

```
Which folder?              What goes there?                          Do you ever edit it?
──────────────────────    ────────────────────────────────────────   ──────────────────────
.github/workflows/         deploy.yml — the CI/CD automation           Rarely — only if you
                                                                        change repo layout or
                                                                        Node version
public/                    404.html, .nojekyll, favicon.svg,           Only 404.html if you
                            future static assets (icons, etc.)         change pathSegmentsToKeep
                            → copied as-is into dist/ at build time     (see §6, "renaming repo")
src/                       All application code (modules, core,        Yes — this is where
                            shared, config, App.tsx, main.tsx)          normal work happens
vite.config.ts             Build config, including BASE_PATH logic     Rarely
dist/                      Build OUTPUT — generated fresh by CI on     Never — it's
                            every deploy, not committed to git          .gitignore'd
```

The rule of thumb: **you only ever edit inside `src/` day-to-day.** Everything above it is one-time plumbing.

---

## 6. If you rename the repository

The base path is derived automatically from the repo name at build time (`BASE_PATH: /${{ github.event.repository.name }}/` in `deploy.yml`), so renaming the repo needs no code changes — the next push just builds with the new path. The only thing to double check: if you ever *nest* the app under more than one path segment (e.g. serving from a custom domain's subfolder), update `pathSegmentsToKeep` in `public/404.html` to match how many segments precede your actual routes.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank white page after opening the Pages URL | Base path mismatch — usually from testing a production build locally without setting `BASE_PATH` | This only affects the Pages build; `npm run dev` locally always uses `/` and is unaffected. Check the Actions log for the `Build` step to confirm `BASE_PATH` was set. |
| Refreshing on a page other than the home page shows a GitHub 404 | `404.html` didn't deploy, or `.nojekyll` is missing | Confirm both exist in `public/` and appear in the `dist/` folder the `Build` step produces (check the `Upload build output` step's artifact contents in the Actions log). |
| Phone shows an old version after a new push | The PWA's service worker is caching the previous build | `registerType: 'autoUpdate'` (vite.config.ts) means it *should* self-update within a page load or two. If it seems stuck: Chrome → Settings → Site settings → your Pages URL → "Clear & reset," then reopen. |
| Actions tab shows a failed run | Usually a dependency or Node-version issue | Open the run, check which step failed. `npm ci` failing almost always means `package-lock.json` is out of sync with `package.json` — commit an updated lockfile. |
| "Pages" isn't listed as a deployment source option | Repository is private on a plan that restricts Pages, or Pages hasn't been enabled yet | Public repos on any plan support Pages; for private repos, GitHub Pro/Team/Enterprise is required. |

---

## 8. What this deliberately does *not* do

- No custom domain configuration (add a `CNAME` file in `public/` if you set one up later — ask if you want this wired in).
- No staging/preview environments for pull requests — every push to `main` goes straight to production. Fine for a single-developer, no-account, local-first app; worth revisiting only if that changes.
- No build caching beyond npm's own dependency cache — builds are fast enough at this project's size that it wasn't worth the added workflow complexity.
