import { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onLoad?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  fallbackClassName = '',
  onLoad,
  onError 
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(e);
  };

  return (
    <div ref={imgRef} className="relative w-full h-full">
      {/* Fallback/Loading state */}
      {(!isLoaded || hasError) && (
        <div className={`absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center ${fallbackClassName}`}>
          {hasError ? (
            <i className="fas fa-image text-primary-400 text-2xl"></i>
          ) : (
            <i className="fas fa-gamepad text-primary-600 text-4xl animate-pulse-slow"></i>
          )}
        </div>
      )}
      
      {/* Actual image */}
      {isVisible && !hasError && (
        <img
          src={src}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default LazyImage;