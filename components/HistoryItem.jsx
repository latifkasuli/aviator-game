import React from 'react';

const HistoryItem = ({ multiplier }) => {
  const getColorClasses = () => {
    if (multiplier >= 100) {
      return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-yellow-500/50';
    }
    if (multiplier >= 10) {
      return 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-pink-500/50';
    }
    if (multiplier >= 5) {
      return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/50';
    }
    if (multiplier >= 2) {
      return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/50';
    }
    return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-500/50';
  };

  const getGlowIntensity = () => {
    if (multiplier >= 100) return 'shadow-lg';
    if (multiplier >= 10) return 'shadow-md';
    if (multiplier >= 5) return 'shadow-sm';
    return '';
  };

  const formatMultiplier = (value) => {
    return `${value.toFixed(2)}x`;
  };

  return (
    <div 
      className={`
        px-2 py-1 rounded-full text-xs whitespace-nowrap
        ${getColorClasses()}
        ${getGlowIntensity()}
        transition-all duration-300 hover:scale-105
        min-w-[45px] max-w-[65px] text-center flex-shrink-0
        border border-white/20
      `}
    >
      {formatMultiplier(multiplier)}
    </div>
  );
};

export default HistoryItem;
