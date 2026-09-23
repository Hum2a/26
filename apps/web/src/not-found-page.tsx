import { useEffect } from "react";
import { SurfaceFrame } from "./ui/surface-frame";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Not found · 26";
  }, []);

  return (
    <SurfaceFrame
      title="Not found"
      lede="This address is not one of the party screens."
    >
      <p className="text-lg">Use Guest, Stage, Admin, or Results.</p>
    </SurfaceFrame>
  );
}
