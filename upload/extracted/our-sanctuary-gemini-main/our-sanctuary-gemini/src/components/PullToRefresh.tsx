import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    if (window.scrollY === 0) {
      currentY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    if (window.scrollY > 0) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 50 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
    startY.current = 0;
    currentY.current = 0;
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div 
      className="relative min-h-screen w-full max-w-full overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden"
        style={{ height: pullDistance }}
      >
        {isRefreshing ? (
          <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        ) : (
          <div 
            className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center"
            style={{ opacity: Math.min(pullDistance / 50, 1) }}
          >
            <div 
              className="w-3 h-3 rounded-full bg-[var(--color-primary)]"
              style={{ transform: `scale(${Math.min(pullDistance / 80, 1)})` }}
            />
          </div>
        )}
      </motion.div>
      <div style={{ paddingTop: pullDistance }}>
        {children}
      </div>
    </div>
  );
}