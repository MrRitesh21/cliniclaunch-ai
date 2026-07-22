import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map((f) => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.a
        }
      }))
    };
    return {
      meta: [
        { title: "FAQ — ClinicX" },
        { name: "description", content: "Answers about setup, security, custom domains, and pricing for ClinicX." },
        { property: "og:title", content: "FAQ — ClinicX" },
        { property: "og:description", content: "Common questions about setup, security, and getting started." },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(faqSchema)
        }
      ]
    };
  },
  component: FaqPage,
});

const faqs = [
  { q: "Do I need coding experience to get started?", a: "No coding required. Enter your details, schedule, and fees — ClinicX generates a polished public website instantly." },
  { q: "Can patients book from mobile?", a: "Yes. Every website is fully responsive — patients can browse and request slots from any phone, tablet, or laptop." },
  { q: "Is patient data secure?", a: "Yes. Strict Row-Level Security isolates each clinic's data. All traffic is encrypted end-to-end." },
  { q: "Can I connect a custom domain?", a: "Absolutely. Point drsmith.com to ClinicX — we handle DNS routing and provision an SSL certificate automatically." },
  { q: "Is there a free trial?", a: "ClinicX is free to start for independent practitioners. No credit card required. Upgrade for advanced modules any time." },
  { q: "Can I export my data?", a: "Yes. Full CSV exports of patients, appointments, invoices, and clinical notes are available at any time — no lock-in." },
  { q: "How do WhatsApp reminders work?", a: "We connect a business WhatsApp number and send automated confirmations, reminders 24h before, and post-visit follow-ups." },
];

function FaqPage() {
  return (
    <MarketingShell>
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Questions, <em className="text-primary">answered.</em>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">Quick answers about setup, security, and getting started.</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="bg-card border px-6 py-1 rounded-2xl">
                <AccordionTrigger className="font-display text-base font-bold text-left hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-4">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <Link to="/login"><Button size="lg">Get started free</Button></Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
