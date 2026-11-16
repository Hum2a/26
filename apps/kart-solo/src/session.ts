import {
  createKartPowers,
  createKartTrial,
  kartHandlingSchema,
  kartNeutral,
  type KartControls,
} from "@26/shared";
import { useGameStore } from "./upstream/store.js";

// This is upstream's ephemeral solo store. No room connection or score submission exists.
export function drive(controls: KartControls) {
  useGameStore.setState({ soloControls: controls });
}
export function pause() {
  useGameStore.setState({ soloPaused: true, soloControls: { ...kartNeutral } });
}
export function resume() {
  if (useGameStore.getState().soloTrial?.finished) return;
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
  const current = useGameStore.getState();
  const trial =
    current.soloMode === "free"
      ? null
      : createKartTrial({
          version: 1,
          track: "mario-circuit-v1",
          physics: "arcade-v2",
          handling: kartHandlingSchema.parse(current.soloHandling),
          laps: current.soloMode === "trial-3" ? 3 : 1,
          assists: "none",
          items: current.soloItemsEnabled,
          course: current.soloCourseSettings,
        });
  useGameStore.setState((state: { soloReset: number }) => ({
    soloReset: state.soloReset + 1,
    soloPowers: createKartPowers(),
    soloOils: [],
    soloElapsed: 0,
    soloTrial: trial,
    soloHeight: 0,
    soloVerticalSpeed: 0,
    soloChargeMs: 0,
    soloBoostLevel: 0,
    soloTrackNotice: "",
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
    soloStunMs: 0,
  }));
}
