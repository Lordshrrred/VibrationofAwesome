#!/usr/bin/env node
/**
 * syndicate.js — Social syndication script for vibrationofawesome.com
 *
 * Usage:
 *   node syndicate.js --lane boombot --slug "how-to-use-claude-api-for-musicians"
 *   node syndicate.js --lane matt --slug "why-i-spent-20-years-doing-internet-marketing-wrong"
 *
 * Requires in .env:
 *   ANTHROPIC_API_KEY
 *   FACEBOOK_PAGE_ID
 *   FACEBOOK_ACCESS_TOKEN
 *   INSTAGRAM_ACCOUNT_ID
 *   TWITTER_API_KEY, TWITTER_API_SECRET
 *   TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 *
 * Install deps: npm install @anthropic-ai/sdk dotenv twitter-api-v2
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      opts[args[i].slice(2)] = args[i + 1] || true;
      i++;
    }
  }
  return opts;
}

// ── Load post data ────────────────────────────────────────────────────────────

function loadPost(lane, slug) {
  const indexPath = path.join(ROOT, '_data', `${lane}-posts.json`);
  if (!fs.existsSync(indexPath)) {
    throw new Error(`No post index found at _data/${lane}-posts.json`);
  }
  const posts = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const post = posts.find(p => p.slug === slug);
  if (!post) {
    throw new Error(`Post with slug "${slug}" not found in ${lane} index`);
  }
  return post;
}

// ── Claude caption generation ─────────────────────────────────────────────────

async function generateCaptions(client, post, lane) {
  const postUrl = `https://vibrationofawesome.com${post.url}`;
  const laneLabel = lane === 'matt' ? 'From the Forest Temple (Matt EarthStar)' : 'Boom Frequency (Matty BoomBoom)';

  const prompt = `You are writing social media captions to promote a blog post from "${laneLabel}" at vibrationofawesome.com.

Post title: ${post.title}
Post excerpt: ${post.excerpt}
Post URL: ${postUrl}
Published: ${post.date}

Generate three separate captions:

---FACEBOOK---
150-200 words. Conversational, human tone. Include the link naturally. 2-3 relevant hashtags at the end. Friendly but not corporate. Match the voice of the lane (Matt = raw/personal, BoomBoom = eccentric/helpful).

---INSTAGRAM---
Hook line (1 punchy sentence). Then 5-7 sentences of engaging body. End with a call to action (link in bio). Then on a new line write "HASHTAGS:" followed by 12-15 relevant hashtags separated by spaces.

---TWITTER---
A thread of 5-7 tweets. Number each tweet (1/, 2/, etc.). First tweet is the hook. Last tweet includes the link. Each tweet must be under 280 characters. Make the thread feel like a genuine insight, not an ad.

Return exactly in this format with the separators as shown.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text;

  const extract = (label) => {
    const start = raw.indexOf(`---${label}---`);
    const labels = ['FACEBOOK', 'INSTAGRAM', 'TWITTER'];
    const nextLabels = labels.filter(l => l !== label);
    let end = raw.length;
    for (const nl of nextLabels) {
      const pos = raw.indexOf(`---${nl}---`, start + 1);
      if (pos !== -1 && pos < end) end = pos;
    }
    return start !== -1 ? raw.slice(start + `---${label}---`.length, end).trim() : '';
  };

  return {
    facebook: extract('FACEBOOK'),
    instagram: extract('INSTAGRAM'),
    twitter: extract('TWITTER'),
  };
}

// ── Platform posting ──────────────────────────────────────────────────────────

async function postToFacebook(caption, postUrl) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !token) {
    throw new Error('Missing FACEBOOK_PAGE_ID or FACEBOOK_ACCESS_TOKEN');
  }

  const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: caption,
      link: postUrl,
      access_token: token,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Facebook API error: ${response.status}`);
  }
  return data;
}

async function postToInstagram(caption, postUrl) {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN; // Instagram uses same FB token

  if (!accountId || !token) {
    throw new Error('Missing INSTAGRAM_ACCOUNT_ID or FACEBOOK_ACCESS_TOKEN');
  }

  // Extract hashtags from caption
  const hashtagsMatch = caption.match(/HASHTAGS:([\s\S]+)/);
  const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';
  const mainCaption = caption.replace(/HASHTAGS:[\s\S]+/, '').trim();
  const fullCaption = `${mainCaption}\n\n${hashtags}`;

  // Instagram requires an image for feed posts. For link-only posts we use
  // a text-based approach via the Stories or use a placeholder image.
  // This posts to the Instagram feed as a photo post — you'd need an image URL.
  // For now, we post with a fallback image from the site.
  const imageUrl = 'https://vibrationofawesome.com/images/earthstar-hero.jpg';

  // Step 1: Create media container
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: fullCaption,
      access_token: token,
    }),
  });
  const container = await containerRes.json();
  if (!containerRes.ok || container.error) {
    throw new Error(container.error?.message || 'Instagram media container creation failed');
  }

  // Step 2: Publish
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: token,
    }),
  });
  const published = await publishRes.json();
  if (!publishRes.ok || published.error) {
    throw new Error(published.error?.message || 'Instagram publish failed');
  }
  return published;
}

async function postToTwitter(threadText) {
  const { TwitterApi } = require('twitter-api-v2');

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  // Parse thread into individual tweets
  const tweets = threadText
    .split(/\n(?=\d+\/)/)
    .map(t => t.replace(/^\d+\/\s*/, '').trim())
    .filter(t => t.length > 0);

  // Post as a thread (each reply to previous)
  let lastTweetId = null;
  const postedIds = [];

  for (const tweetText of tweets) {
    const payload = { text: tweetText };
    if (lastTweetId) {
      payload.reply = { in_reply_to_tweet_id: lastTweetId };
    }
    const result = await client.v2.tweet(payload);
    lastTweetId = result.data.id;
    postedIds.push(lastTweetId);
  }

  return { thread_ids: postedIds, count: postedIds.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.lane || !['matt', 'boombot'].includes(opts.lane)) {
    console.error('Error: --lane must be "matt" or "boombot"');
    process.exit(1);
  }
  if (!opts.slug) {
    console.error('Error: --slug is required');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in .env');
    process.exit(1);
  }

  const post = loadPost(opts.lane, opts.slug);
  const postUrl = `https://vibrationofawesome.com${post.url}`;
  const client = new Anthropic();

  console.log(`\n⚡ Syndicating: "${post.title}"\n`);
  console.log(`Generating captions via Claude...\n`);

  const captions = await generateCaptions(client, post, opts.lane);

  console.log('─── Generated Captions Preview ───────────────────\n');
  console.log('FACEBOOK:\n', captions.facebook.substring(0, 120) + '...\n');
  console.log('INSTAGRAM:\n', captions.instagram.substring(0, 120) + '...\n');
  console.log('TWITTER THREAD:\n', captions.twitter.substring(0, 200) + '...\n');
  console.log('──────────────────────────────────────────────────\n');

  const results = { facebook: null, instagram: null, twitter: null };
  const errors = {};

  // Facebook
  try {
    console.log('Posting to Facebook...');
    results.facebook = await postToFacebook(captions.facebook, postUrl);
    console.log('✅ Facebook: Posted successfully (ID:', results.facebook.id + ')');
  } catch (err) {
    errors.facebook = err.message;
    console.error('❌ Facebook:', err.message);
  }

  // Instagram
  try {
    console.log('Posting to Instagram...');
    results.instagram = await postToInstagram(captions.instagram, postUrl);
    console.log('✅ Instagram: Posted successfully (ID:', results.instagram.id + ')');
  } catch (err) {
    errors.instagram = err.message;
    console.error('❌ Instagram:', err.message);
  }

  // Twitter
  try {
    console.log('Posting Twitter thread...');
    results.twitter = await postToTwitter(captions.twitter);
    console.log(`✅ Twitter: Thread posted (${results.twitter.count} tweets)`);
  } catch (err) {
    errors.twitter = err.message;
    console.error('❌ Twitter:', err.message);
  }

  console.log('\n─── Syndication Complete ─────────────────────────');
  const succeeded = Object.values(errors).filter(Boolean).length === 0;
  if (succeeded) {
    console.log('✅ All platforms posted successfully!');
  } else {
    const failCount = Object.keys(errors).length;
    const successCount = 3 - failCount;
    console.log(`✅ ${successCount}/3 platforms succeeded`);
    if (Object.keys(errors).length) {
      console.log('❌ Failures:', Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(', '));
    }
  }
  console.log('──────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
