import React from 'react';

interface PongfinityLogoProps {
  className?: string;
}

export const PongfinityLogo: React.FC<PongfinityLogoProps> = ({ className = "w-8 h-8" }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <rect x="4" y="8" width="2" height="8" rx="1" fill="currentColor" />
      <rect x="18" y="8" width="2" height="8" rx="1" fill="currentColor" />
    </svg>
  );
};
