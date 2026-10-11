import { createBrowserRouter } from "react-router";
import { AdminConfirmPage } from "./admin/admin-confirm-page";
import { AdminPage } from "./admin/admin-page";
import { GuestPage } from "./guest/guest-page";
import { NotFoundPage } from "./not-found-page";
import { ResultsPage } from "./results/results-page";
import { StagePage } from "./stage/stage-page";

export const router = createBrowserRouter([
  { path: "/", element: <GuestPage /> },
  { path: "/j/:code", element: <GuestPage /> },
  { path: "/host", element: <StagePage /> },
  { path: "/admin", element: <AdminPage /> },
  { path: "/admin/confirm", element: <AdminConfirmPage /> },
  { path: "/r/:gameId", element: <ResultsPage /> },
  // Development-only design bench for the custom question designs.
  ...(import.meta.env.DEV
    ? [
        {
          path: "/design",
          lazy: async () => ({
            Component: (await import("./play/designs/preview/design-preview"))
              .DesignPreview,
          }),
        },
      ]
    : []),
  { path: "*", element: <NotFoundPage /> },
]);
