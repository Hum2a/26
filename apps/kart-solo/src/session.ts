import { kartNeutral, type KartControls } from "@26/shared";
import { useGameStore } from "./upstream/store.js";

// This is upstream's ephemeral solo store. No room connection or score submission exists.
export function drive(controls: KartControls) {
  useGameStore.setState({ soloControls: controls });
}
export function pause() {
  useGameStore.setState({ soloPaused: true, soloControls: { ...kartNeutral } });
}
export function resume() {
  useGameStore.setState({ soloPaused: false, soloControls: { ...kartNeutral } });
}
export function reset() {
  useGameStore.setState((state: { soloReset: number }) => ({
    soloReset: state.soloReset + 1,
    speed: 0,
    boostPower: 0,
    isBoosting: false,
    driftLevel: null,
    playerPosition: null,
    soloControls: { ...kartNeutral },
  }));
}
