import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, COMPANY } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — ClinicX" },
      {
        name: "description",
        content: "Terms and conditions for using the ClinicX practice-management platform.",
      },
      { property: "og:title", content: "Terms of Service — ClinicX" },
      {
        property: "og:description",
        content: "Terms and conditions for using the ClinicX practice-management platform.",
      },
      { property: "og:url", content: "/terms" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 5, 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of the {COMPANY.name}{" "}
        platform, operated by {COMPANY.legalName}. By creating an account or using the service, you
        agree to these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be a licensed medical practitioner or authorised representative of a healthcare
        clinic in {COMPANY.jurisdiction} to create an account. You are responsible for keeping your
        credentials secure.
      </p>

      <h2>2. Your account and content</h2>
      <ul>
        <li>You are responsible for all activity that happens under your account.</li>
        <li>
          You retain ownership of the clinic and patient content you upload. You grant us a limited
          licence to host and display it as part of the service.
        </li>
        <li>
          You must not upload content that is illegal, defamatory, infringing, or that violates
          patient confidentiality obligations.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse-engineer, scrape, or attempt to bypass security controls.</li>
        <li>Send unsolicited marketing messages through the platform.</li>
        <li>Use the platform to store data unrelated to your clinic's operations.</li>
        <li>Resell or sublicense access without our written consent.</li>
      </ul>

      <h2>4. Subscriptions and billing</h2>
      <ul>
        <li>Paid plans are billed monthly or yearly in advance through Razorpay auto-pay.</li>
        <li>
          Coupons apply only to the first billing cycle unless stated otherwise. Subsequent cycles
          are charged at the full plan price.
        </li>
        <li>
          Prices are shown in Indian Rupees (INR) and are inclusive of applicable taxes unless
          stated.
        </li>
        <li>
          You can cancel from the Billing page. Cancellation takes effect at the end of the current
          billing cycle.
        </li>
      </ul>

      <h2>5. Free tier and fair use</h2>
      <p>
        We may offer a free tier with limits on appointments, storage, and messaging. We reserve the
        right to suspend accounts that materially exceed fair-use limits after notice.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        Some features (payments, WhatsApp, maps, email) are provided by third parties. Your use of
        those features is also subject to the third party's terms. We are not responsible for
        outages or actions of third-party providers.
      </p>

      <h2>7. Medical disclaimer</h2>
      <p>
        ClinicX is a practice-management tool. We do not provide medical advice, diagnosis, or
        treatment. You are solely responsible for clinical decisions and for complying with all
        applicable medical, professional, and data-protection regulations.
      </p>

      <h2>8. Availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. Scheduled
        maintenance and third-party outages may cause downtime. We will make reasonable efforts to
        notify you in advance of planned maintenance.
      </p>

      <h2>9. Termination</h2>
      <ul>
        <li>
          You may terminate at any time by cancelling your subscription and requesting account
          deletion.
        </li>
        <li>
          We may suspend or terminate accounts that violate these Terms, engage in fraud, or fail to
          pay.
        </li>
        <li>On termination, we will provide a reasonable window to export your data.</li>
      </ul>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability for any claim arising out of the
        service will not exceed the fees you paid in the twelve months before the claim. We are not
        liable for indirect, incidental, or consequential damages.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of {COMPANY.jurisdiction}. Any dispute will be subject
        to the exclusive jurisdiction of the courts at our registered office.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms. We will notify you of material changes at least 7 days before
        they take effect. Continued use after that date means you accept the updated Terms.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms? Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}
