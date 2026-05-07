/**
 * EarthStar-aligned niche configuration for the Boom Frequency content engine.
 *
 * This file is the source of truth for generation prompts, draft rotation,
 * keyword research, and strategy docs.
 */

export const SEARCH_INTENTS = [
  "informational",
  "problem-aware",
  "solution-aware",
  "comparison",
  "action/how-to",
];

export const EARTHSTAR_NICHES = [
  {
    slug: "ai-creator-tools",
    displayName: "AI + Music + Creator Tools",
    coreProblem: "Creators, musicians, and solo operators know AI can help, but they do not know which tools are useful or how to build workflows that protect their actual voice.",
    audiencePain: "Too many tools, too many hype cycles, not enough practical signal. They want leverage without becoming generic content machines.",
    contentAngle: "AI, creator automation, tools, and workflow for independent artists and builders who want more output without losing the human signal.",
    exampleArticleTopics: [
      "The Best AI Tools for Musicians in 2026 (That Actually Work)",
      "How to Use AI to Make Music Without Losing Your Sound",
      "Music Production for Beginners - Where to Start Without Getting Lost",
      "How to Grow as an Independent Artist in a Noisy World",
      "AI Content Creation Tools That Actually Save Time",
      "How to Make Money as a Musician Without Compromising Your Art",
    ],
    keywordSeedPhrases: [
      "AI tools for musicians",
      "how to use AI to make music",
      "music production for beginners",
      "how to grow as an independent artist",
      "AI content creation tools",
      "how to make money as a musician",
      "creator automation workflow",
      "AI tools for creators",
    ],
    toneNotes: [
      "Practical, tool-aware, and skeptical of hype.",
      "Keep the creator's taste and signal at the center.",
      "Do not sound like a SaaS landing page.",
    ],
    keywordResearch: {
      informational: [
        "what AI tools actually help independent musicians",
        "how AI fits into a creator workflow",
        "best AI workflow for solo creators",
        "what to automate as an independent artist",
      ],
      "problem-aware": [
        "too many AI tools and no clear workflow",
        "AI content feels generic for creators",
        "why AI music tools make everything sound the same",
        "creator burnout from content production",
      ],
      "solution-aware": [
        "AI content workflow for independent artists",
        "AI music workflow without losing your sound",
        "simple creator automation stack",
        "AI tools that save time for musicians",
      ],
      comparison: [
        "AI tools vs hiring a content assistant",
        "Claude vs ChatGPT for creator workflows",
        "AI music tools vs traditional music production",
        "automation vs batch creation for artists",
      ],
      "action/how-to": [
        "how to build an AI content workflow",
        "how to use AI to promote your music",
        "how to automate creator tasks without sounding fake",
        "how to choose AI tools for your creative business",
      ],
    },
  },
  {
    slug: "self-betrayal-avoidance",
    displayName: "Self-Betrayal / Avoidance",
    coreProblem: "People know what to do but do not do it. They avoid the one move that would change everything.",
    audiencePain: "They keep negotiating with themselves, breaking private promises, and losing trust in their own word.",
    contentAngle: "Brutal honesty, self-trust, and discipline without hustle-culture cringe.",
    exampleArticleTopics: [
      "Why You Keep Avoiding What Matters",
      "How to Stop Betraying Yourself",
      "Choosing Discomfort Over the Familiar Loop",
      "Self-Respect Through Action",
      "Building Trust With Yourself Again",
    ],
    keywordSeedPhrases: [
      "why do I avoid what matters",
      "how to stop betraying yourself",
      "self trust through action",
      "choosing discomfort over comfort",
      "how to keep promises to yourself",
      "avoidance and self respect",
    ],
    toneNotes: [
      "Direct and honest, but never shaming for sport.",
      "Name the pattern clearly, then give the next grounded move.",
      "Discipline means self-respect, not punishment.",
    ],
    keywordResearch: {
      informational: [
        "why people avoid what matters most",
        "what self betrayal actually looks like",
        "why keeping promises to yourself matters",
        "how avoidance damages self trust",
      ],
      "problem-aware": [
        "I know what to do but I do not do it",
        "why do I keep breaking promises to myself",
        "why do I avoid the thing that would help me",
        "I keep choosing comfort and regret it later",
      ],
      "solution-aware": [
        "self trust exercises that are not cheesy",
        "discipline without hustle culture",
        "how to rebuild self respect through action",
        "how to stop avoiding hard decisions",
      ],
      comparison: [
        "self discipline vs self punishment",
        "avoidance vs intuition",
        "comfort zone vs self betrayal",
        "motivation vs self trust",
      ],
      "action/how-to": [
        "how to stop betraying yourself",
        "how to take the one action you keep avoiding",
        "how to choose discomfort on purpose",
        "how to keep small promises to yourself",
      ],
    },
  },
  {
    slug: "dopamine-addiction-numbing",
    displayName: "Dopamine Addiction / Numbing",
    coreProblem: "Late-night scrolling, porn, cheap stimulation, shame loops, low energy, and avoidance keep people drained.",
    audiencePain: "They feel pulled toward habits that steal momentum, then wake up tired, foggy, and quietly ashamed.",
    contentAngle: "Call out the pattern, reclaim power, and stop feeding habits that drain life force.",
    exampleArticleTopics: [
      "Breaking Late-Night Dopamine Loops",
      "Why Porn and Scrolling Destroy Momentum",
      "How to Reclaim Focus and Masculine Energy",
      "What to Do Instead of Numbing",
      "Dopamine Detox Without Cringe",
    ],
    keywordSeedPhrases: [
      "late night scrolling addiction",
      "how to stop numbing yourself",
      "porn and motivation",
      "dopamine detox without cringe",
      "cheap dopamine habits",
      "how to reclaim focus",
    ],
    toneNotes: [
      "Blunt about the cost of the habit without moral panic.",
      "Use grounded language around energy, focus, and self-command.",
      "Avoid purity culture, shame spirals, and bro-science certainty.",
    ],
    keywordResearch: {
      informational: [
        "what cheap dopamine does to motivation",
        "why late night scrolling feels impossible to stop",
        "how numbing habits drain energy",
        "why porn and scrolling create shame loops",
      ],
      "problem-aware": [
        "I keep scrolling at night even when I am tired",
        "why do I numb myself instead of taking action",
        "porn is ruining my motivation",
        "I feel drained after cheap dopamine habits",
      ],
      "solution-aware": [
        "dopamine detox without extreme rules",
        "how to break cheap dopamine habits",
        "replacement habits for late night scrolling",
        "focus reset for overstimulated people",
      ],
      comparison: [
        "dopamine detox vs digital minimalism",
        "numbing vs resting",
        "porn addiction vs avoidance pattern",
        "discipline vs dopamine management",
      ],
      "action/how-to": [
        "how to stop late night scrolling",
        "how to stop numbing yourself",
        "how to quit cheap dopamine loops",
        "how to reclaim focus after overstimulation",
      ],
    },
  },
  {
    slug: "nervous-system-dysregulation",
    displayName: "Nervous System Dysregulation",
    coreProblem: "People feel anxious, scattered, overwhelmed, overstimulated, and unable to think clearly.",
    audiencePain: "They keep trying to motivate themselves while their body is running the whole day like an alarm.",
    contentAngle: "Calm authority, grounding, and regulation before motivation.",
    exampleArticleTopics: [
      "Why Motivation Fails When Your Nervous System Is Fried",
      "How to Slow Down Without Quitting",
      "Grounding Practices for Overwhelmed People",
      "Clarity Through Regulation",
      "Reducing Inputs to Restore Focus",
    ],
    keywordSeedPhrases: [
      "nervous system regulation anxiety",
      "how to regulate your nervous system",
      "overstimulated nervous system",
      "grounding practices for anxiety",
      "how to calm your body",
      "motivation and nervous system",
    ],
    toneNotes: [
      "Calm, steady, and practical.",
      "Regulation comes before performance.",
      "No medical grandstanding. Encourage professional support when symptoms are severe or unsafe.",
    ],
    keywordResearch: {
      informational: [
        "why motivation fails when your nervous system is dysregulated",
        "what nervous system dysregulation feels like",
        "how overstimulation affects focus",
        "why reducing inputs restores clarity",
      ],
      "problem-aware": [
        "I feel anxious scattered and overwhelmed",
        "my nervous system feels fried",
        "I cannot think clearly when overwhelmed",
        "I am overstimulated and exhausted",
      ],
      "solution-aware": [
        "grounding practices for overwhelmed people",
        "nervous system regulation techniques for anxiety",
        "how to calm an overstimulated body",
        "simple somatic practices for focus",
      ],
      comparison: [
        "nervous system regulation vs motivation",
        "rest vs avoidance when overwhelmed",
        "meditation vs grounding for anxiety",
        "burnout vs nervous system dysregulation",
      ],
      "action/how-to": [
        "how to regulate your nervous system",
        "how to slow down without quitting",
        "how to ground yourself when overwhelmed",
        "how to reduce inputs and restore focus",
      ],
    },
  },
  {
    slug: "misalignment-wrong-life",
    displayName: "Misalignment / Living the Wrong Life",
    coreProblem: "Life looks fine externally but feels wrong internally.",
    audiencePain: "They have the acceptable job, relationship, routine, or identity, but something in them keeps saying this is not it.",
    contentAngle: "Subtle discomfort, truth, identity shift, and stopping the performance of things that no longer fit.",
    exampleArticleTopics: [
      "Signs Your Life Is Misaligned",
      "Why a Good Life Can Still Feel Empty",
      "How to Tell When Something Is Not for You Anymore",
      "Outgrowing Old Identities",
      "Choosing Truth Over Approval",
    ],
    keywordSeedPhrases: [
      "signs your life is misaligned",
      "why does my good life feel empty",
      "living the wrong life",
      "outgrowing old identity",
      "choosing truth over approval",
      "how to know something is not for you anymore",
    ],
    toneNotes: [
      "Subtle and emotionally precise.",
      "Do not force dramatic life-quitting advice.",
      "Point toward honest experiments, not impulsive escape.",
    ],
    keywordResearch: {
      informational: [
        "signs your life is misaligned",
        "why a good life can still feel empty",
        "what it means to outgrow an identity",
        "how approval keeps people in the wrong life",
      ],
      "problem-aware": [
        "my life looks good but feels wrong",
        "why do I feel empty even though life is fine",
        "I feel like I am living someone else's life",
        "something in my life does not fit anymore",
      ],
      "solution-aware": [
        "how to realign your life without blowing everything up",
        "how to tell the truth about what you want",
        "identity shift exercises for life changes",
        "how to stop living for approval",
      ],
      comparison: [
        "misalignment vs depression",
        "intuition vs fear in life decisions",
        "contentment vs settling",
        "approval vs authenticity",
      ],
      "action/how-to": [
        "how to know something is not for you anymore",
        "how to choose truth over approval",
        "how to outgrow an old identity",
        "how to start changing a misaligned life",
      ],
    },
  },
  {
    slug: "direction-purpose-drift",
    displayName: "Lack of Direction / Purpose Drift",
    coreProblem: "People are spinning wheels with no clear direction, no mission, and no path.",
    audiencePain: "They consume advice, start and stop projects, and wait for clarity while life keeps moving.",
    contentAngle: "Direction over motivation. Purpose as practical alignment, not vague spirituality.",
    exampleArticleTopics: [
      "How to Find Direction When You Feel Lost",
      "Choosing a Path When Nothing Feels Clear",
      "Purpose vs Motivation",
      "How to Stop Drifting",
      "Committing Before You Feel Ready",
    ],
    keywordSeedPhrases: [
      "how to find direction in life",
      "feel lost with no purpose",
      "purpose vs motivation",
      "how to stop drifting",
      "choosing a path in life",
      "commit before you feel ready",
    ],
    toneNotes: [
      "Practical, clarifying, and anti-fantasy.",
      "Purpose is built through choices, constraints, and feedback.",
      "Move readers from vague searching into one concrete commitment.",
    ],
    keywordResearch: {
      informational: [
        "why direction matters more than motivation",
        "what purpose feels like in real life",
        "why people drift without a clear path",
        "how commitment creates clarity",
      ],
      "problem-aware": [
        "I feel lost and have no direction",
        "I do not know what path to choose",
        "I keep spinning my wheels in life",
        "nothing feels clear enough to commit to",
      ],
      "solution-aware": [
        "how to find direction when you feel lost",
        "simple purpose exercises that actually help",
        "how to choose a path when nothing feels clear",
        "how to build a personal mission",
      ],
      comparison: [
        "purpose vs motivation",
        "clarity vs commitment",
        "passion vs direction",
        "life purpose vs practical alignment",
      ],
      "action/how-to": [
        "how to stop drifting in life",
        "how to commit before you feel ready",
        "how to choose your next direction",
        "how to create a 30 day direction reset",
      ],
    },
  },
  {
    slug: "disconnection-inner-noise",
    displayName: "Disconnection from Self / Inner Noise",
    coreProblem: "Too many inputs, too much noise, no inner signal, and loss of intuition.",
    audiencePain: "They are informed, stimulated, and constantly reachable, but they cannot hear what they actually know.",
    contentAngle: "Quiet reflection, rebuilding inner trust, and hearing yourself again.",
    exampleArticleTopics: [
      "How to Hear Yourself Again",
      "Reducing Noise and Overstimulation",
      "Rebuilding Intuition",
      "Journaling for Clarity",
      "Why Silence Changes Everything",
    ],
    keywordSeedPhrases: [
      "how to hear yourself again",
      "too much inner noise",
      "rebuilding intuition",
      "journaling for clarity",
      "reducing noise and overstimulation",
      "why silence matters",
    ],
    toneNotes: [
      "Quiet, reflective, and specific.",
      "Make silence feel practical, not performatively spiritual.",
      "Use simple practices that help readers notice their own signal.",
    ],
    keywordResearch: {
      informational: [
        "why silence helps you hear yourself",
        "how too many inputs disconnect you from yourself",
        "what inner noise feels like",
        "how journaling creates clarity",
      ],
      "problem-aware": [
        "I cannot hear my intuition anymore",
        "my mind feels noisy all the time",
        "I feel disconnected from myself",
        "too much information is making me confused",
      ],
      "solution-aware": [
        "journaling prompts for clarity",
        "how to rebuild intuition",
        "how to reduce mental noise",
        "quiet practices for self trust",
      ],
      comparison: [
        "intuition vs anxiety",
        "silence vs isolation",
        "journaling vs meditation for clarity",
        "inner signal vs outside advice",
      ],
      "action/how-to": [
        "how to hear yourself again",
        "how to reduce noise and overstimulation",
        "how to journal when you feel disconnected",
        "how to rebuild inner trust",
      ],
    },
  },
];

