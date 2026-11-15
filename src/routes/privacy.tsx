import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, COMPANY } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — ClinicX" },
      {
        name: "description",
        content: "How ClinicX collects, uses, and protects your personal and clinical data.",
      },
      { property: "og:title", content: "Privacy Policy — ClinicX" },
      {
        property: "og:description",
        content: "How ClinicX collects, uses, and protects your personal and clinical data.",
      },
      { property: "og:url", content: "/privacy" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 15, 2026">
      <p>
        {COMPANY.name} ("we", "us", "our"), operated by <strong>{COMPANY.legalName}</strong>, is
        committed to protecting the privacy, security, and integrity of the personal data of
        healthcare professionals, clinic administrators, staff, and patients who use our platform
        accessible at <strong>https://clinicx.digiwil.com</strong> and{" "}
        <strong>https://clinics.digiwil.com</strong>.
      </p>
      <p>
        This Privacy Policy explains the specific types of data we collect, how it is processed and
        stored, our strict adherence to Google API Limited Use policies, and your legal rights
        regarding data retention and deletion.
      </p>

      <h2>1. Who We Are and Contact Information</h2>
      <p>
        This service is operated by <strong>{COMPANY.legalName}</strong>, with our principal office
        located at {COMPANY.address}.
      </p>
      <p>
        For any privacy, security, or data protection inquiries, you may reach our designated Data
        Protection Officer directly via email at{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or phone at {COMPANY.phone}.
      </p>

      <h2>2. Information We Collect</h2>
      <p>
        We collect only the minimum information necessary to deliver our practice management and
        website services:
      </p>
      <ul>
        <li>
          <strong>Account & Profile Information:</strong> Name, professional email address, contact
          phone number, clinic name, medical qualifications, registration numbers, and encrypted
          credentials.
        </li>
        <li>
          <strong>Clinic Public Content:</strong> Clinical services, consultation fees, operating
          hours, clinic images, staff bios, and public announcements configured for your website.
        </li>
        <li>
          <strong>Practice & Patient Operational Data:</strong> Patient names, appointment
          schedules, clinical visit summaries, prescriptions, and billing receipts created by the
          clinic. All clinical records are securely isolated per organization using strict Row-Level
          Security (RLS).
        </li>
        <li>
          <strong>Billing & Transaction Details:</strong> Subscription plan records and transaction
          identifiers. All credit card, debit card, and UPI payments are processed directly by
          PCI-DSS-compliant gateways (Razorpay); we never store payment card numbers or banking
          secrets.
        </li>
        <li>
          <strong>Technical & Usage Diagnostics:</strong> IP addresses, browser types, timestamps,
          and error diagnostics collected strictly for fraud prevention, server security, and
          service uptime.
        </li>
      </ul>

      <h2>3. Google User Data & Google API Services Compliance</h2>
      <p>
        When you choose to sign in with Google or connect your Google Business Profile (Google My
        Business / GMB) to ClinicX, our application accesses specific Google user data via official
        Google APIs:
      </p>
      <ul>
        <li>
          <strong>Google Account Identification:</strong> Your Google user ID, primary email
          address, name, and profile picture retrieved via Google OAuth 2.0 to authenticate your
          identity and provision your dashboard session.
        </li>
        <li>
          <strong>Google Business Profile & Location Data:</strong> Business names, verified place
          IDs, physical storefront addresses, phone numbers, and operational categories retrieved
          via the Google My Business Business Information API and Google Places API to accurately
          link your clinic's physical practice to your digital platform.
        </li>
        <li>
          <strong>Google Reviews & Ratings:</strong> Public customer ratings, review timestamps,
          author display names, and review text retrieved via Google Places API to display verified
          feedback on your clinic portal and generate AI-assisted response drafts for your manual
          approval.
        </li>
      </ul>

      <h3>Google API Limited Use Disclosure</h3>
      <p>
        <strong>
          ClinicX's use and transfer to any other app of information received from Google APIs will
          adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </strong>
      </p>
      <p>In accordance with Google Limited Use standards:</p>
      <ul>
        <li>
          <strong>No Advertising:</strong> We never use or transfer Google user data for serving
          advertisements, including personalized, re-targeted, or interest-based advertising.
        </li>
        <li>
          <strong>No Third-Party Brokers:</strong> We do not sell, rent, lease, or trade Google user
          data to any data brokers, ad networks, or external aggregators under any circumstances.
        </li>
        <li>
          <strong>No AI Training on Private Data:</strong> Human or automated processing of your
          Google data is limited strictly to delivering the specific clinic management features you
          interact with. We never use your Google user data to train generalized machine learning or
          AI models.
        </li>
        <li>
          <strong>Strict Access Control:</strong> Only authorized, secure server functions process
          your Google API tokens. Human employees cannot read your private Google tokens or account
          data unless explicitly requested by you for technical troubleshooting.
        </li>
      </ul>

      <h2>4. How We Use Information</h2>
      <ul>
        <li>
          To provision, authenticate, and maintain your ClinicX clinic dashboard and doctor portal.
        </li>
        <li>
          To power your clinic website, patient appointment booking, and automated appointment
          reminders.
        </li>
        <li>
          To synchronize verified Google My Business reviews and enable local search engine
          optimization (SEO) for your practice.
        </li>
        <li>
          To verify billing transactions, prevent unauthorized account takeovers, and comply with
          legal requirements.
        </li>
      </ul>

      <h2>5. Data Sharing and Third-Party Sub-Processors</h2>
      <p>
        We do not sell personal data. We share information only with strictly vetted cloud
        infrastructure providers under confidentiality agreements:
      </p>
      <ul>
        <li>
          <strong>Supabase Inc.</strong> — Enterprise PostgreSQL database hosting, authentication,
          and encrypted storage (ISO 27001 & SOC 2 certified).
        </li>
        <li>
          <strong>Razorpay Software Pvt. Ltd.</strong> — PCI-DSS Level 1 compliant payment
          processing.
        </li>
        <li>
          <strong>Google LLC (Google Maps & GMB APIs)</strong> — Geolocation, Google Places lookup,
          and public review synchronization.
        </li>
        <li>
          <strong>Resend Inc.</strong> — Transactional email delivery for account security and
          billing alerts.
        </li>
      </ul>

      <h2>6. Data Retention, Disconnection & Deletion Rights</h2>
      <p>
        You have complete control over your data. You may exercise the following rights at any time:
      </p>
      <ul>
        <li>
          <strong>Disconnecting Google Account:</strong> You can disconnect your Google My Business
          profile at any time directly from <em>Dashboard ➔ Google Reviews ➔ Disconnect GMB</em>.
          This action immediately purges all Google OAuth access tokens, cached Google reviews, and
          place associations from our active database.
        </li>
        <li>
          <strong>Revoking Google Permissions:</strong> You can also revoke ClinicX's access
          directly through your Google Account settings at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://myaccount.google.com/permissions
          </a>
          .
        </li>
        <li>
          <strong>Account Deletion:</strong> If you close your account, all clinical records, staff
          profiles, and personal data are permanently deleted within 30 days, except where statutory
          tax or legal compliance requires retention (up to 8 years for invoices under Indian law).
        </li>
      </ul>
      <p>
        To request a complete copy of your data or immediate deletion, email our team at{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>7. Security & Encryption Safeguards</h2>
      <p>We protect all clinical and user data with industry-leading security practices:</p>
      <ul>
        <li>256-bit TLS/HTTPS encryption for all data in transit across public networks.</li>
        <li>AES-256 encryption at rest for database storage and backups.</li>
        <li>Strict tenant isolation enforced via PostgreSQL Row-Level Security (RLS) policies.</li>
        <li>
          Hashed authentication credentials and zero plain-text storage of user passwords or API
          secrets.
        </li>
      </ul>

      <h2>8. Updates to This Privacy Policy</h2>
      <p>
        We may update this policy periodically to reflect operational changes or regulatory
        guidance. When material updates occur, we will notify registered account holders via email
        or an in-app notification at least 7 days before the changes take effect.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        For inquiries regarding this Privacy Policy, your Google User Data, or data compliance,
        please contact:
      </p>
      <p>
        <strong>{COMPANY.legalName}</strong>
        <br />
        Attn: Privacy & Data Protection Officer
        <br />
        {COMPANY.address}
        <br />
        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        <br />
        Website:{" "}
        <a href="https://clinicx.digiwil.com" target="_blank" rel="noopener noreferrer">
          https://clinicx.digiwil.com
        </a>
      </p>
    </LegalPage>
  );
}
