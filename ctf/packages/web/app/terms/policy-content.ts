// Content for the public /terms page (Terms of Service + Privacy Policy).
//
// The copy is kept here as plain data so the page component stays a small,
// governance-friendly renderer (rule 116: max lines per function). Every factual
// statement below is written to match how the product actually behaves — the
// third parties it uses, how ServiceCredits work, what account deletion keeps
// and removes, and the safety/messaging model. If the product's behavior
// changes, update this file so the public policy stays accurate.

export const OPERATOR_NAME = 'Charging the Future';
export const SERVICE_NAME = 'Charging the Future';
export const CONTACT_EMAIL = 'ctf.connected070@slmails.com';
export const GOVERNING_LAW = 'the State of Delaware, United States';
// Last updated / effective date for both documents.
export const EFFECTIVE_DATE = 'July 1, 2026';

export type PolicyBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] };

export interface PolicySection {
  id: string;
  heading: string;
  blocks: PolicyBlock[];
}

export interface PolicyDocument {
  id: string;
  title: string;
  intro: string;
  sections: PolicySection[];
}

export const TERMS_DOCUMENT: PolicyDocument = {
  id: 'terms',
  title: 'Terms and Conditions',
  intro:
    `These Terms and Conditions ("Terms") are an agreement between you and ${OPERATOR_NAME} ` +
    `("we", "us", "our"), the project that operates this platform (the "Platform"). ` +
    `By creating an account or using the Platform, you agree to these Terms. If you do not ` +
    `agree, do not use the Platform.`,
  sections: [
    {
      id: 'who-we-are',
      heading: '1. Who we are',
      blocks: [
        {
          type: 'p',
          text:
            `${OPERATOR_NAME} runs a private, invite-only community and skills-economy ` +
            `platform. Membership is limited to invited members and is not open to the ` +
            `general public. We are an unincorporated project; these Terms are governed by ` +
            `the laws of ${GOVERNING_LAW}, without regard to conflict-of-law rules.`,
        },
      ],
    },
    {
      id: 'eligibility',
      heading: '2. Who may use the Platform',
      blocks: [
        {
          type: 'p',
          text:
            'The Platform is for adults only. You must be at least 18 years old to create an ' +
            'account or use the Platform. It is not directed to, and must not be used by, ' +
            'anyone under 18.',
        },
        {
          type: 'p',
          text:
            'Access is invite-only. After you sign in for the first time, your account is ' +
            'read-only until it is verified and approved. Verification asks you to submit a ' +
            'link to a public profile so a member of our team can review the request and ' +
            'approve, reject, or flag it. Until you are approved, you can only reach a limited ' +
            'part of the Platform. We may decline or revoke access at our discretion, including ' +
            'to protect the safety of the community.',
        },
      ],
    },
    {
      id: 'your-account',
      heading: '3. Your account',
      blocks: [
        {
          type: 'p',
          text:
            'Sign-in and session security are handled by our authentication provider, Clerk. ' +
            'You are responsible for keeping your login safe and for activity that happens ' +
            'under your account. Do not share your account or create more than one account ' +
            'without our permission. Tell us right away if you think your account has been ' +
            'used without your permission.',
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: '4. Community rules and acceptable use',
      blocks: [
        {
          type: 'p',
          text:
            'This is a safety-first community. You agree to treat other members with respect ' +
            'and to follow any in-product guidance. You must not:',
        },
        {
          type: 'ul',
          items: [
            'Harass, threaten, stalk, intimidate, or try to identify, locate, or surveil another member.',
            'Post content that is violent, sexualized, exploitative, hateful, or that endangers another person.',
            'Impersonate another person, misrepresent who you are, or use the Platform to target or harm a member.',
            'Attempt to gain access to accounts, data, or systems you are not authorized to reach.',
            'Break the law, infringe others’ rights, or use the Platform for fraud or money laundering.',
            'Scrape, copy, or resell other members’ data, or use automated tools to access the Platform without our written permission.',
          ],
        },
        {
          type: 'p',
          text:
            'Any member can block another member; a block is private and is never shown to ' +
            'the person blocked. You can also raise a safety concern to our team. We may ' +
            'remove content, restrict features, suspend, or remove an account that breaks ' +
            'these rules or that we reasonably believe threatens the safety of the community.',
        },
      ],
    },
    {
      id: 'service-credits',
      heading: '5. ServiceCredits and payments',
      blocks: [
        {
          type: 'p',
          text:
            'The Platform uses an in-platform unit called "ServiceCredits" to recognize ' +
            'participation and to pay for member-to-member activity. ServiceCredits are not ' +
            'money, are not legal tender, and have no cash value. You cannot withdraw them, ' +
            'convert them to cash, or redeem them for currency. They may be transferred ' +
            'between members inside the Platform and may be held in escrow for a transaction ' +
            'and released or refunded within that flow. We may issue, hold, or reallocate ' +
            'ServiceCredits as part of running the community.',
        },
        {
          type: 'p',
          text:
            'Some features may separately involve real payments or payouts (for example, ' +
            'earnings for a completed transport trip). Where that is the case, the real-money ' +
            'part is clearly presented in that feature and is recorded in our own self-hosted ' +
            'ledger (Formance), which runs inside our infrastructure. Any tax owed on what you ' +
            'earn is your responsibility.',
        },
      ],
    },
    {
      id: 'messaging',
      heading: '6. Messaging',
      blocks: [
        {
          type: 'p',
          text:
            'The Platform has no standalone or open-ended private messaging. This is a ' +
            'deliberate safety decision. Any one-to-one chat is tied to a single active ' +
            'transaction (for example, a specific trip or fulfillment) and is limited to the ' +
            'two people in that transaction. The chat opens when the transaction starts and ' +
            'closes when it ends (completed, cancelled, or disputed): no new messages can be ' +
            'sent, and both people keep read-only access for a limited time. Messages are ' +
            'kept on our servers for a limited period so we can review them for safety and ' +
            'abuse. Group and community rooms are not one-to-one messaging and follow the ' +
            'same community rules.',
        },
      ],
    },
    {
      id: 'content',
      heading: '7. Your content',
      blocks: [
        {
          type: 'p',
          text:
            'You keep ownership of the content you create. You give us permission to store, ' +
            'display, and process that content as needed to run the Platform and to keep the ' +
            'community safe. You are responsible for what you post and confirm you have the ' +
            'right to share it.',
        },
      ],
    },
    {
      id: 'termination',
      heading: '8. Ending your account',
      blocks: [
        {
          type: 'p',
          text:
            'You can delete your account or a single feature’s data at any time from the ' +
            'Account & Data page in the Platform. Deletion removes your own content across ' +
            'the Platform, with limited exceptions we keep for financial integrity, safety, ' +
            'and legal reasons — these are described in the Privacy Policy below. We may ' +
            'suspend or end your access if you break these Terms or to protect the community.',
        },
      ],
    },
    {
      id: 'disclaimers',
      heading: '9. Disclaimers',
      blocks: [
        {
          type: 'p',
          text:
            'The Platform is provided "as is" and "as available". To the fullest extent the ' +
            'law allows, we make no warranties of any kind, and we do not promise that the ' +
            'Platform will always be available, secure, or error-free. The Platform is not a ' +
            'substitute for professional, legal, medical, financial, or emergency services. ' +
            'If you are in immediate danger, contact your local emergency services.',
        },
      ],
    },
    {
      id: 'liability',
      heading: '10. Limitation of liability',
      blocks: [
        {
          type: 'p',
          text:
            'To the fullest extent the law allows, we are not liable for any indirect, ' +
            'incidental, special, consequential, or punitive damages, or for lost profits, ' +
            'data, or goodwill, arising from your use of the Platform. Nothing in these Terms ' +
            'limits any liability that cannot be limited under the law that applies to you.',
        },
      ],
    },
    {
      id: 'disputes',
      heading: '11. Disputes, arbitration, and class-action waiver',
      blocks: [
        {
          type: 'p',
          text:
            'Please contact us first at ' + CONTACT_EMAIL + ' so we can try to resolve any ' +
            'concern informally. If we cannot, you and we agree that any dispute relating to ' +
            'these Terms or the Platform will be resolved by binding individual arbitration, ' +
            'not in court, except that either party may bring a claim in small-claims court ' +
            'if it qualifies.',
        },
        {
          type: 'p',
          text:
            'You and we agree to bring claims only in an individual capacity, and not as a ' +
            'plaintiff or class member in any class, collective, or representative action ' +
            '(the "class-action waiver"). The arbitration is governed by the laws of ' +
            GOVERNING_LAW + '. If the class-action waiver is found unenforceable for a ' +
            'particular claim, that claim will proceed in court, but the rest of this section ' +
            'still applies. Some jurisdictions do not allow these limits; where that is the ' +
            'case, they do not apply to you.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '12. Changes to these Terms',
      blocks: [
        {
          type: 'p',
          text:
            'We may update these Terms from time to time. When we do, we will change the ' +
            '"Last updated" date at the top and, for meaningful changes, give notice in the ' +
            'Platform. If you keep using the Platform after a change takes effect, you accept ' +
            'the updated Terms.',
        },
      ],
    },
    {
      id: 'contact-terms',
      heading: '13. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Questions about these Terms can be sent to ' + CONTACT_EMAIL + '.',
        },
      ],
    },
  ],
};

export const PRIVACY_DOCUMENT: PolicyDocument = {
  id: 'privacy',
  title: 'Privacy Policy',
  intro:
    `This Privacy Policy explains what personal information ${OPERATOR_NAME} collects, why ` +
    `we collect it, who we share it with, and the choices and rights you have. We follow a ` +
    `privacy-by-design approach: we collect the minimum we need and apply strict access ` +
    `controls to protect a community with real safety stakes.`,
  sections: [
    {
      id: 'what-we-collect',
      heading: '1. What we collect',
      blocks: [
        {
          type: 'ul',
          items: [
            'Account identity: your email address, name, and username, handled through our authentication provider (Clerk).',
            'Verification information: the public profile link you submit so we can review and approve your access, and the outcome of that review.',
            'Content you create: posts, submissions, listings, and other content you add in the Platform.',
            'Transactions: your ServiceCredits balance and ledger, and any real-money earnings or payouts, recorded in our own self-hosted ledger (Formance), which runs inside our infrastructure.',
            'Messages: chat, and where used voice or video, tied to a transaction, kept for a limited time for safety and abuse review.',
            'Safety information: members you block and any safety concern you raise. A block is private; a safety concern is shared only with our safety team.',
            'Technical data: session and device information needed to sign you in and keep the Platform secure, and limited error diagnostics used to fix problems.',
          ],
        },
        {
          type: 'p',
          text:
            'We do not want or need more than this. We do not sell your personal ' +
            'information, and we do not use it for advertising.',
        },
      ],
    },
    {
      id: 'lawful-basis',
      heading: '2. Why we can use your information (lawful basis)',
      blocks: [
        {
          type: 'p',
          text:
            'Where the General Data Protection Regulation (GDPR) or a similar law applies, we ' +
            'rely on these grounds:',
        },
        {
          type: 'ul',
          items: [
            'To provide the Platform and the features you use — because it is needed to perform our agreement with you.',
            'To keep the community safe and prevent abuse — because we and our members have a legitimate interest in a safe platform.',
            'For optional features and communications — based on your consent, which you can withdraw at any time.',
            'To meet legal duties — because the law requires it.',
          ],
        },
      ],
    },
    {
      id: 'how-we-use',
      heading: '3. How we use your information',
      blocks: [
        {
          type: 'ul',
          items: [
            'To create and secure your account and to verify and approve access.',
            'To run the features you use, including ServiceCredits, transactions, and transaction-tied messaging.',
            'To keep the community safe: to review blocks and safety concerns, prevent abuse, and enforce the community rules.',
            'To operate, maintain, and improve the Platform and to fix problems.',
            'To meet legal, security, and record-keeping obligations.',
          ],
        },
        {
          type: 'p',
          text:
            'Automated processing: when you use the Questions feature, the text of your ' +
            'question is processed by a self-hosted AI model running on our own compute ' +
            'infrastructure to generate a draft answer. Your content is not used to train any ' +
            'third-party model, and a draft answer is a suggestion, not a decision that has a ' +
            'legal or similarly significant effect on you.',
        },
      ],
    },
    {
      id: 'sharing',
      heading: '4. Service providers we share information with',
      blocks: [
        {
          type: 'p',
          text:
            'We use a small number of vetted providers to run the Platform. Each only ' +
            'receives the information it needs, is bound by a data-processing agreement, and ' +
            'may only use the information to provide its service to us:',
        },
        {
          type: 'ul',
          items: [
            'Clerk — sign-in and account identity. Receives your email, name, username, and session/device information.',
            'GetStream — chat and video for transaction-tied and group conversations. Receives the messages and the identifiers of the people in a conversation.',
            'Sentry — error monitoring so we can find and fix problems. Configured not to receive personal information from you.',
            'Hosting and infrastructure (our application host, our database, and our self-hosted financial ledger for ServiceCredits and any real-money earnings or payouts) and, if you turn on notifications, the push-delivery service for your device.',
          ],
        },
        {
          type: 'p',
          text:
            'We may also disclose information where the law requires it, in response to ' +
            'valid legal process, or where we reasonably believe it is necessary to prevent ' +
            'imminent harm to a person. If our project ever transfers to a new operator, we ' +
            'will protect your information under terms consistent with this policy.',
        },
      ],
    },
    {
      id: 'transfers',
      heading: '5. International data transfers',
      blocks: [
        {
          type: 'p',
          text:
            'Our providers may process information in countries other than yours. Where we ' +
            'transfer personal information across borders, we put a documented lawful ' +
            'safeguard in place to protect it, consistent with the law that applies to you.',
        },
      ],
    },
    {
      id: 'security',
      heading: '6. How we protect your information',
      blocks: [
        {
          type: 'ul',
          items: [
            'Encryption in transit (TLS everywhere) and encryption at rest for our databases, stores, and backups.',
            'Keys held in a managed key service, separated by environment and sensitivity, with a defined rotation plan.',
            'Least-privilege access: people and services only reach what they need, and access to sensitive operations is auditable.',
            'Structured logging with no raw personal data in logs, traces, or crash reports.',
            'Auditable records of data access — who did what, to what, and when — kept as evidence.',
            'Security checks built into our development process, including secret, dependency, and code scanning before changes ship.',
          ],
        },
        {
          type: 'p',
          text:
            'No system can be guaranteed perfectly secure, but we work to protect your ' +
            'information and to limit what is collected in the first place.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '7. How long we keep information, and deletion',
      blocks: [
        {
          type: 'p',
          text:
            'We keep personal information only as long as we need it for the purpose it was ' +
            'collected, then delete or de-identify it. You can delete your account, or a ' +
            'single feature’s data, at any time from the Account & Data page in the Platform.',
        },
        {
          type: 'p',
          text:
            'When you delete your account, we remove your own content across the Platform, ' +
            'including your own messages. We keep a limited set of records where we are ' +
            'required to or have a strong reason to:',
        },
        {
          type: 'ul',
          items: [
            'Financial records — ServiceCredits ledgers and any real-money earnings or payout records — are kept for financial integrity. Any remaining ServiceCredits balance is returned to the community reserve after a short reclaim window, not paid out.',
            'Safety and accountability records — such as audit trails and the record that a deletion took place — are kept so the Platform stays accountable.',
            'Shared content that other members rely on may be kept where removing it would break something for others.',
          ],
        },
        {
          type: 'p',
          text:
            'Deletion is propagated to our backups on our normal backup cycle, so a short ' +
            'delay is expected before backup copies age out.',
        },
      ],
    },
    {
      id: 'your-rights',
      heading: '8. Your rights and choices',
      blocks: [
        {
          type: 'p',
          text:
            'Depending on where you live, you have rights over your personal information. You ' +
            'can ask us to:',
        },
        {
          type: 'ul',
          items: [
            'Access the personal information we hold about you and get a copy of it.',
            'Correct information that is wrong or out of date.',
            'Delete your information (you can do much of this yourself from the Account & Data page).',
            'Restrict or object to certain processing, and withdraw consent for anything based on consent.',
          ],
        },
        {
          type: 'p',
          text:
            'To make a request, email us at ' + CONTACT_EMAIL + '. We will verify your ' +
            'request, act on it within the time the law requires, and will not include other ' +
            'members’ information in what we give you. Withdrawing consent stops the related ' +
            'processing going forward. You may also have the right to complain to your local ' +
            'data protection authority.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: '9. Cookies and local storage',
      blocks: [
        {
          type: 'p',
          text:
            'We use cookies and similar local storage only for what the Platform needs to ' +
            'work — keeping you signed in and remembering settings such as your display ' +
            'theme. We do not use advertising or cross-site tracking cookies.',
        },
      ],
    },
    {
      id: 'children',
      heading: '10. Children',
      blocks: [
        {
          type: 'p',
          text:
            'The Platform is for adults 18 and older. We do not knowingly collect information ' +
            'from anyone under 18. If you believe a minor has given us information, contact ' +
            'us at ' + CONTACT_EMAIL + ' and we will remove it.',
        },
      ],
    },
    {
      id: 'breach',
      heading: '11. If there is a data breach',
      blocks: [
        {
          type: 'p',
          text:
            'We maintain an incident-response process. If a breach affects your personal ' +
            'information, we will assess its scope and notify affected members and the ' +
            'relevant authorities as required by law, including within 72 hours where the ' +
            'GDPR applies to a reportable breach.',
        },
      ],
    },
    {
      id: 'changes-privacy',
      heading: '12. Changes to this Privacy Policy',
      blocks: [
        {
          type: 'p',
          text:
            'We may update this Privacy Policy from time to time. We will change the "Last ' +
            'updated" date at the top and, for meaningful changes, give notice in the ' +
            'Platform.',
        },
      ],
    },
    {
      id: 'contact-privacy',
      heading: '13. Contact',
      blocks: [
        {
          type: 'p',
          text:
            'For any privacy question or data request, contact us at ' + CONTACT_EMAIL + '.',
        },
      ],
    },
  ],
};

export const POLICY_DOCUMENTS: PolicyDocument[] = [TERMS_DOCUMENT, PRIVACY_DOCUMENT];
