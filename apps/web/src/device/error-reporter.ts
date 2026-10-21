import { noteScriptError } from "./connection-log";

/**
 * Counts uncaught errors and rejected promises so the host can see a phone in
 * trouble on Room health. Only a short message travels, with the build id;
 * no stack, page content or answer.
 */
export function installErrorReporter(target: Window = window): () => void {
  const build = import.meta.env.VITE_BUILD_ID ?? "dev";
  function onError(event: ErrorEvent) {
    noteScriptError(`${build}: ${event.message || "Script error"}`);
  }
  function onRejection(event: PromiseRejectionEvent) {
    const reason: unknown = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "";
    noteScriptError(`${build}: ${message || "Unhandled rejection"}`);
  }
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
