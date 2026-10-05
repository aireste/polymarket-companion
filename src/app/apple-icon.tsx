import { ImageResponse } from "next/og";

// Home-screen icon: the Split mark on ice. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#c9e2f2" }}>
        <svg width="124" height="124" viewBox="0 0 48 48">
          <rect x="7" y="7" width="21" height="9" fill="#121417" />
          <rect x="31.5" y="7" width="9.5" height="9" fill="#121417" opacity="0.5" />
          <rect x="7" y="19.5" width="34" height="9" fill="#121417" />
          <rect x="7" y="32" width="9.5" height="9" fill="#121417" opacity="0.5" />
          <rect x="20" y="32" width="21" height="9" fill="#121417" />
        </svg>
      </div>
    ),
    size
  );
}
