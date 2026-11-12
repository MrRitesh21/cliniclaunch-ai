import { useState, useEffect } from "react";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette } from "./types";
import { resolveTemplatePalette } from "./clinicDataHelpers";

/**
 * React hook that binds a template's palette to live customization changes.
 * Automatically syncs with local storage, URL params, clinic theme_color,
 * and responds instantly to 'clinic-customization-changed' events.
 */
export function useTemplatePalette(
  basePalette: TemplatePalette,
  clinic?: SiteClinic | any
): TemplatePalette {
  const [palette, setPalette] = useState<TemplatePalette>(() =>
    resolveTemplatePalette(basePalette, clinic)
  );

  useEffect(() => {
    // 1. Initial resolution on mount
    const resolved = resolveTemplatePalette(basePalette, clinic);
    setPalette(resolved);

    // Sync CSS variables on documentElement for instant Tailwind & Shadcn variable propagation
    if (typeof document !== "undefined" && resolved?.primary) {
      document.documentElement.style.setProperty("--primary", resolved.primary);
      document.documentElement.style.setProperty("--ring", resolved.primary);
      if (resolved.accent) {
        document.documentElement.style.setProperty("--accent-theme", resolved.accent);
      }
    }

    // 2. Event listener for real-time live preview from TemplateCustomizer
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ color?: string }>;
      const newColor = customEvent.detail?.color;
      if (newColor) {
        const updated = resolveTemplatePalette(basePalette, clinic, newColor);
        setPalette(updated);
        if (typeof document !== "undefined") {
          document.documentElement.style.setProperty("--primary", newColor);
          document.documentElement.style.setProperty("--ring", newColor);
          document.documentElement.style.setProperty("--accent-theme", newColor);
        }
      }
    };

    window.addEventListener("clinic-customization-changed", handleCustomChange);
    return () => {
      window.removeEventListener("clinic-customization-changed", handleCustomChange);
    };
  }, [basePalette.primary, clinic?.slug, clinic?.theme_color]);

  return palette;
}
