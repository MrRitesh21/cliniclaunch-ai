import { createFileRoute } from "@tanstack/react-router";
import { COMPETITORS, CITIES, SPECIALTIES, SITE_URL } from "@/lib/marketing-data";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = SITE_URL;

        const entries: { path: string; changefreq: string; priority: string }[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/features", changefreq: "monthly", priority: "0.8" },
          { path: "/how-it-works", changefreq: "monthly", priority: "0.7" },
          { path: "/demo", changefreq: "monthly", priority: "0.7" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/login", changefreq: "monthly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/refund-policy", changefreq: "yearly", priority: "0.3" },
          { path: "/shipping-policy", changefreq: "yearly", priority: "0.3" },
        ];

        // Programmatic SEO: competitor comparisons, cities, specialties.
        for (const c of COMPETITORS) {
          entries.push({ path: `/compare/${c.slug}`, changefreq: "monthly", priority: "0.8" });
        }
        for (const city of CITIES) {
          entries.push({
            path: `/clinic-software/${city.slug}`,
            changefreq: "monthly",
            priority: "0.8",
          });
        }
        for (const s of SPECIALTIES) {
          entries.push({ path: `/for/${s.slug}`, changefreq: "monthly", priority: "0.7" });
        }

        // Public clinic sites.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: clinics } = await supabaseAdmin.from("clinics").select("slug");
          if (clinics) {
            for (const c of clinics) {
              if (c.slug) {
                entries.push({ path: `/c/${c.slug}`, changefreq: "weekly", priority: "0.8" });
                entries.push({ path: `/c/${c.slug}/about`, changefreq: "weekly", priority: "0.5" });
                entries.push({
                  path: `/c/${c.slug}/services`,
                  changefreq: "weekly",
                  priority: "0.5",
                });
                entries.push({
                  path: `/c/${c.slug}/contact`,
                  changefreq: "weekly",
                  priority: "0.4",
                });
                entries.push({ path: `/c/${c.slug}/book`, changefreq: "weekly", priority: "0.6" });
                entries.push({
                  path: `/c/${c.slug}/walkin`,
                  changefreq: "weekly",
                  priority: "0.5",
                });
              }
            }
          }
        } catch (e) {
          console.error("Failed to fetch clinics for sitemap:", e);
        }

        const urls = entries.map(
          (e) =>
            `  <url>\n    <loc>${baseUrl}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        );
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
