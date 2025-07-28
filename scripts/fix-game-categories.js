const fs = require('fs');
const path = require('path');

// 正确的游戏分类映射
const correctCategories = {
  'snake': 'Arcade',
  'tetris': 'Puzzle', 
  'space-shooter': 'Action',
  'tower-defense': 'Strategy',
  'baba': ['Casual', 'Geography', 'Collection'], // 保持多分类
  'bdsjm': 'Casual',
  'bljqzffxwz': 'Strategy',
  'baozi': 'Casual',
  'blglez': 'Action',
  'bsqpz2': 'Puzzle', // 从Casual改为Puzzle
  'bsqpz': 'Puzzle',
  'bbjx': 'Puzzle'
};

// 分类标准定义
const categoryDefinitions = {
  'Arcade': 'Classic arcade-style games with simple mechanics and score-based gameplay',
  'Puzzle': 'Games that require logical thinking, problem-solving, and mental challenges',
  'Action': 'Fast-paced games requiring quick reflexes and real-time decision making',
  'Strategy': 'Games requiring planning, resource management, and tactical thinking',
  'Casual': 'Simple, easy-to-play games for relaxation and entertainment',
  'Geography': 'Games involving maps, locations, and geographical knowledge',
  'Collection': 'Games focused on collecting items, achievements, or progress tracking'
};

async function fixGameCategories() {
  console.log('🔧 Starting game category fix...\n');
  
  // 1. 更新 games.json
  const gamesJsonPath = path.join(__dirname, '../packages/app/public/games.json');
  const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
  
  let updatedCount = 0;
  
  gamesData.games.forEach(game => {
    const correctCategory = correctCategories[game.id];
    if (correctCategory && JSON.stringify(game.category) !== JSON.stringify(correctCategory)) {
      console.log(`📝 Updating ${game.title}: ${JSON.stringify(game.category)} → ${JSON.stringify(correctCategory)}`);
      game.category = correctCategory;
      updatedCount++;
    }
  });
  
  // 写入更新后的 games.json
  fs.writeFileSync(gamesJsonPath, JSON.stringify(gamesData, null, 2));
  console.log(`✅ Updated games.json - ${updatedCount} games corrected\n`);
  
  // 2. 更新各个游戏的 metadata.json
  let metadataUpdatedCount = 0;
  
  for (const [gameId, correctCategory] of Object.entries(correctCategories)) {
    const metadataPath = path.join(__dirname, `../packages/games/${gameId}/metadata.json`);
    
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      if (JSON.stringify(metadata.category) !== JSON.stringify(correctCategory)) {
        console.log(`📝 Updating metadata for ${metadata.title}: ${JSON.stringify(metadata.category)} → ${JSON.stringify(correctCategory)}`);
        metadata.category = correctCategory;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        metadataUpdatedCount++;
      }
    }
  }
  
  console.log(`✅ Updated ${metadataUpdatedCount} metadata.json files\n`);
  
  // 3. 创建分类标准文档
  const docsPath = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
  }
  
  const classificationGuide = `# Game Classification Standards

## Classification Criteria

${Object.entries(categoryDefinitions).map(([category, definition]) => 
  `### ${category}\n${definition}\n`
).join('\n')}

## Current Game Classifications

${gamesData.games.map(game => 
  `- **${game.title}** (${game.id}): ${Array.isArray(game.category) ? game.category.join(', ') : game.category}`
).join('\n')}

## Classification Rules

1. **Primary Classification**: Each game should have one primary category based on its core gameplay mechanic
2. **Multiple Categories**: Only use multiple categories when a game genuinely spans multiple genres
3. **Consistency**: Ensure games.json and metadata.json files have identical category values
4. **Validation**: All categories must be from the approved list above

## Validation Checklist

- [ ] Category exists in approved list
- [ ] games.json and metadata.json match
- [ ] Category accurately reflects gameplay
- [ ] Multiple categories are justified
`;

  fs.writeFileSync(path.join(docsPath, 'game-classification-standards.md'), classificationGuide);
  console.log('📚 Created classification standards documentation\n');
  
  console.log('🎉 Game category fix completed successfully!');
  console.log(`📊 Summary: ${updatedCount} games.json entries and ${metadataUpdatedCount} metadata files updated`);
}

// 验证分类一致性的函数
function validateCategories() {
  console.log('🔍 Validating category consistency...\n');
  
  const gamesJsonPath = path.join(__dirname, '../packages/app/public/games.json');
  const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
  
  let inconsistencies = 0;
  
  gamesData.games.forEach(game => {
    const metadataPath = path.join(__dirname, `../packages/games/${game.id}/metadata.json`);
    
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      if (JSON.stringify(game.category) !== JSON.stringify(metadata.category)) {
        console.log(`❌ Inconsistency found in ${game.title}:`);
        console.log(`   games.json: ${JSON.stringify(game.category)}`);
        console.log(`   metadata.json: ${JSON.stringify(metadata.category)}\n`);
        inconsistencies++;
      }
    }
  });
  
  if (inconsistencies === 0) {
    console.log('✅ All categories are consistent!');
  } else {
    console.log(`❌ Found ${inconsistencies} inconsistencies`);
  }
  
  return inconsistencies === 0;
}

// 如果直接运行此脚本
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'validate') {
    validateCategories();
  } else {
    fixGameCategories().catch(console.error);
  }
}

module.exports = { fixGameCategories, validateCategories };