/**
 * publer-media-upload.js ~ Direct binary media upload to Publer.
 *
 * Separate from syndicate.js's /media/from-url path (used for externally
 * hosted URLs like Ideogram output) because a just-rendered local image
 * buffer has no public URL yet at generation time ~ the VOA static site
 * hasn't deployed this run's assets when syndication runs. Kept as its own
 * module (not inside syndicate.js) so it can be imported by
 * generate-instagram-visual.js without a circular import between the two.
 *
 * Empirically verified against the live Publer API (2026-07-24): POST /media
 * with a multipart "file" field returns { id, path }, where path is itself a
 * real fetchable HTTPS URL ~ usable anywhere the rest of the pipeline expects
 * an imageUrl string, so a rendered buffer slots into the existing url-based
 * threading (Pinterest shared-asset reuse, generation-memory, results
 * logging) with no changes to that threading.
 */

function getPublerConfig() {
  const key  = process.env.PUBLER_API_KEY;
  const wsId = process.env.PUBLER_WORKSPACE_ID;
  if (!key)  throw new Error("PUBLER_API_KEY not set");
  if (!wsId) throw new Error("PUBLER_WORKSPACE_ID not set");

  return {
    BASE: "https://app.publer.com/api/v1",
    headers: {
      "Authorization": `Bearer-API ${key}`,
      "Publer-Workspace-Id": wsId,
    },
  };
}

/**
 * @param {Buffer} buffer   - PNG (or other image) bytes
 * @param {string} filename
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function uploadPublerMediaBuffer(buffer, filename = "card.png") {
  const { BASE, headers } = getPublerConfig();

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "image/png" }), filename);

  const resp = await fetch(`${BASE}/media`, { method: "POST", headers, body: form });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Publer media upload (buffer): ${data.message || resp.status}`);
  if (!data.id || !data.path) throw new Error("Publer media upload (buffer): missing id/path in response");

  return { id: data.id, url: data.path };
}
