import React from 'react';

interface VapeAvenueLogoProps {
  className?: string;
  size?: number | string;
}

export const VapeAvenueLogo: React.FC<VapeAvenueLogoProps> = ({ 
  className = "w-9 h-9",
  size
}) => {
  const inlineStyle = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={inlineStyle}
    >
      {/* Outer Black Border Ring */}
      <circle cx="250" cy="250" r="236" fill="#0A0F0D" stroke="#0A0F0D" strokeWidth="4" />
      
      {/* Off-White Inner Circular Ring */}
      <circle cx="250" cy="250" r="214" fill="#F8FAF8" stroke="#166534" strokeWidth="6" />

      {/* Top Banner Typography: EST 2022 */}
      <path id="estCurve" d="M 120,230 A 165,165 0 0,1 380,230" fill="none" />
      <text fill="#0F172A" fontSize="38" fontWeight="900" letterSpacing="6" fontFamily="Arial Black, Impact, sans-serif">
        <textPath href="#estCurve" startOffset="50%" textAnchor="middle">
          EST 2022
        </textPath>
      </text>

      {/* Bottom Banner Typography: • DENWARD • */}
      <path id="denwardCurve" d="M 380,270 A 165,165 0 0,1 120,270" fill="none" />
      <text fill="#0F172A" fontSize="36" fontWeight="900" letterSpacing="7" fontFamily="Arial Black, Impact, sans-serif">
        <textPath href="#denwardCurve" startOffset="50%" textAnchor="middle">
          • DENWARD •
        </textPath>
      </text>

      {/* Center Metallic Pole / Hardware Post */}
      {/* Top Pole section */}
      <rect x="226" y="70" width="48" height="78" rx="8" fill="url(#metalGrad)" stroke="#334155" strokeWidth="3" />
      <rect x="232" y="86" width="36" height="12" rx="4" fill="#64748B" />
      <circle cx="250" cy="132" r="6" fill="#475569" stroke="#E2E8F0" strokeWidth="2" />
      
      {/* Bottom Pole section */}
      <rect x="226" y="325" width="48" height="68" rx="8" fill="url(#metalGrad)" stroke="#334155" strokeWidth="3" />
      <rect x="232" y="348" width="36" height="24" rx="4" fill="#334155" />

      {/* Central Forest Green Sign Plate */}
      <g filter="url(#signShadow)">
        <rect
          x="18"
          y="190"
          width="464"
          height="132"
          rx="26"
          fill="#15803D"
          stroke="#0F172A"
          strokeWidth="9"
        />
        {/* Inner Sign White Border Inset */}
        <rect
          x="26"
          y="198"
          width="448"
          height="116"
          rx="18"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="5"
        />
      </g>

      {/* Vapor Cloud Icon Graphic above Sign Text */}
      <path
        d="M250 144 C243 144 238 149 238 155 C233 155 229 159 229 164 C229 170 234 174 240 174 C240 176 242 181 247 183 C251 185 256 183 258 180 C261 183 266 182 268 178 C273 177 276 172 275 167 C279 163 278 156 272 153 C272 148 266 144 260 144 C257 141 253 142 250 144 Z"
        fill="#E2FBE8"
        stroke="#15803D"
        strokeWidth="3"
      />
      <path
        d="M246 156 C243 162 255 166 250 174"
        stroke="#16A34A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Central Sign Screws */}
      <circle cx="250" cy="204" r="5" fill="#E2E8F0" stroke="#334155" strokeWidth="2" />
      <circle cx="250" cy="308" r="5" fill="#E2E8F0" stroke="#334155" strokeWidth="2" />

      {/* Main Street Sign Text: VAPE AVENUE (Bold Graffiti Brush Look) */}
      <text
        x="250"
        y="278"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="54"
        fontWeight="900"
        fontFamily="Impact, Arial Black, Montserrat, sans-serif"
        letterSpacing="2"
        stroke="#0F172A"
        strokeWidth="4"
        paintOrder="stroke fill"
      >
        VAPE AVENUE
      </text>

      {/* Metallic Gradient Definition */}
      <defs>
        <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="30%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="70%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <filter id="signShadow" x="10" y="184" width="480" height="150" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.3" />
        </filter>
      </defs>
    </svg>
  );
};
