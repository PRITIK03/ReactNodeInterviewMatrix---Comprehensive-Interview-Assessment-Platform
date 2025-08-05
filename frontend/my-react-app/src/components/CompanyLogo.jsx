import React from "react";

/**
 * CompanyLogo
 * Shows a company logo (PNG) at a visually consistent size, keeping aspect ratio,
 * borderless and background-free. Intended for use in cards, buttons, etc.
 *
 * Props:
 * - company: string (required)
 * - size: number (optical max height in px, default 48)
 * - style: object (extra style overrides)
 * - ...props: any (other img props)
 *
 * Usage: <CompanyLogo company="tcs" size={64} />
 */
export default function CompanyLogo({ company, size = 48, style = {}, ...props }) {
  if (!company) return null;
  // PNG file, lowercased, spaces removed
  const src = `/logos/${company.toLowerCase().replace(/\s+/g, "")}.png`;
  return (
    <img
      src={src}
      alt={company}
      style={{
        display: "block",
        maxHeight: size,         // always control the optical height
        width: "auto",           // natural aspect ratio
        maxWidth: "100%",        // never overflow parent
        margin: "0 auto",        // center in parent
        objectFit: "contain",    // never crop
        background: "none",
        border: "none",
        boxShadow: "none",
        borderRadius: 0,
        ...style,
      }}
      {...props}
      loading="lazy"
    />
  );
}