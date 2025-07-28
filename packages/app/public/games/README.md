# 🎮 Games Source Directory

## ⚠️ IMPORTANT DEVELOPMENT RULES

### 📝 Always Remember:
1. **ONLY modify game source code in this directory (`packages/games/`)**
2. **NEVER directly edit files in `packages/app/public/games/`**
3. **After making changes, run `npm run sync-games` to sync to public directory**

### 🔄 Development Workflow:

#### Option 1: Auto-sync Development (Recommended)
```bash
# Start development with auto-sync
npm run dev:watch

# Now edit files in packages/games/ - they sync automatically!
# No manual sync needed!
```

#### Option 2: Manual Development
```bash
# 1. Edit game files in packages/games/
# 2. Start development (auto-syncs once)
npm run dev

# 3. If you make more changes, run:
npm run sync-games

# 4. Commit your changes
git add .
git commit -m "your changes"
```

### 📁 Directory Structure:
- `packages/games/` - **SOURCE CODE** (edit here)
- `packages/app/public/games/` - **BUILD OUTPUT** (don't edit directly)

### 🎯 Adding New Games:
1. Create new game directory in `packages/games/`
2. Add `metadata.json` file
3. Run `npm run sync-games`
4. Run `npm run prebuild` (in packages/app)
5. Test the game

---
**Remember: Source in `packages/games/`, sync with `npm run sync-games`!**