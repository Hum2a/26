import { createKartPowers, kartNeutral, type KartControls } from "@26/shared";
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
export function recover() {
  useGameStore.setState((state: { soloRecover: number }) => ({
    soloRecover: state.soloRecover + 1,
    soloControls: { ...kartNeutral },
    soloRecoveryMessage: "Returning to the track…",
  }));
}
export function useItem() {
  useGameStore.setState((state: { soloItemUse: number }) => ({
    soloItemUse: state.soloItemUse + 1,
  }));
}
export function reset() {
  useGameStore.setState((state: { soloReset: number }) => ({
    soloReset: state.soloReset + 1,
    soloPowers: createKartPowers(),
    soloOils: [],
    soloElapsed: 0,
    soloPowerMessage: "",
    speed: 0,
    boostPower: 0,
    isBoosting: false,
    driftLevel: null,
    playerPosition: null,
    soloControls: { ...kartNeutral },
    soloRecovered: useGameStore.getState().soloRecover,
    soloRecoveryReady: true,
    soloRecoveryMessage: "",
    soloSurface: "road",
    soloContact: false,
  }));
}
