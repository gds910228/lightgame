# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LightGame is a frontend-only casual game platform built with React + TypeScript + Vite. It's a monorepo containing a React app and individual games. The platform supports two game integration modes: local games (self-contained HTML/JS files) and iframe games (embedded from 1games.io only).

## High-Level Architecture

### Monorepo Structure
- **packages/app/** - Main React application (Vite + TypeScript)
  - Frontend SPA with routing (React Router)
  - Tailwind CSS for styling
  - Context providers: FavoritesContext, PerformanceContext
  - Games are served from `public/games/` directory
  - Games list generated at `public/games.json`

- **packages/games/** - Source directory for all games
  - Each game has its own folder with `metadata.json`
  - Games are synced to `packages/app/public/games/` via scripts
  - Two types: `local` (source files) or `iframe` (external from 1games.io)

- **scripts/** - Automation scripts for game management
  - `validate-games.js` - Schema validation + iframe embedding checks
  - `sync-games.js` - Sync games from source to public directory
  - `build-games-list.js` - Proxy to app's build-games-list.js
  - `watch-games.js` - File watcher for auto sync during development
  - `lib/can-embed.js` - Embedding validation library
  - `schemas/metadata.schema.json` - JSON Schema for game metadata (draft-07)

- **packages/app/scripts/** - App-specific scripts
  - `build-games-list.js` - Generate games.json from metadata (ES module)
  - `optimize-games.cjs` - Image optimization utilities

### Game Integration System

Games are managed through `metadata.json` files that serve as the single source of truth. The system supports:

**Local Games:**
- Source files in `packages/games/{id}/` with `index.html` and assets
- Synced to `packages/app/public/games/{id}/`
- Accessed at `/games/{id}/index.html`

**Iframe Games:**
- Only from `https://1games.io/` domain (validated in scripts/validate-games.js)
- Require `iframe_url` or `embedUrl` in metadata
- Sync script generates responsive wrapper pages
- Must pass X-Frame-Options and CSP frame-ancestors checks

**Metadata Schema (packages/games/{id}/metadata.json):**
```json
{
  "id": "unique-game-id",
  "title": "Game Title",
  "category": "Puzzle" | ["Puzzle", "Action"],
  "description": "Game description",
  "controls": "Control instructions",
  "type": "local" | "iframe",
  // For local games:
  "path": "/games/{id}/index.html",
  // For iframe games:
  "iframe_url": "https://1games.io/...",
  "aspectRatio": "16:9",
  // Optional fields:
  "thumbnail": "./thumbnail.png" | "https://...",
  "image": "./cover.png" | "https://...",
  "tags": ["tag1", "tag2"],
  "author": "Author Name",
  "version": "1.0.0",
  "features": ["Feature 1", "Feature 2"]
}
```

**Schema Validation:**
- Validated by AJV (Another JSON Schema Validator) with draft-07 schema
- Schema location: `scripts/schemas/metadata.schema.json`
- Required fields: `id`, `title`, `category`, `description`, `controls`
- Iframe games must have either `iframe_url` or `embedUrl` pointing to 1games.io
- Local games must have `index.html` in their directory
- Image fields support relative paths (normalized during build) or absolute URLs

### Frontend Architecture

**Core Components (packages/app/src/):**
- `components/GameCard.tsx` - Individual game display cards
- `components/CategoryFilter.tsx` - Category filtering
- `components/SearchBar.tsx` - Game search
- `components/FavoriteButton.tsx` - Favorites functionality (with FavoritesContext)
- `components/PerformanceDashboard.tsx` - Performance monitoring
- `components/Layout.tsx` - Main app layout with navigation
- `pages/HomePage.tsx` - Main game listing page
- `pages/GameDetailPage.tsx` - Individual game page
- `pages/PrivacyPolicy.tsx` - Privacy policy page
- `pages/TermsOfService.tsx` - Terms of service page
- `pages/ContactUs.tsx` - Contact page with EmailJS form
- `pages/NotFoundPage.tsx` - 404 page
- `contexts/FavoritesContext.tsx` - Favorites state management
- `contexts/PerformanceContext.tsx` - Performance monitoring context
- `services/gameService.ts` - Game data fetching from public/games.json
- `services/emailService.ts` - EmailJS integration for feedback

**Key Configuration:**
- `vite.config.ts` - Vite configuration with relative base path (`./`)
  - Uses Vite's default code splitting (manualChunks: undefined) to avoid React ForwardRef errors
  - `@` alias resolves to `packages/app/src/`
  - Assets inline limit: 4KB
  - Build output: `dist/` with hash-based naming
- `tailwind.config.js` - Tailwind CSS with Autoprefixer
- TypeScript configuration in `tsconfig.json`

### Deployment Configuration

**vercel.json:**
- Build command: `npm run build`
- Output: `packages/app/dist`
- SPA routing: All non-game routes redirect to `/index.html`
- Games served at `/games/:path*` with security headers
- CSP headers configured for:
  - Analytics: Google Analytics, Google Tag Manager, Cloudflare Insights
  - Iframes: Only `https://1games.io` domain allowed
  - CDN resources: Cloudflare, Google Fonts, cdnjs
- Headers include: X-Content-Type-Options, X-Frame-Options, CSP
- Trailing slash behavior: disabled

### Build Flow

The build process follows this sequence:
1. **Root `npm run build`** triggers:
2. **`npm run sync-games`** - Syncs games from source to public directory
3. **`npm run build --workspace=packages/app`** - Runs the app build:
   - **prebuild hook**: Runs `build-games-list.js` to generate `public/games.json`
   - **TypeScript compilation**: `tsc` type-checks the code
   - **Vite build**: Bundles the app to `dist/`
4. Result: Production-ready build in `packages/app/dist/`

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server with automatic game sync
npm run dev

# Start with file watcher for games
npm run dev:watch
```

### Build & Deployment
```bash
# Build the app (includes auto-sync and games list generation)
npm run build

# Preview production build locally
npm run preview

# Build output: packages/app/dist
```

### Game Management
```bash
# Validate game metadata and embedding permissions
npm run validate:games

# Sync games from packages/games to packages/app/public/games
npm run sync-games

# Generate games.json from metadata
npm run build:games:list

# Watch games directory for changes (auto-triggers validate + sync)
npm run watch-games

# Optimize game assets (images, thumbnails)
npm run optimize-games
```

### Linting
```bash
# Lint TypeScript/React files (packages/app/)
npm run lint
```

### Testing
Note: No test framework configured. When adding tests, use Vitest for consistency with Vite.

## Development Workflows

### Adding a New Local Game
1. Create `packages/games/{new-game-id}/`
2. Add `index.html` and game assets
3. Create `metadata.json` with required fields
4. Run: `npm run validate:games && npm run sync-games`
5. Games appear at `/games/{new-game-id}/index.html`

### Adding a New Iframe Game
1. Create `packages/games/{new-game-id}/`
2. Create `metadata.json` with:
   - `iframe_url` pointing to `https://1games.io/...`
   - `aspectRatio` recommended (e.g., "16:9")
3. Run: `npm run validate:games && npm run sync-games`
4. Wrapper page automatically generated with lazy loading and fullscreen support

### Making Changes to Existing Games
- Local games: Edit files in `packages/games/{id}/`, then run `npm run sync-games`
- Iframe games: Update `metadata.json` only

### Troubleshooting

**Iframe Games Not Loading:**
- Check browser console for X-Frame-Options or CSP errors
- Run `npm run validate:games` to verify embedding permissions
- Ensure the iframe URL points to `https://1games.io/...`
- Verify the game passes preflight checks in `scripts/lib/can-embed.js`

**Build Failures:**
- TypeScript errors: Check type definitions in `packages/app/src/types/`
- Missing games: Ensure `npm run sync-games` was run before build
- Games list issues: Delete `public/games.json` and run `npm run build:games:list`

**Development Issues:**
- Port 3000 in use: The dev server runs on port 3000 by default
- Hot reload not working: Check that `npm run dev:watch` is running
- Games not appearing: Verify `metadata.json` is valid and game is synced

**CSP Violations:**
- Check `vercel.json` headers if adding external resources
- Ensure all analytics domains are whitelisted
- For new CDNs, update CSP headers in vercel.json

## Project Management

The project uses task tracking in `docs/tasks.md` for managing game integration and development work. Key patterns:
- Track tasks in Markdown with To Do/Doing/Done sections
- Document PRDs at `docs/PRD.md` for larger features
- Use Chinese for documentation in docs/ directory
- Reference existing documentation for game classification and SEO optimization

## CI/CD

**GitHub Actions:**
- `validate-games.yml` - Runs on PR and main branch push
- Validates all games using `node scripts/validate-games.js`
- Failures block merges
- `deploy.yml` - Deployment automation

## Security & Validation

**Iframe Security:**
- Only `https://1games.io/` domain allowed for iframe games
- Pre-flight validation for:
  - X-Frame-Options headers
  - CSP frame-ancestors directives
  - Redirect loops
- See `scripts/lib/can-embed.js` for validation logic

**CSP Headers (vercel.json):**
- Allows self, data, blob, and CDN resources
- Permits 1games.io for iframe embedding
- Restricts other external domains

## Key Files to Know

- `package.json` - Root monorepo configuration
- `packages/app/package.json` - App dependencies and scripts
- `packages/app/src/App.tsx` - Root React component
- `packages/app/src/types/index.ts` - TypeScript type definitions
- `scripts/validate-games.js` - Game validation logic
- `scripts/sync-games.js` - Game synchronization logic
- `packages/app/scripts/build-games-list.js` - Games manifest generator

## Environment Variables

- `.env` - Local development (email service config)
- `.env.example` - Template for environment variables
- EmailJS service used for feedback forms

## Notes

- Uses relative base path (`./`) in Vite config for deployment flexibility
- Games are served from `public/games/` in the built app
- No user authentication - platform is completely open access
- Games list is generated dynamically from metadata scans in `packages/games/`
- All root-level scripts use CommonJS (`require`)
- App-level scripts in `packages/app/scripts/` use ES modules
- Context providers wrap the entire app: FavoritesContext and PerformanceContext
- React Router v6 handles client-side routing
- Vercel Analytics integrated for production monitoring

## Important Gotchas

- **Always run `npm run sync-games`** before building - games are copied during sync, not during build
- **Iframe validation blocks builds** - if `validate-games.js` fails, CI will block the PR
- **Games.json is auto-generated** - never edit manually, always use `npm run build:games:list`
- **Vite code splitting** - do not set custom manualChunks, it causes React ForwardRef errors
- **Path aliases** - use `@/` prefix for imports from `src/` directory
- **Image paths in metadata** - relative paths are normalized during build to `/games/{id}/...`
