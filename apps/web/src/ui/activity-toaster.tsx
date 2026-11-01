import { Toaster } from "sonner";
import { activityToasterId } from "./activity-notices";

/** Private operator feedback. Never mounted on phones or the projector. */
export function ActivityToaster() {
  return (
    <Toaster
      id={activityToasterId}
      position="bottom-right"
      closeButton
      visibleToasts={3}
      offset={24}
      mobileOffset={16}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast: "activity-toast",
          description: "activity-toast-description",
          closeButton: "activity-toast-close",
        },
        style: {
          background: "var(--surface)",
          color: "var(--surface-foreground)",
          borderColor: "var(--line)",
          borderRadius: "var(--radius-panel)",
        },
      }}
    />
  );
}
