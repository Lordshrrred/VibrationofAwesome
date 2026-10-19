# Module: Claude models, cost, and caching

Read before changing models, output limits, retries or prompts. Matt approved this cost routing on October 18, 2026.

## Current routing

| Task | Model |
|---|---|
| Boom and Matt writing; inspiration writer | Sonnet 5.5 |
| AURA conversation; manual detailed research | Sonnet 5.5 |
| Captions, companions, visual briefs, utility cards, topic planning, repair suggestions and cluster search samples | Haiku 5.5 |

The shared factory (`scripts/lib/anthropic-client.js`) applies request settings
through `scripts/lib/claude-models.js`. AURA's raw HTTP path uses the same policy.
Sonnet uses `thinking: between_tools`, medium effort, without up-front thinking;
Haiku routine calls use disabled thinking, medium effort. Tool-enabled research
uses adaptive thinking at low effort so it can actually search. Unsupported
sampling controls are removed. Output limits remain bounded; incomplete writer
responses cannot publish. Filter content by block type rather than assuming
block zero is text when adding consumers.

## Cost and observability

Official standard rates per million input/output tokens: Sonnet 5.5 $2/$10;
Haiku 5.5 $0.10/$0.50 for prompts up to 100k tokens, $0.50/$2.50 above that.
Compared with the former Opus 4.8 writer, Sonnet's input/output token rates are
60% lower. Haiku's short-prompt rates are 90% below Haiku 4.5. These are rate
comparisons, not a promise of identical token usage or article quality.

`CLAUDE_USAGE` records task label, actual model, stop reason and token/cache
usage. Never log prompts, article bodies, subscriber information or credentials.
Organization invoices span sibling systems sharing the application key; logs
support future task attribution, not reconstruction of past costs.

## Caching and spend

Preserve prompt cache breakpoints, including the writer's stable context prefix.
Check actual cache-read usage instead of assuming caching engaged. Models have
different minimum cacheable lengths and tokenizers. Existing cached companions
must be reused when retrying distribution; no new generation for bookkeeping.

Routine SEO reporting makes zero paid model/search calls. Replenishment remains
at most eight article attempts per UTC day; research and topic planning retain
persisted cooldowns. Ask before large manual batches. Do not reset caps to hide
failures. Two tiny model smoke checks passed with zero thinking tokens during
migration. A full bounded refill produced seven complete Sonnet articles with
zero thinking tokens and seven cache reads after the first cache creation.
One output-limit rejection led to an explicit word budget, not a higher token
ceiling or an extra paid retry.

References: https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide
and https://platform.claude.com/docs/en/models/haiku-5-5/overview
