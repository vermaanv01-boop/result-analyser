import React from "react";
import { Link } from "react-router-dom";

export type LogoVariant = "full" | "emblem" | "responsive";

interface VentureCraftLogoProps {
  variant?: LogoVariant;
  height?: number | string;
  width?: number | string;
  className?: string;
  to?: string;
  showTagline?: boolean;
}

export const VentureCraftLogo: React.FC<VentureCraftLogoProps> = ({
  variant = "full",
  height,
  width,
  className = "",
  to,
  showTagline = true,
}) => {
  const content = (
    <div
      className={`vc-logo-container vc-logo-${variant} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {variant === "emblem" ? (
        <img
          src="/venture-craft-emblem.png"
          alt="Venture Craft Fox Emblem"
          className="vc-logo-emblem"
          style={{
            height: height || "36px",
            width: width || "auto",
            objectFit: "contain",
            display: "block",
            aspectRatio: "287 / 261",
          }}
          loading="eager"
        />
      ) : variant === "responsive" ? (
        <>
          {/* Mobile emblem icon */}
          <img
            src="/venture-craft-emblem.png"
            alt="Venture Craft Fox Emblem"
            className="vc-logo-mobile-only"
            style={{
              height: height || "34px",
              width: width || "auto",
              objectFit: "contain",
              aspectRatio: "287 / 261",
            }}
            loading="eager"
          />
          {/* Desktop full logo artwork */}
          <img
            src="/venture-craft-logo.png"
            alt="Venture Craft — Think · Adapt · Innovate"
            className="vc-logo-desktop-only"
            style={{
              height: height || "46px",
              width: width || "auto",
              objectFit: "contain",
              aspectRatio: "530 / 522",
            }}
            loading="eager"
          />
        </>
      ) : (
        <img
          src="/venture-craft-logo.png"
          alt="Venture Craft — Think · Adapt · Innovate"
          className="vc-logo-full"
          style={{
            height: height || "56px",
            width: width || "auto",
            maxWidth: "100%",
            objectFit: "contain",
            display: "block",
            aspectRatio: "530 / 522",
          }}
          loading="eager"
        />
      )}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        style={{
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
        }}
      >
        {content}
      </Link>
    );
  }

  return content;
};
