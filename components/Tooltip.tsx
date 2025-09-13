import React, { useState, useRef, ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  title: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, title }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setVisible(true);
    }, 300); // Small delay to prevent flickering
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {visible && (
        <div
          className="absolute z-10 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded-md shadow-sm bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap"
          role="tooltip"
        >
          {title}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
