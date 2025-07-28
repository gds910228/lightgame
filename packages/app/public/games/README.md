# 🎮 Games Source Directory

## ⚠️ IMPORTANT DEVELOPMENT RULES (For AI Assistant)

### 🤖 AI Assistant Must Always Remember:
1. **ONLY modify game source code in this directory (`packages/games/`)**
2. **NEVER directly edit files in `packages/app/public/games/`**
3. **ALWAYS run `npm run sync-games` immediately after modifying any game files**
4. **Double-check that changes are synced to public directory before testing**

### 🤖 AI Development Workflow (MANDATORY):
```bash
# 1. Modify game files in packages/games/ ONLY
# 2. IMMEDIATELY run sync command:
npm run sync-games

# 3. Verify files are copied to packages/app/public/games/
# 4. Then test the changes
# 5. Commit all changes including both directories
```

### 🔄 User Development Workflow:

#### Option 1: Auto-sync Development (Recommended)
```bash
# Start development with auto-sync
npm run dev:watch
# Files sync automatically when changed!
```

#### Option 2: Manual Development
```bash
# Start development (auto-syncs once)
npm run dev
# If making more changes, run: npm run sync-games
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
**🚨 AI REMINDER: Always sync after editing! Source in `packages/games/`, sync with `npm run sync-games`!**
