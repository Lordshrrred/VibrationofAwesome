import test from "node:test";
import assert from "node:assert/strict";
import { costControlledRequest, messageText } from "./lib/claude-models.js";
import { applyEditorial, articleText, findRepeatedContent } from "./lib/editorial.js";
import { planConsolidation } from "./consolidate-articles.js";
import { buildSyndicationBacklogStatus } from "./lib/syndication-backlog.js";

test("new models avoid default reasoning and unsupported sampling; search retains bounded thinking", () => {
  const sonnet = costControlledRequest({ model: "claude-sonnet-5-5", temperature: 0.9, max_tokens: 4096 });
  assert.deepEqual(sonnet.thinking, { type: "between_tools" });
  assert.equal(sonnet.temperature, undefined);
  assert.equal(sonnet.output_config.effort, "medium");
  assert.equal(sonnet.max_tokens, 4096);
  assert.deepEqual(costControlledRequest({ model: "claude-haiku-5-5" }).thinking, { type: "disabled" });
  const research = costControlledRequest({ model: "claude-haiku-5-5", tools: [{}] });
  assert.deepEqual(research.thinking, { type: "adaptive" });
  assert.equal(research.output_config.effort, "low");
  assert.equal(messageText({ content: [{ type: "thinking", thinking: "private" }, { type: "text", text: "Useful text" }] }), "Useful text");
  assert.throws(() => messageText({ stop_reason: "max_tokens" }), /Incomplete/);
});

test("editorial identity is transparent, consistent and idempotent", () => {
  const html = '<span class="author">by Matty BoomBoom (AI)</span><div class="voa-photo-rotator" data-folder="boombot"></div><script src="/js/photo-rotator.js"></script><script type="application/ld+json">{"@type":"BlogPosting","author":{"@type":"Person","name":"Matt"}}</script>';
  const result = applyEditorial(html);
  assert.ok(result.includes("Vibration of Awesome · AI-assisted"));
  assert.ok(!result.includes("voa-photo-rotator"));
  assert.ok(!result.includes('"@type":"Person"'));
  assert.equal(applyEditorial(result), result);
  const human = applyEditorial('<div class="voa-photo-rotator" data-folder="matt"></div>', "matt");
  assert.ok(human.includes("skateparkmug.jpeg"));
  assert.ok(!human.includes("AI-assisted"));
});

test("consolidation preserves the established complete original and catches identical bodies with different titles", () => {
  const text = Array.from({ length: 600 }, (_, i) => "word" + i).join(" ");
  const posts = [{ slug: "original", title: "A guide", date: "2026-01-01" }, { slug: "copy", title: "A guide!", date: "2026-02-01" }, { slug: "renamed", title: "Another title", date: "2026-03-01" }];
  const plan = planConsolidation(posts, () => `<article>${text}</article>`);
  assert.deepEqual(plan.redirects, { copy: "original", renamed: "original" });
  assert.equal(plan.survivors.length, 1);
  assert.equal(findRepeatedContent(`<article>${text}</article>`, [{ slug: "original", html: text }]).slug, "original");
  assert.equal(articleText('<article>Useful text<section data-internal-related>Repeated navigation</section><div data-ebook-cta>Promo</div></article>'), "useful text");
});

test("retired articles cannot re-enter backlink catch-up", () => {
  const result = buildSyndicationBacklogStatus([{ slug: "retired", date: "2026-01-01", syndication: {} }], { redirects: { retired: "original" } });
  assert.equal(result.summary.backlinkCapableMissingUnits, 0);
  assert.equal(result.prioritizedBacklog.length, 0);
});
