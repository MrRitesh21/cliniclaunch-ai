import { useState, useEffect, useCallback } from "react";
import type { TemplatePage, TemplateProps } from "./types";

export function useTemplatePage(props: TemplateProps, defaultPage: TemplatePage = "home") {
  const getInitialPage = (): TemplatePage => {
    if (props.activePage) return props.activePage;

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const queryPage = urlParams.get("page") as TemplatePage | null;
      if (queryPage && ["home", "about", "services", "book", "contact"].includes(queryPage)) {
        return queryPage;
      }

      const path = window.location.pathname.toLowerCase();
      if (path.endsWith("/about") || path.includes("/about/")) return "about";
      if (path.endsWith("/services") || path.includes("/services/")) return "services";
      if (path.endsWith("/book") || path.includes("/book/")) return "book";
      if (path.endsWith("/contact") || path.includes("/contact/")) return "contact";
    }

    return defaultPage;
  };

  const [activePage, setActivePageState] = useState<TemplatePage>(getInitialPage);

  // Sync if prop changes externally (e.g. TanStack route change)
  useEffect(() => {
    if (props.activePage && props.activePage !== activePage) {
      setActivePageState(props.activePage);
    }
  }, [props.activePage]);

  const setActivePage = useCallback(
    (page: TemplatePage) => {
      setActivePageState(page);
      if (props.onNavigatePage) {
        props.onNavigatePage(page);
      }

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Update URL query param without full reload for easy sharing/bookmarking
        try {
          const url = new URL(window.location.href);
          if (page === "home") {
            url.searchParams.delete("page");
          } else {
            url.searchParams.set("page", page);
          }
          window.history.replaceState({}, "", url.toString());
        } catch {
          // Ignore URL sync errors in restricted iframes
        }
      }
    },
    [props],
  );

  return [activePage, setActivePage] as const;
}
