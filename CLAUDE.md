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
  - `build-games-list.js` - Generate games.json from metadata
  - `lib/can-embed.js` - Embedding validation library

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
  "path": "/games/{id}/index.html",
  "type": "local" | "iframe",
  // For iframe games:
  "iframe_url": "https://1games.io/...",
  "aspectRatio": "16:9"  // optional
}
```

### Frontend Architecture

**Core Components (packages/app/src/):**
- `components/GameCard.tsx` - Individual game display cards
- `components/CategoryFilter.tsx` - Category filtering
- `components/SearchBar.tsx` - Game search
- `components/FavoriteButton.tsx` - Favorites functionality (with FavoritesContext)
- `components/PerformanceDashboard.tsx` - Performance monitoring
- `pages/HomePage.tsx` - Main game listing page
- `pages/GameDetailPage.tsx` - Individual game page
- `services/gameService.ts` - Game data fetching
- `services/emailService.ts` - EmailJS integration for feedback

**Key Configuration:**
- `vite.config.ts` - Vite configuration with relative base path, vendor chunk splitting
- `tailwind.config.js` - Tailwind CSS configuration
- Uses `@` alias for `packages/app/src/`

### Deployment Configuration

**vercel.json:**
- Build command: `npm run build`
- Output: `packages/app/dist`
- SPA routing: All routes redirect to `/index.html`
- Games served at `/games/:path*` with CSP headers allowing 1games.io iframe embedding

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

# Watch games directory for changes
npm run watch-games
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

## Cursor Rules (Project-Specific)

The project includes Cursor IDE rules in `.cursor/rules/`:

**dev.mdc:** Project Manager role for task breakdown
- Requires all tasks to be tracked in Markdown task lists (To Do/Doing/Done)
- Save task progress to `docs/tasks.md`
- Use todo-style checklists for tracking

**pm.mdc:** Full-stack Engineer role
- Focus on PRD analysis and task decomposition
- Generate PRDs at `docs/PRD.md`
- Follow specific output formatting for task lists

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
- Games list is generated dynamically from metadata scans
- All scripts use CommonJS (`require`) except package/app build scripts (ES modules)
