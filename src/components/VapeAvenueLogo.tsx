import React from 'react';

interface VapeAvenueLogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
}

export const VapeAvenueLogo: React.FC<VapeAvenueLogoProps> = ({ 
  className = "w-9 h-9",
  size,
  alt = "Vape Avenue Logo"
}) => {
  const inlineStyle = size ? { width: size, height: size } : undefined;

  return (
    <img
      src="/vape_avenue_logo.png"
      alt={alt}
      className={`object-contain mix-blend-multiply select-none pointer-events-none ${className}`}
      style={inlineStyle}
      referrerPolicy="no-referrer"
    />
  );
};

