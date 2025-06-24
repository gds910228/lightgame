/**
 * SVG to JPG Converter
 * 
 * 此脚本用于将SVG文件转换为JPG格式
 * 使用方法: node svg-to-jpg.js <input-svg-file> <output-jpg-file>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查命令行参数
if (process.argv.length < 4) {
  console.log('Usage: node svg-to-jpg.js <input-svg-file> <output-jpg-file>');
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];

// 确保输入文件存在
if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file "${inputFile}" does not exist.`);
  process.exit(1);
}

// 读取SVG文件
const svgContent = fs.readFileSync(inputFile, 'utf8');

// 使用data URL加载SVG
const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;

// 加载SVG图像并转换为JPG
async function convertSvgToJpg() {
  try {
    // 加载SVG图像
    const image = await loadImage(svgDataUrl);
    
    // 创建Canvas
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // 设置白色背景（因为JPG不支持透明度）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制SVG图像
    ctx.drawImage(image, 0, 0);
    
    // 将Canvas转换为JPG并保存
    const jpgBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    fs.writeFileSync(outputFile, jpgBuffer);
    
    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
  } catch (error) {
    console.error('Error converting SVG to JPG:', error);
    process.exit(1);
  }
}

convertSvgToJpg(); 