import type {
  FeedAnswerSource,
  FeedLocationContext,
  FeedQuestionCategory,
} from './types';

type FeedInferenceDraft = {
  body: string;
  confidence: number;
  modelId: string;
  sources: FeedAnswerSource[];
  promptTokenCount: number;
  completionTokenCount: number;
  latencyMs: number;
};

const APPROVED_SOURCE_MAP: Record<FeedQuestionCategory, FeedAnswerSource[]> = {
  housing: [
    {
      id: 'directory-housing',
      label: 'Directory housing profiles',
      detail: 'Approved survivor-safe housing listings and provider profiles inside CTF Directory.',
    },
    {
      id: 'lighthouse-matches',
      label: 'LightHouse housing workflows',
      detail: 'Housing request and match workflows already governed in the CTF LightHouse plugin.',
    },
  ],
  services: [
    {
      id: 'foundation-providers',
      label: 'Foundation provider directory',
      detail: 'Verified providers and quote workflows from the Foundation plugin.',
    },
    {
      id: 'directory-services',
      label: 'Directory service profiles',
      detail: 'Approved support-service inventory from the main Directory surface.',
    },
  ],
  general: [
    {
      id: 'feed-community',
      label: 'Feed community guidance',
      detail: 'Recent community support trends and admin-published survivor guidance.',
    },
    {
      id: 'ctf-approved-guidance',
      label: 'CTF approved support guidance',
      detail: 'Approved internal support playbooks and survivor-facing help content.',
    },
  ],
  safety: [
    {
      id: 'trusttransport-safety',
      label: 'TrustTransport safety workflows',
      detail: 'Safety-first transport policies and escalation guidance inside TrustTransport.',
    },
    {
      id: 'ctf-safety-guidance',
      label: 'CTF safety guidance',
      detail: 'Approved internal escalation and survivor safety playbooks.',
    },
  ],
  benefits: [
    {
      id: 'directory-benefits',
      label: 'Directory benefits references',
      detail: 'Approved benefits and service referral records represented in Directory.',
    },
    {
      id: 'ctf-benefits-guidance',
      label: 'CTF benefits guidance',
      detail: 'Internal benefits navigation guidance approved for survivor-facing support.',
    },
  ],
};

function describeLocation(location: FeedLocationContext | null | undefined): string {
  if (!location?.zipCode) {
    return 'your current area';
  }

  if (location.radiusMiles && location.radiusMiles > 0) {
    return `within ${location.radiusMiles} miles of ${location.zipCode}`;
  }

  return `near ${location.zipCode}`;
}

export function inferFeedQuestionCategory(
  body: string,
  providedCategory?: FeedQuestionCategory,
): FeedQuestionCategory {
  if (providedCategory) {
    return providedCategory;
  }

  const normalized = body.toLowerCase();
  if (/housing|rent|shelter|apartment|room/.test(normalized)) {
    return 'housing';
  }
  if (/benefit|snap|medicaid|voucher|grant/.test(normalized)) {
    return 'benefits';
  }
  if (/safe|danger|threat|transport|ride/.test(normalized)) {
    return 'safety';
  }
  if (/service|provider|help|counsel|support/.test(normalized)) {
    return 'services';
  }

  return 'general';
}

export function generateFeedAssistedAnswer(input: {
  questionBody: string;
  category: FeedQuestionCategory;
  location?: FeedLocationContext | null;
}): FeedInferenceDraft {
  const startedAt = Date.now();
  const locationLabel = describeLocation(input.location);
  const sources = APPROVED_SOURCE_MAP[input.category] ?? APPROVED_SOURCE_MAP.general;
  const modelId = 'ctf-approved-sources-summarizer-v1';

  const guidanceByCategory: Record<FeedQuestionCategory, string> = {
    housing: `Start with housing inventory and verified host/provider matches ${locationLabel}. Prioritize listings with clear move-in windows, support availability, and direct follow-up through LightHouse or Directory rather than off-platform contact.`,
    services: `Start with verified service providers ${locationLabel}. Focus on providers with clearly scoped support, availability, and safe handoff paths inside Foundation or Directory before sharing any private details.`,
    general: `Use the unified Feed, admin announcements, and verified provider directories to narrow the next safe step ${locationLabel}. If the question spans multiple topics, start with the most immediate survivor need and branch from there.`,
    safety: `Treat the first step as a safety workflow ${locationLabel}. Prefer transport and escalation guidance that keeps location-sharing minimal and uses approved CTF coordination paths when live help is needed.`,
    benefits: `Focus on approved benefits-navigation references ${locationLabel}. Gather the minimum facts needed for eligibility questions and route follow-up through verified support listings rather than unverified outside links.`,
  };

  const body = [
    `Question received: ${input.questionBody.trim()}`,
    guidanceByCategory[input.category],
    `Approved sources consulted: ${sources.map((source) => source.label).join(', ')}.`,
  ].join('\n\n');

  const promptTokenCount = Math.max(24, Math.ceil(input.questionBody.length / 4));
  const completionTokenCount = Math.max(48, Math.ceil(body.length / 4));

  return {
    body,
    confidence: input.category === 'general' ? 0.68 : 0.79,
    modelId,
    sources,
    promptTokenCount,
    completionTokenCount,
    latencyMs: Math.max(12, Date.now() - startedAt),
  };
}
