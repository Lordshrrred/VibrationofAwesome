# EarthStar Multi-Niche Map

The Boom Frequency engine now supports seven content niches. The canonical machine-readable configuration lives in `scripts/content-niches.js`; this file is the strategy map for humans.

| Slug | Display name | Core content angle |
| --- | --- | --- |
| `ai-creator-tools` | AI + Music + Creator Tools | AI, creator automation, tools, and workflow for independent artists and builders who want more output without losing the human signal. |
| `self-betrayal-avoidance` | Self-Betrayal / Avoidance | Brutal honesty, self-trust, and discipline without hustle-culture cringe. |
| `dopamine-addiction-numbing` | Dopamine Addiction / Numbing | Call out the pattern, reclaim power, and stop feeding habits that drain life force. |
| `nervous-system-dysregulation` | Nervous System Dysregulation | Calm authority, grounding, and regulation before motivation. |
| `misalignment-wrong-life` | Misalignment / Living the Wrong Life | Subtle discomfort, truth, identity shift, and stopping the performance of things that no longer fit. |
| `direction-purpose-drift` | Lack of Direction / Purpose Drift | Direction over motivation. Purpose as practical alignment, not vague spirituality. |
| `disconnection-inner-noise` | Disconnection from Self / Inner Noise | Quiet reflection, rebuilding inner trust, and hearing yourself again. |

## Rotation

Draft generation rotates through the niches in this order:

1. `ai-creator-tools`
2. `self-betrayal-avoidance`
3. `dopamine-addiction-numbing`
4. `nervous-system-dysregulation`
5. `misalignment-wrong-life`
6. `direction-purpose-drift`
7. `disconnection-inner-noise`

## Voice Guardrails

Articles should be direct, human, grounded, slightly contrarian, useful, and emotionally resonant. They should not sound like generic self-help, generic AI copy, manifestation filler, or hustle culture.

Avoid:

- "you're not broken"
- "you're not behind"
- "just believe"
- generic manifestation fluff
- generic hustle culture advice
