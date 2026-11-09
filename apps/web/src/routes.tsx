import { Navigate, useSearchParams, type RouteObject } from "react-router";
import { HomePage } from "./home/home-page";
import { NotFoundPage } from "./not-found-page";
import { RouteError } from "./ui/route-error";

function HomeEntry() {
  const [params] = useSearchParams();
  return params.has("room") ? (
    <Navigate replace to={`/join?${params.toString()}`} />
  ) : (
    <HomePage />
  );
}

const routes: RouteObject[] = [
  { path: "/", element: <HomeEntry /> },
  {
    path: "/join",
    lazy: async () => ({ Component: (await import("./guest/guest-page")).GuestPage }),
  },
  {
    path: "/play",
    lazy: async () => ({ Component: (await import("./guest/guest-page")).GuestPage }),
  },
  {
    path: "/kart",
    lazy: async () => ({ Component: (await import("./kart/solo-page")).SoloKartPage }),
  },
  {
    path: "/chess",
    lazy: async () => ({
      Component: (await import("./chess/solo-page")).SoloChessPage,
    }),
  },
  {
    path: "/j/:code",
    lazy: async () => ({ Component: (await import("./guest/guest-page")).GuestPage }),
  },
  {
    path: "/host",
    lazy: async () => ({ Component: (await import("./stage/stage-page")).StagePage }),
  },
  {
    path: "/screen",
    lazy: async () => ({ Component: (await import("./stage/stage-page")).StagePage }),
  },
  {
    path: "/admin/phone-preview/:version/:questionId",
    lazy: async () => ({
      Component: (await import("./admin/question-phone-preview")).QuestionPhonePreview,
    }),
  },
  {
    path: "/admin/phone-preview/room/:gameId",
    lazy: async () => ({
      Component: (await import("./developer/rehearsal-phone")).RehearsalPhone,
    }),
  },
  {
    path: "/admin/stage-preview/:version/:questionId",
    lazy: async () => ({
      Component: (await import("./admin/question-stage-preview")).QuestionStagePreview,
    }),
  },
  {
    path: "/admin",
    lazy: async () => ({ Component: (await import("./admin/admin-page")).AdminPage }),
    children: [
      {
        index: true,
        lazy: async () => {
          const { RoomsPage } = await import("./admin/rooms-page");
          return { Component: () => <RoomsPage overview /> };
        },
      },
      {
        path: "rooms",
        lazy: async () => ({
          Component: (await import("./admin/rooms-page")).RoomsPage,
        }),
      },
      {
        path: "settings",
        lazy: async () => ({
          Component: (await import("./admin/admin-page")).AdminSettingsPage,
        }),
      },
      {
        path: "content",
        lazy: async () => ({
          Component: (await import("./admin/content-page")).ContentPage,
        }),
      },
      {
        path: "kart",
        lazy: async () => ({
          Component: (await import("./admin/kart-page")).AdminKartPage,
        }),
      },
      {
        path: "trolls",
        lazy: async () => ({
          Component: (await import("./admin/trolls-page")).TrollsPage,
        }),
      },
      {
        path: "content/:version/:questionId",
        lazy: async () => ({
          Component: (await import("./admin/question-page")).QuestionPage,
        }),
      },
      {
        path: "rooms/:gameId",
        lazy: async () => ({
          Component: (await import("./admin/room-provider")).AdminRoomRoute,
        }),
        children: [
          {
            path: "developer",
            lazy: async () => ({
              Component: (await import("./developer/developer-page")).DeveloperPage,
            }),
          },
          {
            index: true,
            lazy: async () => ({
              Component: (await import("./admin/rooms-page")).RoomOverview,
            }),
          },
          {
            path: "live",
            lazy: async () => ({
              Component: (await import("./admin/live-console")).LiveConsole,
            }),
          },
          {
            path: "players",
            lazy: async () => ({
              Component: (await import("./admin/players-page")).PlayersPage,
            }),
          },
          {
            path: "media",
            lazy: async () => ({
              Component: (await import("./admin/media-page")).MediaPage,
            }),
          },
          {
            path: "results",
            lazy: async () => ({
              Component: (await import("./admin/results-page")).AdminResultsPage,
            }),
          },
          {
            path: "health",
            lazy: async () => ({
              Component: (await import("./admin/health-page")).HealthPage,
            }),
          },
          {
            path: "trolls",
            lazy: async () => ({
              Component: (await import("./admin/trolls-page")).RoomTrollsPage,
            }),
          },
          {
            path: "wall",
            lazy: async () => ({
              Component: (await import("./admin/wall-page")).WallPage,
            }),
          },
          {
            path: "analytics",
            lazy: async () => ({
              Component: (await import("./admin/analytics-page")).AnalyticsPage,
            }),
          },
        ],
      },
    ],
  },
  {
    path: "/admin/login",
    lazy: async () => ({
      Component: (await import("./admin/admin-login-page")).AdminLoginPage,
    }),
  },
  {
    path: "/admin/confirm",
    lazy: async () => ({
      Component: (await import("./admin/admin-confirm-page")).AdminConfirmPage,
    }),
  },
  {
    path: "/r/:gameId",
    lazy: async () => ({
      Component: (await import("./results/results-page")).ResultsPage,
    }),
  },
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

// Initial lazy routes wait on the existing document before their real frame loads.
// A failed load (such as a tab left open across a deployment) gets a friendly
// recovery screen rather than the router's developer error page.
export const appRoutes: RouteObject[] = routes.map((route) => ({
  HydrateFallback: () => null,
  ErrorBoundary: RouteError,
  ...route,
}));
