import { toast } from "sonner";

export const activityToasterId = "admin-activity";
export function previewActivityToast() {
  toast.success("12 players have locked in", {
    toasterId: activityToasterId,
    id: "activity-preview",
    description: "Sample notification · no live room was changed.",
  });
}
