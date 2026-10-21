import React from "react";

export interface KARVAANLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  showText?: boolean;
  showTagline?: boolean;
  variant?: "dark" | "light"; // "dark" for ivory backgrounds (navy/gold text), "light" for navy backgrounds (gold/ivory text)
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<string, number> = {
  xs: 28,
  sm: 40,
  md: 56,
  lg: 80,
  xl: 120,
};

export const KARVAANLogo: React.FC<KARVAANLogoProps> = ({
  size = "md",
  showText = true,
  showTagline = false,
  variant = "dark",
  className = "",
  onClick,
}) => {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] ?? 56;
  const isLight = variant === "light";

  return (
    <div
      className={`karvaan-logo-container ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: pixelSize > 50 ? "14px" : "10px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <img
        src="/assets/karvaan-logo.png"
        alt="KARVAAN Peacock Emblem"
        style={{
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />
      {showText && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: pixelSize >= 80 ? "28px" : pixelSize >= 50 ? "20px" : "16px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: isLight ? "#FFFFFF" : "var(--color-navy)",
              lineHeight: 1.1,
            }}
          >
            KARVAAN
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: pixelSize >= 80 ? "13px" : "11px",
                letterSpacing: "0.15em",
                color: isLight ? "var(--color-gold-muted)" : "var(--color-gold)",
                marginTop: "4px",
                textTransform: "uppercase",
              }}
            >
              Present &bull; Connect &bull; Lead
            </span>
          )}
        </div>
      )}
    </div>
  );
};
