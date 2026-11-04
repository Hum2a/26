import { useEffect } from "react";
import { driverStyles } from "@26/shared";
import { readPracticePresentation } from "../../web/src/kart/practice-presentation";
import { useGameStore } from "./upstream/store.js";

export function PracticePresentation() {
  const style = useGameStore((state) => state.soloDriverStyle);
  useEffect(() => {
    let faceUrl: string | undefined;
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== location.origin) return;
      const next = readPracticePresentation(event.data);
      if (!next) return;
      if ("face" in next) {
        if (faceUrl) URL.revokeObjectURL(faceUrl);
        faceUrl = next.face ? URL.createObjectURL(next.face) : undefined;
      }
      useGameStore.setState({
        soloDriverStyle: next.style,
        soloDriverFace: faceUrl ?? null,
        soloVfxPreset: next.effects ?? null,
        soloLookPreset: next.look ?? null,
      });
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ kind: "kart-practice-ready" }, location.origin);
    return () => {
      window.removeEventListener("message", receive);
      if (faceUrl) URL.revokeObjectURL(faceUrl);
      useGameStore.setState({
        soloDriverFace: null,
        soloVfxPreset: null,
        soloLookPreset: null,
      });
    };
  }, []);
  return (
    <label>
      Practice driver{" "}
      <select
        aria-label="Practice driver"
        value={style}
        onChange={(event) => {
          const chosen = driverStyles.find(
            (driver) => driver.id === event.target.value,
          );
          if (chosen) useGameStore.setState({ soloDriverStyle: chosen.id });
        }}
      >
        {driverStyles.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.name}
          </option>
        ))}
      </select>
    </label>
  );
}
