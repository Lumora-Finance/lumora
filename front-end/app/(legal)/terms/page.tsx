import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions – Lumora",
  description:
    "Read the Terms and Conditions that govern your use of Lumora, the demand board for farm produce in Jos and Plateau State, Nigeria.",
};

export default function TermsPage() {
  return (
    <article className="prose prose-neutral max-w-none">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Terms and Conditions
      </h1>
      <p className="mt-2 text-ink-muted text-sm">
        Last updated: <time dateTime="2026-11-06">6 November 2026</time>
      </p>

      <p className="mt-6">
        These Terms and Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the
        Lumora platform (&ldquo;Platform&rdquo;), operated by the Lumora team (&ldquo;we&rdquo;,
        &ldquo;us&rdquo; or &ldquo;our&rdquo;). By creating an account or using the Platform you
        agree to these Terms in full. If you do not agree, do not use the Platform.
      </p>

      {/* ── 1. About Lumora ─────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">1. About Lumora</h2>
      <p>
        Lumora is a demand board for agricultural commodities — live poultry, eggs, tomatoes,
        grains and other raw farm produce — connecting bulk buyers with producers and aggregators
        in Jos, Plateau State and surrounding areas of Nigeria. The Platform lets buyers publish
        standing purchase bids and lets producers book delivery slots against those bids.
      </p>

      {/* ── 2. Eligibility ──────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">2. Eligibility</h2>
      <p>
        You must be at least 18 years old and legally able to enter into contracts under Nigerian
        law to use the Platform. By registering, you confirm that you meet these requirements.
        Businesses registering must be duly registered or licensed to operate in Nigeria and must
        ensure that the individual completing registration is authorised to bind the business.
      </p>

      {/* ── 3. Accounts ─────────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">3. Accounts</h2>
      <ul>
        <li>
          You register with a valid Nigerian phone number. You are responsible for keeping your
          OTP codes confidential and for all activity that takes place under your account.
        </li>
        <li>
          You must provide accurate, current and complete information at registration and keep it
          up to date.
        </li>
        <li>
          Notify us immediately at{" "}
          <a href="mailto:support@lumora.ng" className="text-green underline-offset-4 hover:underline">
            support@lumora.ng
          </a>{" "}
          if you believe your account has been compromised.
        </li>
        <li>
          We reserve the right to suspend or terminate accounts that violate these Terms or engage
          in fraudulent activity.
        </li>
      </ul>

      {/* ── 4. Roles and Conduct ─────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">4. Roles and Conduct</h2>
      <h3 className="mt-6 font-semibold">4.1 Buyers</h3>
      <p>
        Buyers post demand listings with honest specifications, accurate unit prices, and realistic
        daily capacity figures. A posted listing is a standing offer to purchase at the stated
        price from any producer who books a valid slot. Buyers must honour confirmed bookings and
        record accurate delivery quantities.
      </p>
      <h3 className="mt-6 font-semibold">4.2 Producers and Agents</h3>
      <p>
        Producers book slots only for produce they can deliver within the buyer&rsquo;s stated
        specification. Booking a slot is a commitment to deliver. No-shows and repeated
        cancellations may result in account restrictions.
      </p>
      <h3 className="mt-6 font-semibold">4.3 General</h3>
      <ul>
        <li>Do not post false or misleading information.</li>
        <li>Do not manipulate prices or capacity to deceive other users.</li>
        <li>Do not use the Platform for any unlawful purpose.</li>
        <li>Do not attempt to circumvent the Platform&rsquo;s booking or payment systems.</li>
        <li>Treat all other users with respect.</li>
      </ul>

      {/* ── 5. Transactions and Payments ────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">5. Transactions and Payments</h2>
      <p>
        Settlement amounts are calculated as: <em>accepted quantity × posted unit price</em>. For
        weight-priced goods, this is <em>accepted weight (kg) × price per kg</em>. A platform fee
        of 1.5% of the gross settlement value is charged to the buyer.
      </p>
      <p>
        Payments are processed through our payment partner Paystack. By making or receiving a
        payment, you also agree to Paystack&rsquo;s applicable terms and privacy policy. Lumora is
        not a bank, payment institution or financial services provider. We do not hold funds on
        your behalf beyond the time required to process a specific transaction.
      </p>
      <p>
        Payouts are released to producers only after a buyer confirms delivery. If a buyer does
        not act within the review window, delivery is automatically confirmed and the payout is
        released.
      </p>

      {/* ── 6. Disputes ─────────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">6. Disputes</h2>
      <p>
        If buyer and producer disagree on delivered quantity or quality, either party may raise a
        dispute within 24 hours of the delivery record being submitted. Lumora will review
        available evidence — weigh records, photos, and booking history — and issue a binding
        decision. Partial settlements may be applied where evidence supports them.
      </p>

      {/* ── 7. Intellectual Property ─────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">7. Intellectual Property</h2>
      <p>
        The Platform, its design, code, and content (excluding user-generated content) are owned
        by or licensed to Lumora. You may not copy, reverse-engineer, or redistribute any part of
        the Platform without our written permission.
      </p>
      <p>
        By posting content on the Platform (listings, delivery photos, ratings), you grant Lumora
        a non-exclusive, royalty-free licence to use that content to operate and improve the
        Platform.
      </p>

      {/* ── 8. Disclaimers ──────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">8. Disclaimers</h2>
      <p>
        The Platform is provided &ldquo;as is&rdquo; without warranties of any kind. We do not
        guarantee the accuracy of listings, the quality of produce, or that buyers will always
        honour their posted prices. Price index data is provided for informational purposes and is
        not investment or trading advice.
      </p>
      <p>
        We are not a party to any transaction between a buyer and a producer. Contracts for the
        sale of produce are formed directly between the buyer and the producer when a booking is
        confirmed.
      </p>

      {/* ── 9. Limitation of Liability ──────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, Lumora and its team members are not
        liable for any indirect, incidental, special, consequential or punitive damages arising
        from your use of the Platform, including loss of produce, loss of income, or failed
        deliveries.
      </p>
      <p>
        Our total liability to you for any claim arising from these Terms or the Platform shall
        not exceed the platform fees you paid in the three months before the claim arose.
      </p>

      {/* ── 10. Termination ─────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">10. Termination</h2>
      <p>
        You may close your account at any time by contacting us. We may suspend or terminate your
        access if you violate these Terms, engage in fraud, or if we discontinue the Platform.
        Pending settlements will be processed before termination where possible.
      </p>

      {/* ── 11. Changes to these Terms ──────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes by SMS
        or in-app notice at least 7 days before they take effect. Continued use of the Platform
        after that date constitutes acceptance of the new Terms.
      </p>

      {/* ── 12. Governing Law ───────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute that
        cannot be resolved amicably shall be submitted to the courts of competent jurisdiction in
        Plateau State, Nigeria.
      </p>

      {/* ── 13. Contact ─────────────────────────────────────────────── */}
      <h2 className="mt-10 font-display text-xl font-semibold">13. Contact</h2>
      <p>
        Questions about these Terms? Email us at{" "}
        <a href="mailto:support@lumora.ng" className="text-green underline-offset-4 hover:underline">
          support@lumora.ng
        </a>
        .
      </p>
    </article>
  );
}
