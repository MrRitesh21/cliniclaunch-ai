import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getPublicPlans } from "@/lib/plans.functions";
import {
  ArrowRight,
  MessageSquare,
  IndianRupee,
  CheckCircle2,
  Clock,
  QrCode,
  Stethoscope,
  Users,
  ShieldCheck,
  Star,
  ChevronDown,
  CreditCard,
  Globe,
  Calendar,
  FileText,
  Pill,
  FlaskConical,
  TrendingUp,
  Megaphone,
  BarChart3,
  Bot,
  Wallet,
  LineChart,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { getClinicBySlug } from "@/lib/clinic.functions";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";
import { LeadCapture } from "@/components/clinic/lead-capture";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CommandPalette } from "@/components/marketing/CommandPalette";

export const Route = createFileRoute("/")({
  loader: async () => {
    const match = await resolveHostToClinic().catch(() => null);
    if (match?.slug) {
      try {
        const clinic = await getClinicBySlug({ data: { slug: match.slug } });
        return { clinic, clinicSlug: match.slug };
      } catch (e) {
        console.error("Failed to load clinic for custom domain:", e);
        throw redirect({
          to: "/c/$slug",
          params: { slug: match.slug },
          search: { preview: undefined },
        });
      }
    }
    return { clinic: null, clinicSlug: null };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.clinic;
    if (c) {
      const seo = typeof c.seo_config === "object" && c.seo_config ? (c.seo_config as any) : {};
      const title = seo.meta_title || `${c.doctor_name} — ${c.specialization} | ${c.clinic_name}`;
      const desc =
        seo.meta_description ||
        c.bio ||
        `Book an appointment with ${c.doctor_name}, ${c.specialization} at ${c.clinic_name}.`;
      const keywords =
        seo.keywords ||
        `${c.specialization}, ${c.doctor_name}, ${c.clinic_name}, appointment booking`;
      const image =
        c.avatar_url || (Array.isArray(c.gallery) && (c.gallery as string[])[0]) || undefined;
      return {
        meta: [
          { title },
          { name: "description", content: desc },
          { name: "keywords", content: keywords },
          { property: "og:title", content: title },
          { property: "og:description", content: desc },
          { property: "og:type", content: "website" },
          ...(image
            ? [
                { property: "og:image", content: image },
                { name: "twitter:image", content: image },
              ]
            : []),
        ],
      };
    }
    const siteUrl = "https://clinics.digiwil.com";
    const title = "ClinicX — Operating System for Independent Doctors";
    const desc =
      "Linear-grade medical practice console. Custom clinic website, 24/7 online appointments, WhatsApp bot automation, EHR, and Razorpay billing — from ₹499/month.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: siteUrl },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: siteUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "ClinicX",
            applicationCategory: "MedicalApplication",
            operatingSystem: "Web, iOS, Android",
            description: desc,
            url: siteUrl,
            offers: { "@type": "Offer", price: "499", priceCurrency: "INR" },
            aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "240" },
          }),
        },
      ],
    };
  },
  component: Landing,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
      </div>
    </div>
  ),
});

function ClinicDomainView({ clinic }: { clinic: any }) {
  const c = clinic as unknown as SiteClinic;
  const variants = resolveVariants(c.template, c.section_variants);

  const order: SectionKey[] =
    Array.isArray(c.section_order) && c.section_order.length
      ? (c.section_order as SectionKey[])
      : DEFAULT_SECTION_ORDER;
  const hidden = new Set<SectionKey>(
    Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : [],
  );

  const visible = order.filter((k) => k !== "navbar" && k !== "footer" && !hidden.has(k));

  const Navbar = getVariantComponent("navbar", variants.navbar);
  const Footer = getVariantComponent("footer", variants.footer);

  const theme = c.theme_color || "#2563eb";
  const themeStyle = {
    ["--primary" as const]: theme,
    ["--ring" as const]: theme,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col bg-background" style={themeStyle}>
      <Navbar clinic={c} pathname="/" />
      <main className="flex-1">
        {visible.map((key) => {
          const Comp = getVariantComponent(key, variants[key]);
          return <Comp key={key} clinic={c} />;
        })}
        <LeadCapture
          clinicId={c.id}
          slug={c.slug}
          doctorName={c.doctor_name}
          offer="20% off your first consultation"
        />
      </main>
      <Footer clinic={c} />
    </div>
  );
}

