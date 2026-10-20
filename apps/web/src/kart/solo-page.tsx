import { useEffect } from "react";
import "./solo-page.css";

export function SoloKartPage() {
  useEffect(() => {
    document.title = "26 · Solo kart practice";
  }, []);
  return (
    <main className="solo-kart-page">
      <iframe
        title="Solo kart practice"
        src="/kart-engine/index.html"
        allow="fullscreen"
      />
    </main>
  );
}
