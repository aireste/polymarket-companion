import { ImageResponse } from "next/og";

// Home-screen icon: the header's ice spark mark. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#c9e2f2" }}>
        <svg width="112" height="112" viewBox="0 0 24 24">
          <path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4L12 3z" fill="#121417" />
        </svg>
      </div>
    ),
    size
  );
}
