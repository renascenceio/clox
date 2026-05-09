import type { Metadata } from 'next'
import Link from 'next/link'
import LegalShell, { type LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your use of the Clox workspace, including content ownership, acceptable use, billing, and termination.',
}

const EFFECTIVE = 'May 2026'

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: 'The agreement',
    body: (
      <>
        <p>
          These Terms form a binding agreement between you and Clox (&ldquo;Clox&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          for your use of the workspace at <strong>clox.studio</strong> and any related applications (the &ldquo;Service&rdquo;).
          By creating an account or using the Service you accept these Terms; if you don&rsquo;t agree, don&rsquo;t use the
          Service.
        </p>
        <p>
          If you&rsquo;re using Clox on behalf of an organisation, you represent that you have authority to bind that
          organisation, and &ldquo;you&rdquo; in these Terms means both you and the organisation.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    body: (
      <p>
        You must be at least 16 years old (or older where required by local law) and capable of entering into a binding
        contract. You must not be barred from using the Service under the laws of your country or any country where the
        Service is offered.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <p>
        You are responsible for the security of your credentials, for everything that happens under your account, and for
        keeping your contact details accurate. Notify us at{' '}
        <a className="underline decoration-hairline hover:decoration-ink" href="mailto:security@clox.studio">
          security@clox.studio
        </a>{' '}
        immediately if you suspect unauthorised access.
      </p>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <>
        <p>
          You retain all rights to the prompts, attachments, and outputs you create or generate in the workspace
          (&ldquo;Your Content&rdquo;). We take only the licence we need to operate the Service: a limited, worldwide,
          royalty-free licence to host, transmit, display, and back up Your Content for as long as you keep it in the
          workspace.
        </p>
        <p>
          Generated outputs may not be original to you under copyright law in every jurisdiction. You are responsible for
          checking that your use of any output complies with applicable law and any third-party rights.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Break the law, or facilitate someone else doing so.</li>
          <li>Generate child sexual abuse material, non-consensual sexual imagery, or content that sexualises minors.</li>
          <li>Plan, threaten, or carry out violence, terrorism, or self-harm; or to harass, defame, or stalk a person.</li>
          <li>Build malware, phishing kits, biological / chemical / nuclear weapons, or cyber-weapons.</li>
          <li>
            Impersonate a real person or organisation in a way designed to deceive, including political deepfakes
            distributed without disclosure.
          </li>
          <li>Scrape, reverse engineer, or attempt to derive source code or training data from the Service.</li>
          <li>Resell, sublicense, or use the Service to build a competing AI aggregator.</li>
        </ul>
        <p>We may suspend or terminate accounts that breach this section, with or without notice depending on severity.</p>
      </>
    ),
  },
  {
    id: 'plans-billing',
    title: 'Plans, credits, and billing',
    body: (
      <>
        <p>
          Some features require a paid plan or pay-as-you-go credits. Prices are shown in the workspace and on the
          marketing site, exclusive of taxes. We may change pricing on 30 days&rsquo; notice; existing prepaid credits
          stay at the rate you bought them at.
        </p>
        <p>
          Subscriptions renew automatically unless cancelled before the renewal date. You can cancel any time from
          billing settings. Refunds are at our discretion except where required by law.
        </p>
      </>
    ),
  },
  {
    id: 'third-party-models',
    title: 'Third-party models',
    body: (
      <p>
        The Service routes prompts to AI models operated by third parties (OpenAI, Anthropic, Google, Groq, Fal, DeepInfra,
        and others). When you select a model, you are also accepting any reasonable usage policies that the model provider
        applies to inputs and outputs. We will surface those policies in-product where available.
      </p>
    ),
  },
  {
    id: 'service-availability',
    title: 'Service availability',
    body: (
      <p>
        We work hard to keep the Service up, but we don&rsquo;t guarantee uninterrupted availability. We may pause access
        for maintenance, upgrades, or in response to a security incident. Where we offer a service-level commitment, the
        terms of that commitment will be in your order form or paid-plan documentation.
      </p>
    ),
  },
  {
    id: 'warranties',
    title: 'Disclaimers',
    body: (
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the fullest extent permitted by law,
        we disclaim all warranties — express, implied, or statutory — including merchantability, fitness for a particular
        purpose, and non-infringement. AI outputs may be inaccurate, biased, or otherwise unsuitable for your purposes; you
        are responsible for evaluating outputs before relying on them.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <>
        <p>
          To the fullest extent permitted by law, neither party is liable for indirect, incidental, special, consequential,
          or punitive damages, or for lost profits, revenue, data, or goodwill, arising out of these Terms — even if the
          party has been advised of the possibility.
        </p>
        <p>
          Our aggregate liability for any claim arising out of or related to these Terms is capped at the greater of (a) the
          fees you paid us in the twelve months before the event giving rise to the claim, or (b) USD 100. Some
          jurisdictions don&rsquo;t allow these limits, in which case they apply only to the maximum extent permitted.
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: (
      <p>
        You will indemnify and hold harmless Clox and its affiliates from third-party claims arising out of (i) Your
        Content, (ii) your breach of these Terms, or (iii) your violation of applicable law. We&rsquo;ll let you know
        promptly about any such claim and let you control the defence (with our reasonable cooperation), so long as the
        defence and any settlement don&rsquo;t admit fault on our behalf without consent.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <>
        <p>
          You may terminate the agreement at any time by closing your account. We may suspend or terminate your access if
          you breach these Terms, if your account is dormant for 12+ months, or if continued provision becomes legally or
          commercially impracticable.
        </p>
        <p>
          On termination, we will give you a reasonable window to export Your Content before erasing it on the schedule
          described in our{' '}
          <Link className="underline decoration-hairline hover:decoration-ink" href="/privacy">
            privacy policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to the Service or these Terms',
    body: (
      <p>
        We may modify the Service from time to time. We may also change these Terms; if a change is material, we&rsquo;ll
        give you reasonable notice (typically 30 days) by email or in-product banner. Continuing to use the Service after a
        change takes effect means you accept the new Terms.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing law and disputes',
    body: (
      <p>
        These Terms are governed by the laws of England and Wales, without reference to conflict-of-laws principles.
        Disputes arising out of or related to these Terms are subject to the exclusive jurisdiction of the courts of
        London, England — except where you are a consumer in a country whose laws give you the right to bring proceedings
        locally.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these Terms? Write to{' '}
        <a className="underline decoration-hairline hover:decoration-ink" href="mailto:legal@clox.studio">
          legal@clox.studio
        </a>
        .
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalShell
      numeral="02"
      eyebrow="legal · terms of service"
      title={
        <>
          The contract that governs the{' '}
          <em className="not-italic underline decoration-accent decoration-2 underline-offset-[6px]">
            workspace
          </em>
          .
        </>
      }
      lead="What you agree to when you use Clox: who owns what, how billing works, what is and isn't allowed, and what happens when something goes wrong."
      effective={EFFECTIVE}
      sections={SECTIONS}
    />
  )
}
