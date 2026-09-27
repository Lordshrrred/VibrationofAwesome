# Module: Claude API models, cost, and caching

Read this before changing any `model:` value, `max_tokens`, retry settings, or prompt structure. The code is the source of truth: `grep -rn "model:" scripts api` before trusting the table below.

## Client

Every Claude call site builds its client with `createAnthropicClient({ label })` from `scripts/lib/anthropic-client.js` (not `new Anthropic()`). It pins `maxRetries: 3` and logs every retried 429/5xx so runaway retries show up in logs. `api/chat.js` (AURA, raw `fetch`) has its own `callAnthropicWithRetry()` with the same cap.

## Models by task (verified against code 2026-09-27)

| Task | File | Model |
|---|---|---|
| Flagship Boom/Matt posts | `generate-post.js` | **Opus 4.8**, `max_tokens: 4096` |
| Inspiration posts (manual) | `generate-from-inspiration.js` | Sonnet 4.6 writer, Haiku keyword step |
| Syndication companions | `syndicate.js` `COMPANION_MODEL` | Haiku 4.5 (override: `SYNDICATION_COMPANION_MODEL`) |
| Captions, visual prompts, utility cards, auto-heal, topic planning, keyword evidence, cluster classification | various | Haiku 4.5 |
| AURA chatbot | `api/chat.js` | Sonnet 4.6 |
| Manual search research (`npm run seo:research`) | `seo-research.js` | Sonnet 5 |

Do not downgrade `generate-post.js` without asking Matt.

**Do not "upgrade" `generate-post.js` to Opus 5.** Tried and reverted 2026-08-06. Same $5/$25 per MTok, but it thinks by default and thinking bills as output. Measured on this prompt (cache-read steady state): Opus 4.8 $0.058/post vs Opus 5 low $0.071, medium $0.089, high (default) $0.127. If ever revisited, all three must change together:
1. `max_tokens` well above 4096 (it caps thinking + text together; 4096 truncates posts).
2. Never read `message.content[0].text` (with thinking on, block 0 is `thinking` → silently empty post). Use `extractText()`, already in the file and kept on 4.8.
3. Set `output_config.effort` explicitly (default is `high`).

About ten other call sites still read `content[0].text` (`generate-captions.js`, `generate-pinterest-image.js`, `generate-from-inspiration.js`, `seo-research.js`, `auto-heal.js`, `lib/visual-intelligence.js`, `generate-instagram-visual.js`). They are safe **only** because their models run with thinking off. Moving any of them to a thinking-on model requires a text-block filter in the same commit.

`seo-research.js` was put on Sonnet 5 because of introductory pricing ($2/$10) that ended 2026-08-31. Re-check current pricing before assuming it is still the cheaper choice; it is manual/opt-in only.

## Prompt caching

`cache_control: {type: "ephemeral"}` only engages above a model-dependent minimum prefix (~4096 tokens for Opus-tier, ~2048 for Sonnet-tier). `generate-post.js` is the one site where it matters: the existing-posts list from `buildExistingPostsList()` goes first in the user message behind a cache breakpoint (`buildCachedUserContent()`), combined with the system prompt, clearing the Opus minimum. Verified live 2026-07-07 (`cache_creation_input_tokens: 13294` then `cache_read_input_tokens: 13294`). Check `usage.cache_read_input_tokens` on batch runs. AURA's and `seo-research.js`'s prompts are marked but under the floor (harmless no-ops). `syndicate.js` Blogger/WordPress prompts are deliberately uncached (one call per run).

## Spending rules

- Routine SEO intelligence makes zero Claude/web-search calls.
- Replenishment and research have hard daily/weekly caps (`docs/modules/publishing-queue.md`).
- Get Matt's confirmation before large manual Opus batches.
