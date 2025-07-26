// Performance monitoring utilities

export const measurePageLoad = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const loadTime = perfData.loadEventEnd - perfData.fetchStart;
        const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.fetchStart;
        
        console.log('🚀 Performance Metrics:');
        console.log(`📊 Total Load Time: ${loadTime.toFixed(2)}ms`);
        console.log(`📄 DOM Content Loaded: ${domContentLoaded.toFixed(2)}ms`);
        console.log(`🎨 First Paint: ${perfData.responseEnd - perfData.fetchStart}ms`);
        
        // Log to console for debugging
        if (loadTime > 3000) {
          console.warn('⚠️ Page load time is over 3 seconds. Consider further optimizations.');
        } else if (loadTime < 1000) {
          console.log('✅ Excellent page load time!');
        }
      }, 0);
    });
  }
};

export const measureResourceLoad = (resourceName: string, startTime: number) => {
  const endTime = performance.now();
  const loadTime = endTime - startTime;
  console.log(`📦 ${resourceName} loaded in ${loadTime.toFixed(2)}ms`);
  return loadTime;
};