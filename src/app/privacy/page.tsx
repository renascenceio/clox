import type { Metadata } from 'next'
import Link from 'next/link'
import LegalShell, { type LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Clox collects, uses, retains, and protects personal data, and the rights available to people in the EEA, UK, California, Brazil, Quebec, and elsewhere.',
}

const EFFECTIVE = 'May 2026'

const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          Clox (&ldquo;Clox&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the workspace at <strong>clox.studio</strong>{' '}
          and the related applications. For the purposes of the EU General Data Protection Regulation (GDPR), the UK GDPR,
          Brazil&rsquo;s LGPD, and Quebec&rsquo;s Law 25, Clox is the controller of the personal data described in this notice.
        </p>
        <p>
          Questions about this notice or the data we hold about you can be sent to{' '}
          <a className="underline decoration-hairline hover:decoration-ink" href="mailto:privacy@clox.studio">
            privacy@clox.studio
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p>We deliberately collect as little as possible. The categories below cover everything we hold:</p>
        <ul>
          <li>
            <strong>Account data</strong> — email, name, organisation, country and city (so we can route to the right legal
            framework), the role assigned to you, and a hashed password if you signed up that way.
          </li>
          <li>
            <strong>Workspace content</strong> — your prompts, generated outputs, attachments, and threads. This is yours.
            We process it to deliver the service and to bill you, and we never use it to train any third-party model.
          </li>
          <li>
            <strong>Usage logs</strong> — model called, tokens in/out, latency, the chat type (chat, research, image, code,
            voice, video), cost, and timestamp. Used for billing and abuse detection.
          </li>
          <li>
            <strong>Technical data</strong> — IP address, device and browser fingerprint, page paths, and error
            traces. Retained briefly for security and reliability.
          </li>
          <li>
            <strong>Consent &amp; preferences</strong> — your cookie choices, language, theme, and the audit row that records
            when an admin changes anything that affects you.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'why-we-process',
    title: 'Why we process it (and the legal basis)',
    body: (
      <>
        <p>Under GDPR / UK GDPR we rely on the following bases:</p>
        <ul>
          <li>
            <strong>Performance of a contract</strong> — to deliver the workspace you signed up for: authentication, model
            routing, generation, billing, and support.
          </li>
          <li>
            <strong>Legitimate interests</strong> — security, fraud and abuse prevention, debugging, and aggregate product
            metrics. Balanced against your rights and freedoms.
          </li>
          <li>
            <strong>Consent</strong> — for non-essential cookies, marketing communications, and any analytics or sharing
            beyond strict service delivery. You can withdraw it at any time.
          </li>
          <li>
            <strong>Legal obligation</strong> — to retain invoices and tax records for the periods required by law.
          </li>
        </ul>
        <p>For California (CCPA / CPRA), Brazil (LGPD), and Quebec (Law 25), the equivalent local bases apply.</p>
      </>
    ),
  },
  {
    id: 'sub-processors',
    title: 'Service providers and sub-processors',
    body: (
      <>
        <p>
          We use a short list of providers to host, deliver, and secure the service. Each is bound by a data-processing
          agreement and processes data only on our instructions:
        </p>
        <ul>
          <li>
            <strong>Vercel, Inc.</strong> — application hosting and edge delivery.
          </li>
          <li>
            <strong>Supabase, Inc.</strong> — database, auth, and file storage.
          </li>
          <li>
            <strong>Model providers</strong> — OpenAI, Anthropic, Google, Groq, Fal, DeepInfra, and other AI inference
            partners. Your prompt content is sent to whichever provider you (or your workspace settings) selected, and is
            not used by them to train models when we invoke them through the AI Gateway.
          </li>
          <li>
            <strong>Stripe, Inc.</strong> — payment processing for paid plans.
          </li>
        </ul>
        <p>
          A current list with regions and contact details is available on request from{' '}
          <a className="underline decoration-hairline hover:decoration-ink" href="mailto:privacy@clox.studio">
            privacy@clox.studio
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'international-transfers',
    title: 'International transfers',
    body: (
      <p>
        Some of our providers are based in the United States. When we transfer personal data outside the EEA, the UK,
        Switzerland, Brazil, or Quebec, we rely on the European Commission&rsquo;s Standard Contractual Clauses (the
        UK&rsquo;s International Data Transfer Addendum where relevant), supplemented by appropriate technical and
        organisational measures (encryption in transit and at rest, access controls, logging).
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>
          <strong>Account &amp; profile data</strong> — for as long as the account exists, then 30 days after deletion to
          handle disputes, then permanent erasure.
        </li>
        <li>
          <strong>Workspace content</strong> — kept until you delete it or close your account; emptied from backups within
          35 days of deletion.
        </li>
        <li>
          <strong>Usage logs</strong> — 24 months for billing, security, and capacity planning.
        </li>
        <li>
          <strong>Invoices &amp; tax records</strong> — the period required by your jurisdiction (typically 6&ndash;10 years).
        </li>
        <li>
          <strong>Audit log entries</strong> — 24 months unless required for longer by a legal hold.
        </li>
      </ul>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>Depending on where you live, you have some or all of the following rights:</p>
        <ul>
          <li>
            <strong>Access &amp; portability</strong> — request a copy of the data we hold and have it sent to you in a
            machine-readable format.
          </li>
          <li>
            <strong>Rectification</strong> — correct inaccurate or incomplete data.
          </li>
          <li>
            <strong>Erasure</strong> — delete your account and the data tied to it (subject to legal-retention exceptions).
          </li>
          <li>
            <strong>Restriction &amp; objection</strong> — pause processing or object to processing based on legitimate
            interests, including direct marketing.
          </li>
          <li>
            <strong>Withdraw consent</strong> — at any time, with no impact on the lawfulness of processing before
            withdrawal.
          </li>
          <li>
            <strong>California &amp; Quebec</strong> — opt out of the &ldquo;sale or sharing&rdquo; of personal information.
            We honour the Global Privacy Control (GPC) signal automatically as such an opt-out.
          </li>
        </ul>
        <p>
          To exercise any right, email{' '}
          <a className="underline decoration-hairline hover:decoration-ink" href="mailto:privacy@clox.studio">
            privacy@clox.studio
          </a>
          . We respond within 30 days.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        We use TLS in transit, AES-256 at rest, scoped service-role credentials, row-level security on every multi-tenant
        table, audit logging on privileged actions, and least-privilege staff access. No system is perfectly secure;
        we&rsquo;ll notify you and the relevant supervisory authority if a breach materially affects your rights.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        Clox is not directed to children under 16. If you believe we hold data about a minor, write to{' '}
        <a className="underline decoration-hairline hover:decoration-ink" href="mailto:privacy@clox.studio">
          privacy@clox.studio
        </a>{' '}
        and we will delete it.
      </p>
    ),
  },
  {
    id: 'updates',
    title: 'Updates to this notice',
    body: (
      <p>
        We&rsquo;ll publish material changes here and bump the version recorded against your consent record so the
        banner re-prompts. The date at the top of this page always reflects the current version.
      </p>
    ),
  },
  {
    id: 'related',
    title: 'Related documents',
    body: (
      <ul>
        <li>
          <Link className="underline decoration-hairline hover:decoration-ink" href="/cookies">
            Cookie policy
          </Link>{' '}
          — what we store on your device and why.
        </li>
        <li>
          <Link className="underline decoration-hairline hover:decoration-ink" href="/terms">
            Terms of service
          </Link>{' '}
          — the contract that governs the workspace itself.
        </li>
      </ul>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalShell
      numeral="01"
      eyebrow="legal · privacy notice"
      title={
        <>
          The data we hold, and the rights{' '}
          <em className="not-italic underline decoration-accent decoration-2 underline-offset-[6px]">
            you have over it
          </em>
          .
        </>
      }
      lead="Plain-language privacy notice covering GDPR, UK GDPR, CCPA / CPRA, LGPD and Quebec Law 25. We collect what we need, store it carefully, and make it easy to take it back."
      effective={EFFECTIVE}
      sections={SECTIONS}
    />
  )
}
