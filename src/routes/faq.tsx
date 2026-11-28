import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    };
    return {
      meta: [
        { title: "FAQ — ClinicX" },
        {
          name: "description",
          content: "Answers about setup, security, custom domains, and pricing for ClinicX.",
        },
        { property: "og:title", content: "FAQ — ClinicX" },
        {
          property: "og:description",
          content: "Common questions about setup, security, and getting started.",
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(faqSchema),
        },
      ],
    };
  },
  component: FaqPage,
});

const faqs = [
  {
    q: "Do I need coding experience to get started?",
    a: "No coding required. Enter your details, schedule, and fees — ClinicX generates a polished public website instantly.",
  },
  {
    q: "Can patients book from mobile?",
    a: "Yes. Every website is fully responsive — patients can browse and request slots from any phone, tablet, or laptop.",
  },
  {
    q: "Is patient data secure?",
    a: "Yes. Strict Row-Level Security isolates each clinic's data. All traffic is encrypted end-to-end.",
  },
  {
    q: "Can I connect a custom domain?",
    a: "Absolutely. Point drsmith.com to ClinicX — we handle DNS routing and provision an SSL certificate automatically.",
  },
  {
    q: "Is there a free trial?",
    a: "ClinicX is free to start for independent practitioners. No credit card required. Upgrade for advanced modules any time.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Full CSV exports of patients, appointments, invoices, and clinical notes are available at any time — no lock-in.",
  },
  {
    q: "How do WhatsApp reminders work?",
    a: "We connect a business WhatsApp number and send automated confirmations, reminders 24h before, and post-visit follow-ups.",
  },
];

function FaqPage() {
  return (
    <MarketingShell>
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Frequently Asked Questions
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-[-0.035em] leading-[1.05]">
              Questions, <span className="font-editorial text-primary font-normal">answered.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Practical answers on clinic setup, custom domains, DPDP security, and pricing.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full divide-y divide-border border-y border-border">
            {faqs.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="border-none px-1 py-1"
              >
                <AccordionTrigger className="font-display text-base font-bold text-left hover:no-underline">
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground font-normal">
                      0{idx + 1}
                    </span>
                    <span>{item.q}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-4 pl-7">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link to="/login">
              <Button size="lg" className="rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold h-11 px-7">
                Start 14-day trial
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="rounded-lg border-border bg-surface font-medium h-11 px-6">
                Request walkthrough
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