export function getNicheBySlug(slug) {
  if (!slug) return null;
  return EARTHSTAR_NICHES.find((niche) => niche.slug === slug) || null;
}

export function findNiche(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return EARTHSTAR_NICHES.find((niche) => {
    return niche.slug.toLowerCase() === normalized
      || niche.displayName.toLowerCase() === normalized;
  }) || null;
}

export function getDefaultNiche() {
  return EARTHSTAR_NICHES[0];
}

export function getNicheRotation() {
  return EARTHSTAR_NICHES.map((niche) => niche.slug);
}

export function getDraftPlan() {
  return EARTHSTAR_NICHES.flatMap((niche) => {
    return niche.exampleArticleTopics.map((title, index) => ({
      niche: niche.slug,
      topic: niche.displayName,
      pillar: niche.displayName,
      title,
      keyword: niche.keywordSeedPhrases[index] || niche.keywordSeedPhrases[0],
    }));
  });
}

export function getNichePromptContext(niche) {
  if (!niche) return "";
  return [
    "NICHE CONTEXT:",
    "Slug: " + niche.slug,
    "Display name: " + niche.displayName,
    "Core problem: " + niche.coreProblem,
    "Audience pain: " + niche.audiencePain,
    "Content angle: " + niche.contentAngle,
    "Tone notes:",
    ...niche.toneNotes.map((note) => "- " + note),
    "Keyword seed phrases:",
    ...niche.keywordSeedPhrases.map((phrase) => "- " + phrase),
  ].join("\n");
}
