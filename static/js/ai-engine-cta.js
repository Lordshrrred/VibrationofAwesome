// ai-engine-cta.js ~ AI Engine end-of-post CTA widget
// Renders a premium styled CTA inviting readers to claim The Creative Exoskeleton.
// Drop in AI-related boom posts:
//   <div data-ai-engine-cta data-blog-slug="your-slug"></div>
//   <script src="/js/ai-engine-cta.js"></script>
//
// Has an email capture form posting to list:"ai_exoskeleton".
// Falls back to direct PDF download if the API is unavailable.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var API_URL  = window.VOA_CAPTURE_EMAIL_URL || 'https://vibrationofawesome-mailer.vercel.app/api/capture-email';
  var PDF_URL  = '/downloads/VOA_AI_Creative_Exoskeleton.pdf';
  var PAGE_URL = '/ai-engine/';

  var STYLES = `
.aecta-wrap {
  margin: 3rem auto 2rem;
  max-width: 620px;
  background: linear-gradient(135deg, rgba(6,16,18,0.97) 0%, rgba(4,12,14,0.97) 100%);
  border: 1px solid rgba(0,229,204,0.24);
  border-radius: 12px;
  padding: 1.65rem 1.45rem;
  box-shadow: 0 8px 34px rgba(0,0,0,0.42), 0 0 0 1px rgba(0,229,204,0.05);
  font-family: 'Space Grotesk', 'Rajdhani', sans-serif;
}
.aecta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px;
  gap: 1.1rem;
  align-items: center;
}
.aecta-eyebrow {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.28em;
  text-transform: uppercase; color: #00e5cc; margin-bottom: 0.6rem;
}
.aecta-title {
  font-size: clamp(1.1rem, 3vw, 1.4rem); font-weight: 800;
  color: #e8f4f0; margin-bottom: 0.45rem; line-height: 1.22;
}
.aecta-title span { color: #00e5cc; }
.aecta-sub {
  font-size: 0.88rem; color: rgba(232,244,240,0.7);
  margin-bottom: 1.1rem; line-height: 1.55;
  font-family: 'Lora', Georgia, serif;
}
.aecta-form { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.aecta-input {
  flex: 1; min-width: 190px; max-width: 280px;
  background: rgba(4,16,18,0.92); border: 1px solid rgba(0,229,204,0.26);
  border-radius: 6px; color: #e8f4f0; font-size: 0.88rem;
  padding: 0.72rem 1rem; outline: none; transition: border-color 0.2s;
  font-family: inherit;
}
.aecta-input:focus { border-color: #00e5cc; }
.aecta-input::placeholder { color: rgba(232,244,240,0.34); }
.aecta-btn {
  background: linear-gradient(135deg, #00e5cc 0%, #c9a84c 100%);
  color: #020a0a;
  font-family: inherit; font-size: 0.82rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  border: none; border-radius: 6px; padding: 0.72rem 1.3rem;
  cursor: pointer; transition: opacity 0.2s; white-space: nowrap;
}
.aecta-btn:hover { opacity: 0.88; }
.aecta-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.aecta-note {
  font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(232,244,240,0.4); margin-top: 0.65rem;
}
.aecta-success { display: none; }
.aecta-success .aecta-dl {
  display: inline-flex; align-items: center; gap: 0.45rem;
  background: linear-gradient(135deg, #00e5cc 0%, #c9a84c 100%);
  color: #020a0a;
  font-family: inherit; font-size: 0.9rem; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase; text-decoration: none;
  border-radius: 8px; padding: 0.8rem 1.8rem; margin-top: 0.9rem;
  box-shadow: 0 4px 20px rgba(0,229,204,0.22); transition: opacity 0.2s;
}
.aecta-success .aecta-dl:hover { opacity: 0.85; }
.aecta-success .aecta-msg {
  font-size: 0.85rem; color: rgba(232,244,240,0.62);
  margin-top: 0.4rem;
  font-family: 'Lora', Georgia, serif;
}
.aecta-cover-col {
  display: flex; flex-direction: column; align-items: center; gap: 0.55rem;
}
.aecta-cover-wrap {
  position: relative; display: inline-flex;
  align-items: center; justify-content: center;
  width: 100%; cursor: pointer;
}
.aecta-cover-wrap::before {
  content: '';
  position: absolute; inset: -8px; border-radius: 14px;
  background:
    radial-gradient(circle at 35% 28%, rgba(0,229,204,0.28), transparent 32%),
    radial-gradient(circle at 70% 72%, rgba(201,168,76,0.2), transparent 36%);
  filter: blur(16px); opacity: 0.88;
  transition: opacity 0.25s, filter 0.25s;
}
.aecta-cover-wrap:hover::before { opacity: 1.2; filter: blur(22px); }
.aecta-cover-wrap img {
  position: relative; z-index: 1; width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(0,229,204,0.2);
  box-shadow: 0 12px 28px rgba(0,0,0,0.38), 0 0 22px rgba(0,229,204,0.16);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.aecta-cover-wrap:hover img {
  transform: translateY(-5px) scale(1.03);
  box-shadow: 0 20px 40px rgba(0,0,0,0.48), 0 0 36px rgba(0,229,204,0.26);
}
.aecta-cover-note {
  font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(232,244,240,0.42); text-align: center;
}
@media (max-width: 640px) {
  .aecta-grid { grid-template-columns: 1fr; }
  .aecta-cover-col { max-width: 180px; margin: 0 auto; }
}
`;

  function injectStyles() {
    if (document.getElementById('aecta-styles')) return;
    var s = document.createElement('style');
    s.id = 'aecta-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function render(el) {
    var slug = el.dataset.blogSlug
      || window.location.pathname.replace(/\/$/, '').split('/').pop()
      || 'post';
    var uid = 'aecta-' + slug.slice(0, 12);

    el.innerHTML = `
<div class="aecta-wrap">
  <div class="aecta-grid">
    <div class="aecta-copy">
      <div class="aecta-eyebrow">Free AI Guide</div>
      <div class="aecta-title">The <span>Creative Exoskeleton</span></div>
      <div class="aecta-sub">A grounded guide using AI to create with purpose and stay human. The tools, the system, the mindset that holds it together.</div>
      <div id="${uid}-form">
        <div class="aecta-form">
          <input type="email" class="aecta-input" id="${uid}-email"
                 placeholder="Your email" autocomplete="email">
          <button class="aecta-btn" id="${uid}-btn">Claim It Free</button>
        </div>
        <div class="aecta-note">Free. Instant. No spam.</div>
      </div>
      <div class="aecta-success" id="${uid}-success">
        <a href="${PDF_URL}" class="aecta-dl" id="${uid}-dl" target="_blank" rel="noopener">Open the AI Guide</a>
        <div class="aecta-msg">It is in your inbox too.</div>
      </div>
    </div>
    <div class="aecta-cover-col">
      <div class="aecta-cover-wrap" id="${uid}-cover">
        <img src="/downloads/cover.png" alt="The Creative Exoskeleton ~ AI Engine guide cover" loading="lazy">
      </div>
      <div class="aecta-cover-note">click to claim</div>
    </div>
  </div>
</div>`;

    var emailEl   = el.querySelector('#' + uid + '-email');
    var btnEl     = el.querySelector('#' + uid + '-btn');
    var formEl    = el.querySelector('#' + uid + '-form');
    var successEl = el.querySelector('#' + uid + '-success');
    var dlEl      = el.querySelector('#' + uid + '-dl');
    var coverEl   = el.querySelector('#' + uid + '-cover');

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ai_engine_cta_view', blog_slug: slug });

    coverEl && coverEl.addEventListener('click', function () {
      emailEl && emailEl.focus();
    });

    function submit() {
      var email = (emailEl ? emailEl.value : '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailEl) { emailEl.style.borderColor = '#e05050'; setTimeout(function () { emailEl.style.borderColor = ''; }, 1500); }
        return;
      }
      if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'One moment...'; }
      window.dataLayer.push({ event: 'ai_engine_cta_submit', blog_slug: slug });

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          source_page: window.location.pathname,
          cta_placement: 'end-of-post',
          blog_slug: slug,
          list: 'ai_exoskeleton',
        }),
      })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var dlUrl = (res.ok && res.d && res.d.download_url) ? res.d.download_url : PDF_URL;
        if (dlEl) dlEl.href = dlUrl;
        if (formEl)    formEl.style.display    = 'none';
        if (successEl) successEl.style.display = 'block';
        window.dataLayer.push({ event: 'ai_engine_cta_success', blog_slug: slug });
      })
      .catch(function () {
        // Acquisition > perfection: show success with direct PDF link
        if (dlEl) dlEl.href = PDF_URL;
        if (formEl)    formEl.style.display    = 'none';
        if (successEl) successEl.style.display = 'block';
        window.dataLayer.push({ event: 'ai_engine_cta_fallback', blog_slug: slug });
      });
    }

    btnEl   && btnEl.addEventListener('click', submit);
    emailEl && emailEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function init() {
    var els = document.querySelectorAll('[data-ai-engine-cta]');
    if (!els.length) return;
    injectStyles();
    els.forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
