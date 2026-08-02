import React from 'react';

interface AchievementIconProps {
  icon: string;
  unlocked: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
};

export const AchievementIcon: React.FC<AchievementIconProps> = ({ icon, unlocked, size = 'md' }) => {
  return (
    <span
      className={`${sizeMap[size]} inline-block transition-all duration-300 ${
        unlocked ? 'grayscale-0 opacity-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'grayscale opacity-30'
      }`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
};

export default AchievementIcon;
