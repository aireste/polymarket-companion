"use client";
import { useEffect } from "react";

export function RedirectToBoard({ id }: { id: string }) {
  const href = `/?m=${encodeURIComponent(id)}`;
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return (
    <p className="hp-empty">
      Opening HedgePredict… <a href={href}>Tap here if nothing happens.</a>
    </p>
  );
}
