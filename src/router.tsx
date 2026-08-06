import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cache-first defaults. Previously every mount/refocus refetched (staleTime 0),
  // which multiplied PostgREST traffic by every navigation and tab switch.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Reuse loader data for preloads instead of re-hitting the database.
    defaultPreloadStaleTime: 60_000,

  });

  return router;
};
