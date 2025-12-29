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

    // 优化chunk分割策略
    rollupOptions: {
      output: {
        // 更细粒度的代码分割
        manualChunks: (id) => {
          // React核心库
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          // 路由库
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor'
          }
          // SEO相关
          if (id.includes('node_modules/react-helmet')) {
            return 'seo-vendor'
          }
          // UI组件库（如果有）
          if (id.includes('node_modules/@heroicons') || id.includes('node_modules/lucide')) {
            return 'ui-vendor'
          }
          // 分析工具
          if (id.includes('node_modules/@vercel/analytics')) {
            return 'analytics-vendor'
          }
          // 其他node_modules
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
        // 为生成的chunk文件命名
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // 启用源码映射（生产环境建议关闭）
    sourcemap: false,
    // 使用esbuild进行最小化（Vite默认，更快）
    minify: 'esbuild',
    // chunk大小警告限制（KB）
    chunkSizeWarningLimit: 500,
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
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
  },
})