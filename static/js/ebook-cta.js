// ebook-cta.js ~ Reusable ebook CTA widget for vibrationofawesome.com
// Drop into any blog post:
//   <div data-ebook-cta data-placement="end-of-post" data-slug="your-slug"></div>
//   <script src="/js/ebook-cta.js"></script>
//
// Placements: top-banner | mid-article | end-of-post
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const STYLES = `
.voa-cta-wrap { position: relative; z-index: 2; font-family: 'Poppins', 'Space Grotesk', sans-serif; }

/* ── End-of-post ── */
.voa-cta-eop {
  margin: 3rem auto 2rem;
  max-width: 620px;
  background: linear-gradient(135deg, rgba(10,22,24,0.97) 0%, rgba(6,15,16,0.97) 100%);
  border: 1px solid rgba(34,192,106,0.26);
  border-radius: 12px;
  padding: 1.65rem 1.45rem;
  box-shadow: 0 8px 34px rgba(0,0,0,0.42), 0 0 0 1px rgba(34,192,106,0.05);
}
.voa-cta-eop .voa-cta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 136px;
  gap: 1rem;
  align-items: center;
}
.voa-cta-eop .voa-cta-copy {
  text-align: left;
}
.voa-cta-eop .voa-eyebrow {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.28em;
  text-transform: uppercase; color: #22c06a; margin-bottom: 0.75rem;
}
.voa-cta-eop .voa-title {
  font-size: clamp(1.15rem, 3vw, 1.45rem); font-weight: 800;
  color: #e8f4f0; margin-bottom: 0.5rem; line-height: 1.23;
}
.voa-cta-eop .voa-title span { color: #22c06a; }
.voa-cta-eop .voa-sub {
  font-size: 0.88rem; color: rgba(232,244,240,0.72);
  margin-bottom: 1.15rem; line-height: 1.55;
  font-family: 'Lora', Georgia, serif;
}
.voa-cover-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
}
.voa-cover-card img {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(34,192,106,0.22);
  box-shadow: 0 12px 28px rgba(0,0,0,0.3);
}
.voa-cover-note {
  font-size: 0.62rem;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(232,244,240,0.46);
}
.voa-cta-form { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
.voa-cta-input {
  flex: 1; min-width: 210px; max-width: 300px;
  background: rgba(11,26,28,0.9); border: 1px solid rgba(34,192,106,0.28);
  border-radius: 6px; color: #e8f4f0; font-size: 0.88rem;
  padding: 0.75rem 1rem; outline: none; transition: border-color 0.2s;
  font-family: inherit;
}
.voa-cta-input:focus { border-color: #22c06a; }
.voa-cta-input::placeholder { color: rgba(232,244,240,0.35); }
.voa-cta-submit {
  background: #22c06a; color: #041110;
  font-family: inherit; font-size: 0.82rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  border: none; border-radius: 6px; padding: 0.75rem 1.5rem;
  cursor: pointer; transition: opacity 0.2s; white-space: nowrap;
}
.voa-cta-submit:hover { opacity: 0.85; }
.voa-cta-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.voa-cta-success { display: none; }
.voa-cta-success .voa-dl-link {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: #22c06a; color: #041110;
  font-family: inherit; font-size: 0.9rem; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase; text-decoration: none;
  border-radius: 8px; padding: 0.85rem 2rem; margin-top: 1rem;
  box-shadow: 0 4px 20px rgba(34,192,106,0.22); transition: opacity 0.2s;
}
.voa-cta-success .voa-dl-link:hover { opacity: 0.85; }
.voa-cta-success .voa-success-msg {
  font-size: 0.85rem; color: rgba(232,244,240,0.65);
  margin-top: 0.5rem;
  font-family: 'Lora', Georgia, serif;
}

/* ── Mid-article ── */
.voa-cta-mid {
  margin: 2.5rem auto;
  max-width: 720px;
  background: rgba(34,192,106,0.06);
  border: 1px solid rgba(34,192,106,0.18);
  border-left: 3px solid #22c06a;
  border-radius: 12px;
  padding: 1.75rem 1.5rem;
}
.voa-cta-mid .voa-cta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 1.15rem;
  align-items: center;
}
.voa-cta-mid .voa-title {
  font-size: 1.05rem; font-weight: 700; color: #e8f4f0; margin-bottom: 0.5rem;
}
.voa-cta-mid .voa-title span { color: #22c06a; }
.voa-cta-mid .voa-sub {
  font-size: 0.82rem; color: rgba(232,244,240,0.6); margin-bottom: 1rem;
  font-family: 'Lora', Georgia, serif;
}
.voa-cta-mid .voa-cta-form { justify-content: flex-start; }
.voa-cta-mid .voa-cover-card img {
  border-radius: 10px;
}
.voa-cta-mid .voa-cover-note {
  font-size: 0.62rem;
}

/* ── Top-banner ── */
.voa-cta-banner {
  background: rgba(34,192,106,0.1);
  border-bottom: 1px solid rgba(34,192,106,0.25);
  padding: 0.75rem 1rem;
  text-align: center;
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; flex-wrap: wrap;
}
.voa-cta-banner .voa-banner-text {
  font-size: 0.82rem; color: rgba(232,244,240,0.8);
  font-family: 'Lora', Georgia, serif;
}
.voa-cta-banner .voa-banner-text strong { color: #22c06a; }
.voa-cta-banner .voa-banner-link {
  background: #22c06a; color: #041110;
  font-family: inherit; font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none;
  border-radius: 4px; padding: 0.4rem 1rem; white-space: nowrap;
  transition: opacity 0.2s;
}
.voa-cta-banner .voa-banner-link:hover { opacity: 0.85; }

@media (max-width: 700px) {
  .voa-cta-eop .voa-cta-grid,
  .voa-cta-mid .voa-cta-grid {
    grid-template-columns: 1fr;
  }
  .voa-cta-eop .voa-cta-copy,
  .voa-cta-mid {
    text-align: center;
  }
  .voa-cta-mid .voa-cta-form,
  .voa-cta-eop .voa-cta-form {
    justify-content: center;
  }
  .voa-cover-card {
    max-width: 220px;
    margin: 0 auto;
  }
}
`;

  function injectStyles() {
    if (document.getElementById('voa-cta-styles')) return;
    const tag = document.createElement('style');
    tag.id = 'voa-cta-styles';
    tag.textContent = STYLES;
    document.head.appendChild(tag);
    // Boom + Forest Temple pages: upgrade CTA accent to premium deep green (#22c06a)
    if (/\/blog\/(boom|matt)/.test(window.location.pathname)) {
      const bt = document.createElement('style');
      bt.id = 'voa-cta-boom';
      bt.textContent = '.voa-cta-eop{border-color:rgba(34,192,106,0.3)!important;box-shadow:0 8px 34px rgba(0,0,0,0.42),0 0 0 1px rgba(34,192,106,0.05)!important;}.voa-cta-eop .voa-eyebrow{color:#22c06a!important;}.voa-cta-eop .voa-title span{color:#22c06a!important;}.voa-cta-input{border-color:rgba(34,192,106,0.28)!important;}.voa-cta-input:focus{border-color:#22c06a!important;}.voa-cta-submit{background:#22c06a!important;}.voa-cta-success .voa-dl-link{background:#22c06a!important;box-shadow:0 4px 20px rgba(34,192,106,0.22)!important;}.voa-cta-mid{background:rgba(34,192,106,0.06)!important;border-color:rgba(34,192,106,0.18)!important;border-left-color:#22c06a!important;}.voa-cta-mid .voa-title span{color:#22c06a!important;}.voa-cta-banner{background:rgba(34,192,106,0.1)!important;border-bottom-color:rgba(34,192,106,0.25)!important;}.voa-cta-banner .voa-banner-text strong{color:#22c06a!important;}.voa-cta-banner .voa-banner-link{background:#22c06a!important;}';
      document.head.appendChild(bt);
    }
  }

  function getPageSlug(el) {
    return el.dataset.slug ||
      window.location.pathname.replace(/\/$/, '').split('/').pop() ||
      'unknown';
  }

  function renderEndOfPost(el, slug) {
    el.innerHTML = `
<div class="voa-cta-wrap">
  <div class="voa-cta-eop">
    <div class="voa-cta-grid">
      <div class="voa-cta-copy">
        <div class="voa-eyebrow">Free Transmission</div>
        <div class="voa-title">Take this further with the <span>Field Guide</span></div>
        <div class="voa-sub">A clean entry point into the Vibration of Awesome ~ the feeling, the framework, and the way back into alignment when life gets noisy.</div>
        <div class="voa-cta-form-wrap">
          <div class="voa-cta-form">
            <input type="email" class="voa-cta-input" placeholder="Your email address" autocomplete="email">
            <button class="voa-cta-submit">Send Me the Guide ✦</button>
          </div>
          <div class="voa-cta-success">
            <a href="#" class="voa-dl-link" target="_blank" rel="noopener">⬇ Open the Field Guide</a>
            <div class="voa-success-msg">It is on the way to your inbox too, in case you want to return to it later.</div>
          </div>
        </div>
      </div>
      <div class="voa-cover-card">
        <img src="/images/field-guide-cover.png" alt="Cover of A Field Guide to Vibration of Awesome by Matt EarthStar">
        <div class="voa-cover-note">The actual guide, ready to grab</div>
      </div>
    </div>
  </div>
</div>`;
    attachFormHandler(el, slug, 'end-of-post');
  }

  function renderMidArticle(el, slug) {
    el.innerHTML = `
<div class="voa-cta-wrap">
  <div class="voa-cta-mid">
    <div class="voa-cta-grid">
      <div>
        <div class="voa-title">Want the <span>Field Guide</span>?</div>
        <div class="voa-sub">Start with the clearest entry point. Drop your email and the guide opens right away.</div>
        <div class="voa-cta-form-wrap">
          <div class="voa-cta-form">
            <input type="email" class="voa-cta-input" placeholder="Your email" autocomplete="email">
            <button class="voa-cta-submit">Open the Signal ✦</button>
          </div>
          <div class="voa-cta-success">
            <a href="#" class="voa-dl-link" target="_blank" rel="noopener">⬇ Open the Guide</a>
          </div>
        </div>
      </div>
      <div class="voa-cover-card">
        <img src="/images/field-guide-cover.png" alt="Cover of A Field Guide to Vibration of Awesome by Matt EarthStar">
      </div>
    </div>
  </div>
</div>`;
    attachFormHandler(el, slug, 'mid-article');
  }

  function renderTopBanner(el, slug) {
    el.innerHTML = `
<div class="voa-cta-wrap">
  <div class="voa-cta-banner">
    <div class="voa-banner-text"><strong>Start here:</strong> A Field Guide to Vibration of Awesome</div>
    <a href="/field-guide/" class="voa-banner-link">Enter the Guide ✦</a>
  </div>
</div>`;
    // top-banner links directly to landing page, no inline form
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ebook_cta_view', placement: 'top-banner', blog_slug: slug });
  }

  function attachFormHandler(el, slug, placement) {
    const form = el.querySelector('.voa-cta-form');
    const successEl = el.querySelector('.voa-cta-success');
    const input = el.querySelector('.voa-cta-input');
    const btn = el.querySelector('.voa-cta-submit');
    const dlLink = el.querySelector('.voa-dl-link');

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ebook_cta_view', placement, blog_slug: slug });

    async function submit() {
      const email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.style.borderColor = '#e05050';
        setTimeout(() => { input.style.borderColor = ''; }, 1500);
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Opening…';
      window.dataLayer.push({ event: 'ebook_optin_submit', placement, blog_slug: slug });

      try {
        const resp = await fetch('/.netlify/functions/capture-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source_page: window.location.pathname, cta_placement: placement, blog_slug: slug }),
        });
        const data = await resp.json();
        if (data.download_url) {
          dlLink.href = data.download_url;
        } else {
          dlLink.href = '/field-guide/';
        }
      } catch (_) {
        dlLink.href = '/field-guide/';
      }

      form.style.display = 'none';
      successEl.style.display = 'block';
      window.dataLayer.push({ event: 'ebook_optin_success', placement, blog_slug: slug });
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function init() {
    injectStyles();
    const containers = document.querySelectorAll('[data-ebook-cta]');
    containers.forEach(function (el) {
      const placement = el.dataset.placement || 'end-of-post';
      const slug = getPageSlug(el);
      if (placement === 'end-of-post') renderEndOfPost(el, slug);
      else if (placement === 'mid-article') renderMidArticle(el, slug);
      else if (placement === 'top-banner') renderTopBanner(el, slug);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
