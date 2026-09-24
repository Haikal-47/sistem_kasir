import React from 'react';

interface ArfaLogoProps {
  className?: string;
  size?: number;
}

export const ArfaLogo: React.FC<ArfaLogoProps> = ({ className = 'w-8 h-8', size = 36 }) => {
  return (
    <div
      className={`rounded-full flex items-center justify-center relative overflow-hidden select-none shrink-0 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: 'radial-gradient(circle at center, #fff5f7 0%, #fce7f3 100%)',
        border: '1px solid rgba(244, 114, 182, 0.45)',
        boxShadow: '0 2px 6px rgba(219, 39, 119, 0.12)'
      }}
    >
      {/* Laurel / wreath ornamentation */}
      <svg
        className="absolute w-[86%] h-[86%] pointer-events-none opacity-85"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="41" stroke="#f472b6" strokeWidth="1.2" strokeDasharray="3.5 2.5" />
        <path d="M48 11C50 15 45 18 43 20" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M52 11C50 15 55 18 57 20" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M48 89C50 85 45 82 43 80" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M52 89C50 85 55 82 57 80" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {/* Script text */}
      <div className="flex flex-col items-center justify-center leading-none text-center relative z-10">
        <span
          className="font-serif italic font-bold text-pink-600 tracking-tight"
          style={{ fontSize: `${Math.max(8, Math.round(size * 0.22))}px` }}
        >
          Arfa
        </span>
        <span
          className="font-serif italic font-bold text-pink-600 tracking-tight"
          style={{ fontSize: `${Math.max(7, Math.round(size * 0.18))}px`, marginTop: '-1px' }}
        >
          Fashion
        </span>
      </div>
    </div>
  );
};
