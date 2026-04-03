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
  max-width: 640px;
  background: linear-gradient(135deg, rgba(10,22,24,0.97) 0%, rgba(6,15,16,0.97) 100%);
  border: 1px solid rgba(212,175,55,0.35);
  border-radius: 12px;
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.08);
}
.voa-cta-eop .voa-eyebrow {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.28em;
  text-transform: uppercase; color: #D4AF37; margin-bottom: 1rem;
}
.voa-cta-eop .voa-title {
  font-size: clamp(1.25rem, 3vw, 1.65rem); font-weight: 800;
  color: #e8f4f0; margin-bottom: 0.6rem; line-height: 1.25;
}
.voa-cta-eop .voa-title span { color: #D4AF37; }
.voa-cta-eop .voa-sub {
  font-size: 0.9rem; color: rgba(232,244,240,0.7);
  margin-bottom: 1.75rem; line-height: 1.6;
  font-family: 'Lora', Georgia, serif;
}
.voa-cta-form { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
.voa-cta-input {
  flex: 1; min-width: 210px; max-width: 320px;
  background: rgba(11,26,28,0.9); border: 1px solid rgba(212,175,55,0.3);
  border-radius: 6px; color: #e8f4f0; font-size: 0.88rem;
  padding: 0.75rem 1rem; outline: none; transition: border-color 0.2s;
  font-family: inherit;
}
.voa-cta-input:focus { border-color: #D4AF37; }
.voa-cta-input::placeholder { color: rgba(232,244,240,0.35); }
.voa-cta-submit {
  background: #D4AF37; color: #020a0a;
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
  background: #D4AF37; color: #020a0a;
  font-family: inherit; font-size: 0.9rem; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase; text-decoration: none;
  border-radius: 8px; padding: 0.85rem 2rem; margin-top: 1rem;
  box-shadow: 0 4px 20px rgba(212,175,55,0.25); transition: opacity 0.2s;
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
  max-width: 560px;
  background: rgba(212,175,55,0.07);
  border-left: 3px solid #D4AF37;
  border-radius: 0 8px 8px 0;
  padding: 1.75rem 1.5rem;
}
.voa-cta-mid .voa-title {
  font-size: 1.05rem; font-weight: 700; color: #e8f4f0; margin-bottom: 0.5rem;
}
.voa-cta-mid .voa-title span { color: #D4AF37; }
.voa-cta-mid .voa-sub {
  font-size: 0.82rem; color: rgba(232,244,240,0.6); margin-bottom: 1rem;
  font-family: 'Lora', Georgia, serif;
}
.voa-cta-mid .voa-cta-form { justify-content: flex-start; }

/* ── Top-banner ── */
.voa-cta-banner {
  background: rgba(212,175,55,0.1);
  border-bottom: 1px solid rgba(212,175,55,0.25);
  padding: 0.75rem 1rem;
  text-align: center;
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; flex-wrap: wrap;
}
.voa-cta-banner .voa-banner-text {
  font-size: 0.82rem; color: rgba(232,244,240,0.8);
  font-family: 'Lora', Georgia, serif;
}
.voa-cta-banner .voa-banner-text strong { color: #D4AF37; }
.voa-cta-banner .voa-banner-link {
  background: #D4AF37; color: #020a0a;
  font-family: inherit; font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none;
  border-radius: 4px; padding: 0.4rem 1rem; white-space: nowrap;
  transition: opacity 0.2s;
}
.voa-cta-banner .voa-banner-link:hover { opacity: 0.85; }
`;

  function injectStyles() {
    if (document.getElementById('voa-cta-styles')) return;
    const tag = document.createElement('style');
    tag.id = 'voa-cta-styles';
    tag.textContent = STYLES;
    document.head.appendChild(tag);
    // Boom pages: upgrade CTA accent to premium deep green (#22c06a)
    if (/\/blog\/boom/.test(window.location.pathname)) {
      const bt = document.createElement('style');
      bt.id = 'voa-cta-boom';
      bt.textContent = '.voa-cta-eop{border-color:rgba(34,192,106,0.35)!important;box-shadow:0 8px 40px rgba(0,0,0,0.5),0 0 0 1px rgba(34,192,106,0.08)!important;}.voa-cta-eop .voa-eyebrow{color:#22c06a!important;}.voa-cta-eop .voa-title span{color:#22c06a!important;}.voa-cta-input{border-color:rgba(34,192,106,0.3)!important;}.voa-cta-input:focus{border-color:#22c06a!important;}.voa-cta-submit{background:#22c06a!important;}.voa-cta-success .voa-dl-link{background:#22c06a!important;box-shadow:0 4px 20px rgba(34,192,106,0.25)!important;}.voa-cta-mid{background:rgba(34,192,106,0.07)!important;border-left-color:#22c06a!important;}.voa-cta-mid .voa-title span{color:#22c06a!important;}.voa-cta-banner{background:rgba(34,192,106,0.1)!important;border-bottom-color:rgba(34,192,106,0.25)!important;}.voa-cta-banner .voa-banner-text strong{color:#22c06a!important;}.voa-cta-banner .voa-banner-link{background:#22c06a!important;}';
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
    <div class="voa-eyebrow">Free Download</div>
    <div class="voa-title">Take this further with the <span>Field Guide</span></div>
    <div class="voa-sub">A short, practical guide to entering the Vibration of Awesome — what the state actually is, how to access it, and what changes when you do. Free. Instant download.</div>
    <div class="voa-cta-form-wrap">
      <div class="voa-cta-form">
        <input type="email" class="voa-cta-input" placeholder="Your email address" autocomplete="email">
        <button class="voa-cta-submit">Get the Free Guide ✦</button>
      </div>
      <div class="voa-cta-success">
        <a href="#" class="voa-dl-link" target="_blank" rel="noopener">⬇ Download the Field Guide</a>
        <div class="voa-success-msg">Check your inbox too — we sent a copy to your email.</div>
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
    <div class="voa-title">Want the <span>Field Guide</span>?</div>
    <div class="voa-sub">The free practical guide to entering the Vibration of Awesome. Drop your email for an instant download.</div>
    <div class="voa-cta-form-wrap">
      <div class="voa-cta-form">
        <input type="email" class="voa-cta-input" placeholder="Your email" autocomplete="email">
        <button class="voa-cta-submit">Get It Free ✦</button>
      </div>
      <div class="voa-cta-success">
        <a href="#" class="voa-dl-link" target="_blank" rel="noopener">⬇ Download Now</a>
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
    <div class="voa-banner-text"><strong>Free guide:</strong> A Field Guide to Vibration of Awesome</div>
    <a href="/field-guide/" class="voa-banner-link">Download Free ✦</a>
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
      btn.textContent = '…';
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
