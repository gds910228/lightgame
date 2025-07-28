import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 使用相对路径，适应不同的部署环境
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Serve the games directory as static files
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 确保正确处理静态资源
    assetsInlineLimit: 4096, // 4kb以下的资源内联为base64
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 3000,
    // 允许跨域
    cors: true,
    // 配置静态文件服务，确保游戏文件能正确访问
    fs: {
      // 允许访问项目根目录之外的文件
      strict: false,
    },
  },
})