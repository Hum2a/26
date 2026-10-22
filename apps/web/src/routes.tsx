import { Navigate, useSearchParams, type RouteObject } from "react-router";
import { AdminConfirmPage } from "./admin/admin-confirm-page";
import { AdminLoginPage } from "./admin/admin-login-page";
import { AdminPage, AdminSettingsPage } from "./admin/admin-page";
import { LiveConsole } from "./admin/live-console";
import { RoomTrollsPage, TrollsPage } from "./admin/trolls-page";
import { WallPage } from "./admin/wall-page";
import { PlayersPage } from "./admin/players-page";
import { MediaPage } from "./admin/media-page";
import { HealthPage } from "./admin/health-page";
import { ContentPage } from "./admin/content-page";
import { AdminKartPage } from "./admin/kart-page";
import { QuestionPage } from "./admin/question-page";
import { QuestionPhonePreview } from "./admin/question-phone-preview";
import { QuestionStagePreview } from "./admin/question-stage-preview";
import { AdminResultsPage } from "./admin/results-page";
import { AdminRoomRoute } from "./admin/room-provider";
import { RoomsPage, RoomOverview } from "./admin/rooms-page";
import { GuestPage } from "./guest/guest-page";
import { HomePage } from "./home/home-page";
import { NotFoundPage } from "./not-found-page";
import { ResultsPage } from "./results/results-page";
import { StagePage } from "./stage/stage-page";

function HomeEntry() {
  const [params] = useSearchParams();
  return params.has("room") ? (
    <Navigate replace to={`/join?${params.toString()}`} />
  ) : (
    <HomePage />
  );
}

export const appRoutes: RouteObject[] = [
  { path: "/", element: <HomeEntry /> },
  { path: "/join", element: <GuestPage /> },
  { path: "/play", element: <GuestPage /> },
  {
    path: "/kart",
    lazy: async () => ({ Component: (await import("./kart/solo-page")).SoloKartPage }),
  },
  { path: "/j/:code", element: <GuestPage /> },
  { path: "/host", element: <StagePage /> },
  { path: "/screen", element: <StagePage /> },
  {
    path: "/admin/phone-preview/:version/:questionId",
    element: <QuestionPhonePreview />,
  },
  {
    path: "/admin/stage-preview/:version/:questionId",
    element: <QuestionStagePreview />,
  },
  {
    path: "/admin",
    element: <AdminPage />,
    children: [
      { index: true, element: <RoomsPage overview /> },
      { path: "rooms", element: <RoomsPage /> },
      { path: "settings", element: <AdminSettingsPage /> },
      { path: "content", element: <ContentPage /> },
      { path: "kart", element: <AdminKartPage /> },
      { path: "trolls", element: <TrollsPage /> },
      { path: "content/:version/:questionId", element: <QuestionPage /> },
      {
        path: "rooms/:gameId",
        element: <AdminRoomRoute />,
        children: [
          { index: true, element: <RoomOverview /> },
          { path: "live", element: <LiveConsole /> },
          { path: "players", element: <PlayersPage /> },
          { path: "media", element: <MediaPage /> },
          { path: "results", element: <AdminResultsPage /> },
          { path: "health", element: <HealthPage /> },
          { path: "trolls", element: <RoomTrollsPage /> },
          { path: "wall", element: <WallPage /> },
        ],
      },
    ],
  },
  { path: "/admin/login", element: <AdminLoginPage /> },
  { path: "/admin/confirm", element: <AdminConfirmPage /> },
  { path: "/r/:gameId", element: <ResultsPage /> },
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
];
