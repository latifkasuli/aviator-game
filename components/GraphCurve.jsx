import React, { useState, useEffect } from 'react';

const GraphCurve = ({ multiplier, gameState, startTime, finalCrashMultiplier }) => {
  const [pathData, setPathData] = useState('');
  const [fillPath, setFillPath] = useState('');

  useEffect(() => {
    const calculateCurve = () => {
      const maxVisualMultiplier = 50;
      
      const startX = 0;
      const startY = 100;
      
      let path = `M ${startX} ${startY}`;
      
      if (multiplier > 1) {
        const points = [];
        const steps = Math.min(Math.floor((multiplier - 1) * 30), 150);
        
        for (let i = 0; i <= steps; i++) {
          const stepMultiplier = 1 + (i / 30);
          
          if (stepMultiplier <= multiplier) {
            const progress = (stepMultiplier - 1) / (maxVisualMultiplier - 1);
            const exponentialProgress = Math.pow(progress, 0.7);
            
            const x = exponentialProgress * 100;
            const y = 100 - (Math.log(stepMultiplier) / Math.log(maxVisualMultiplier)) * 85;
            
            points.push({ x, y });
          }
        }
        
        if (points.length > 0) {
          path += ` L ${points[0].x} ${points[0].y}`;
          
          for (let i = 1; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const controlX = (current.x + next.x) / 2;
            const controlY = (current.y + next.y) / 2;
            
            path += ` Q ${current.x} ${current.y} ${controlX} ${controlY}`;
          }
          
          if (points.length > 1) {
            const lastPoint = points[points.length - 1];
            path += ` L ${lastPoint.x} ${lastPoint.y}`;
          }
        }
      }
      
      setPathData(path);
      
      if (multiplier > 1 && path !== `M ${startX} ${startY}`) {
        const fillArea = path + ` L ${100 * Math.pow((multiplier - 1) / (maxVisualMultiplier - 1), 0.7)} ${startY} L ${startX} ${startY} Z`;
        setFillPath(fillArea);
      }
    };

    calculateCurve();
  }, [multiplier, finalCrashMultiplier]);

  const getStrokeProps = () => {
    if (gameState === 'crashed') {
      return {
        stroke: '#dc2626',
        strokeWidth: 4,
        opacity: 1,
        filter: 'url(#glowEffect)'
      };
    }
    return {
      stroke: '#dc2626',
      strokeWidth: 3,
      opacity: 0.95,
      filter: 'url(#glowEffect)'
    };
  };

  return (
    <g>
      {
}
      {fillPath && (
        <path
          d={fillPath}
          fill="url(#curveGradient)"
          opacity={gameState === 'crashed' ? 0.6 : 0.5}
        />
      )}
      
      {
}
      {pathData && (
        <path
          d={pathData}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-50"
          {...getStrokeProps()}
        />
      )}
    </g>
  );
};

export default GraphCurve;
