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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
}
.voa-cover-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.voa-cover-trigger::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 35% 25%, rgba(34,192,106,0.28), transparent 28%),
    radial-gradient(circle at 72% 72%, rgba(0,229,255,0.24), transparent 34%);
  filter: blur(18px);
  opacity: 0.92;
  transition: opacity 0.28s ease, transform 0.28s ease, filter 0.28s ease;
}
.voa-cover-trigger svg {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  pointer-events: none;
  opacity: 0.62;
  transition: opacity 0.28s ease, transform 0.28s ease;
}
.voa-cover-trigger .voa-cover-glint {
  position: absolute;
  width: 10px;
  height: 10px;
  opacity: 0.56;
  transition: opacity 0.28s ease, transform 0.28s ease;
  filter: drop-shadow(0 0 10px rgba(34,192,106,0.5));
}
.voa-cover-trigger .voa-cover-glint.g1 { top: 6%; left: 14%; }
.voa-cover-trigger .voa-cover-glint.g2 { right: 12%; bottom: 12%; }
.voa-cover-trigger:hover::before,
.voa-cover-trigger:focus-visible::before {
  opacity: 1;
  transform: scale(1.07);
  filter: blur(24px);
}
.voa-cover-trigger:hover svg,
.voa-cover-trigger:focus-visible svg {
  opacity: 0.82;
  transform: scale(1.09) rotate(4deg);
}
.voa-cover-trigger:hover .voa-cover-glint,
.voa-cover-trigger:focus-visible .voa-cover-glint {
  opacity: 1;
  transform: scale(1.08);
}
.voa-cover-sparkles {
  position: absolute;
  inset: -10px;
  pointer-events: none;
  z-index: 2;
}
.voa-cover-spark {
  position: absolute;
  width: 10px;
  height: 10px;
  opacity: 0.78;
  filter: drop-shadow(0 0 10px rgba(34,192,106,0.4));
  animation: voaSparkDrift 3.4s ease-in-out infinite;
}
.voa-cover-spark::before,
.voa-cover-spark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  background: linear-gradient(90deg, rgba(34,192,106,0), rgba(34,192,106,0.98), rgba(0,229,255,0));
  transform: translate(-50%, -50%);
  border-radius: 999px;
}
.voa-cover-spark::before {
  width: 100%;
  height: 2px;
}
.voa-cover-spark::after {
  width: 2px;
  height: 100%;
}
.voa-cover-spark.s1 { top: 12%; left: 10%; animation-delay: 0s; }
.voa-cover-spark.s2 { top: 22%; right: 8%; width: 8px; height: 8px; animation-delay: 0.7s; }
.voa-cover-spark.s3 { bottom: 18%; left: 8%; width: 9px; height: 9px; animation-delay: 1.3s; }
.voa-cover-spark.s4 { bottom: 10%; right: 12%; width: 8px; height: 8px; animation-delay: 1.9s; }
.voa-cover-trigger:hover .voa-cover-spark,
.voa-cover-trigger:focus-visible .voa-cover-spark {
  opacity: 1;
  filter: drop-shadow(0 0 14px rgba(0,229,255,0.56));
}
.voa-cover-card img {
  position: relative;
  z-index: 1;
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(34,192,106,0.22);
  box-shadow: 0 12px 28px rgba(0,0,0,0.3), 0 0 24px rgba(34,192,106,0.18), 0 0 34px rgba(0,229,255,0.12);
  transition: transform 0.28s ease, box-shadow 0.28s ease, filter 0.28s ease;
}
.voa-cover-trigger:hover img,
.voa-cover-trigger:focus-visible img {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 18px 34px rgba(0,0,0,0.36), 0 0 34px rgba(34,192,106,0.24), 0 0 42px rgba(0,229,255,0.18);
  filter: saturate(1.07) brightness(1.05);
}
.voa-cover-note {
  font-size: 0.62rem;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(232,244,240,0.46);
}
.voa-cover-click {
  font-size: 0.58rem;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(34,192,106,0.76);
}
.voa-cta-form { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
.voa-cta-form-wrap {
  position: relative;
}
.voa-form-sparkles {
  position: absolute;
  inset: -12px;
  pointer-events: none;
  z-index: 0;
}
.voa-form-spark {
  position: absolute;
  width: 8px;
  height: 8px;
  opacity: 0.46;
  animation: voaSparkDrift 3.1s ease-in-out infinite;
}
.voa-form-spark::before,
.voa-form-spark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  background: linear-gradient(90deg, rgba(34,192,106,0), rgba(34,192,106,0.9), rgba(0,229,255,0));
  transform: translate(-50%, -50%);
  border-radius: 999px;
}
.voa-form-spark::before {
  width: 100%;
  height: 2px;
}
.voa-form-spark::after {
  width: 2px;
  height: 100%;
}
.voa-form-spark.f1 { top: 4%; left: 2%; animation-delay: 0.2s; }
.voa-form-spark.f2 { top: 10%; right: 4%; width: 7px; height: 7px; animation-delay: 0.9s; }
.voa-form-spark.f3 { bottom: 14%; left: 7%; width: 7px; height: 7px; animation-delay: 1.5s; }
.voa-form-spark.f4 { bottom: 6%; right: 10%; animation-delay: 2.1s; }
.voa-cta-input {
  position: relative;
  z-index: 1;
  flex: 1; min-width: 210px; max-width: 300px;
  background: rgba(11,26,28,0.9); border: 1px solid rgba(34,192,106,0.28);
  border-radius: 6px; color: #e8f4f0; font-size: 0.88rem;
  padding: 0.75rem 1rem; outline: none; transition: border-color 0.2s;
  font-family: inherit;
}
.voa-cta-input:focus { border-color: #22c06a; }
.voa-cta-input::placeholder { color: rgba(232,244,240,0.35); }
.voa-cta-submit {
  position: relative;
  z-index: 1;
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

.voa-modal-shell {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(2,10,8,0.74);
  backdrop-filter: blur(12px);
}
.voa-modal-shell.is-open { display: flex; }
.voa-modal-card {
  position: relative;
  width: min(100%, 920px);
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid rgba(34,192,106,0.18);
  background:
    radial-gradient(circle at top left, rgba(34,192,106,0.08), transparent 34%),
    radial-gradient(circle at top right, rgba(0,229,255,0.08), transparent 30%),
    linear-gradient(180deg, rgba(6,15,16,0.98), rgba(3,10,12,0.98));
  box-shadow: 0 32px 90px rgba(0,0,0,0.6);
}
.voa-modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 2;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(34,192,106,0.18);
  background: rgba(5,16,14,0.86);
  color: #e8f4f0;
  cursor: pointer;
  font-size: 1rem;
}
.voa-modal-grid {
  display: grid;
  grid-template-columns: minmax(260px, 330px) minmax(0, 1fr);
}
.voa-modal-visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.4rem;
  border-right: 1px solid rgba(34,192,106,0.08);
}
.voa-modal-sparkles {
  position: absolute;
  inset: 1rem;
  pointer-events: none;
}
.voa-modal-spark {
  position: absolute;
  width: 11px;
  height: 11px;
  opacity: 0.9;
  filter: drop-shadow(0 0 14px rgba(34,192,106,0.48));
  animation: voaSparkDrift 3.5s ease-in-out infinite;
}
.voa-modal-spark::before,
.voa-modal-spark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  background: linear-gradient(90deg, rgba(34,192,106,0), rgba(34,192,106,0.98), rgba(0,229,255,0));
  transform: translate(-50%, -50%);
  border-radius: 999px;
}
.voa-modal-spark::before {
  width: 100%;
  height: 2px;
}
.voa-modal-spark::after {
  width: 2px;
  height: 100%;
}
.voa-modal-spark.m1 { top: 12%; left: 11%; animation-delay: 0.1s; }
.voa-modal-spark.m2 { top: 18%; right: 14%; width: 9px; height: 9px; animation-delay: 0.8s; }
.voa-modal-spark.m3 { top: 48%; left: 6%; width: 9px; height: 9px; animation-delay: 1.4s; }
.voa-modal-spark.m4 { top: 56%; right: 8%; animation-delay: 2s; }
.voa-modal-spark.m5 { bottom: 16%; left: 15%; width: 10px; height: 10px; animation-delay: 2.5s; }
.voa-modal-spark.m6 { bottom: 10%; right: 18%; width: 9px; height: 9px; animation-delay: 3s; }
.voa-modal-visual img {
  position: relative;
  z-index: 1;
  width: min(100%, 255px);
  border-radius: 14px;
  box-shadow: 0 22px 60px rgba(0,0,0,0.45), 0 0 42px rgba(34,192,106,0.22), 0 0 52px rgba(0,229,255,0.14);
}
.voa-modal-copy {
  padding: 2.35rem 2.4rem;
}
.voa-modal-eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #22c06a;
  margin-bottom: 0.9rem;
}
.voa-modal-title {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  line-height: 1.06;
  color: #e8f4f0;
  margin-bottom: 0.9rem;
}
.voa-modal-title span { color: #00e5ff; }
.voa-modal-copy p {
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(232,244,240,0.8);
  margin-bottom: 1rem;
  font-family: 'Lora', Georgia, serif;
}
.voa-modal-hook {
  padding: 0.95rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(34,192,106,0.14);
  background: linear-gradient(135deg, rgba(34,192,106,0.08), rgba(0,229,255,0.07));
  margin: 1.15rem 0 1.35rem;
  color: #e8f4f0;
}
.voa-modal-hook strong { color: #22c06a; }
.voa-modal-form .voa-cta-form { justify-content: flex-start; }
.voa-modal-note {
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(232,244,240,0.48);
  margin-top: 0.85rem;
}
@keyframes voaSparkDrift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(0.88); opacity: 0.36; }
  45% { transform: translate3d(2px, -4px, 0) scale(1.06); opacity: 0.9; }
  70% { transform: translate3d(-2px, 3px, 0) scale(0.96); opacity: 0.62; }
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
  .voa-modal-grid {
    grid-template-columns: 1fr;
  }
  .voa-modal-visual {
    border-right: 0;
    border-bottom: 1px solid rgba(34,192,106,0.08);
  }
  .voa-modal-copy {
    padding: 1.6rem 1.35rem 1.85rem;
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

  function ensureModal() {
    if (document.getElementById('voa-book-modal')) return;
    const shell = document.createElement('div');
    shell.id = 'voa-book-modal';
    shell.className = 'voa-modal-shell';
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
<div class="voa-modal-card" role="dialog" aria-modal="true" aria-labelledby="voa-modal-title">
  <button class="voa-modal-close" type="button" aria-label="Close Field Guide modal">✕</button>
  <div class="voa-modal-grid">
    <div class="voa-modal-visual">
      <div class="voa-modal-sparkles" aria-hidden="true">
        <span class="voa-modal-spark m1"></span>
        <span class="voa-modal-spark m2"></span>
        <span class="voa-modal-spark m3"></span>
        <span class="voa-modal-spark m4"></span>
        <span class="voa-modal-spark m5"></span>
        <span class="voa-modal-spark m6"></span>
      </div>
      <img src="/images/field-guide-cover.png" alt="Cover of A Field Guide to Vibration of Awesome by Matt EarthStar">
    </div>
    <div class="voa-modal-copy">
      <div class="voa-modal-eyebrow">You clicked this for a reason</div>
      <div class="voa-modal-title" id="voa-modal-title">Something in you already <span>recognizes the signal.</span></div>
      <p>This is the cleanest entry point into the Vibration of Awesome ~ not a generic opt-in, not fluff, just the guide that helps the feeling make sense.</p>
      <div class="voa-modal-hook"><strong>Take the transmission.</strong> Drop your email and the guide opens immediately while the impulse is still alive.</div>
      <div class="voa-modal-form">
        <div class="voa-cta-form">
          <input type="email" class="voa-cta-input" id="voa-modal-email" placeholder="Enter the email where the signal should land" autocomplete="email">
          <button class="voa-cta-submit" id="voa-modal-btn">Send Me the Transmission</button>
        </div>
        <div class="voa-cta-success" id="voa-modal-success">
          <a href="/field-guide/" class="voa-dl-link" id="voa-modal-link">⬇ Open the Field Guide</a>
          <div class="voa-success-msg">It is in your hands now ~ and in your inbox too.</div>
        </div>
        <div class="voa-modal-note">Instant access. Zero fluff. Only signal.</div>
      </div>
    </div>
  </div>
</div>`;
    document.body.appendChild(shell);

    const close = shell.querySelector('.voa-modal-close');
    close.addEventListener('click', closeModal);
    shell.addEventListener('click', function (event) {
      if (event.target === shell) closeModal();
    });
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && shell.classList.contains('is-open')) closeModal();
    });
    shell.querySelector('#voa-modal-btn').addEventListener('click', function () {
      submitModalForm();
    });
    shell.querySelector('#voa-modal-email').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') submitModalForm();
    });
  }

  function openModal(slug, placement) {
    ensureModal();
    const shell = document.getElementById('voa-book-modal');
    shell.dataset.slug = slug || '';
    shell.dataset.placement = placement || 'cover-click';
    shell.classList.add('is-open');
    shell.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const input = shell.querySelector('#voa-modal-email');
    setTimeout(function () { if (input) input.focus(); }, 120);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ebook_cover_click', placement: placement || 'cover-click', blog_slug: slug || '' });
  }

  function closeModal() {
    const shell = document.getElementById('voa-book-modal');
    if (!shell) return;
    shell.classList.remove('is-open');
    shell.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function submitModalForm() {
    const shell = document.getElementById('voa-book-modal');
    if (!shell) return;
    const input = shell.querySelector('#voa-modal-email');
    const btn = shell.querySelector('#voa-modal-btn');
    const success = shell.querySelector('#voa-modal-success');
    const link = shell.querySelector('#voa-modal-link');
    const email = input.value.trim();
    const slug = shell.dataset.slug || '';
    const placement = shell.dataset.placement || 'cover-click';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      input.style.borderColor = '#e05050';
      setTimeout(function () { input.style.borderColor = ''; }, 1500);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Opening...';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ebook_optin_submit', placement, blog_slug: slug });

    try {
      const resp = await fetch('/.netlify/functions/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source_page: window.location.pathname, cta_placement: placement, blog_slug: slug }),
      });
      const data = await resp.json();
      link.href = data.download_url || '/field-guide/';
    } catch (_) {
      link.href = '/field-guide/';
    }

    shell.querySelector('.voa-cta-form').style.display = 'none';
    shell.querySelector('.voa-modal-note').style.display = 'none';
    success.style.display = 'block';
    window.dataLayer.push({ event: 'ebook_optin_success', placement, blog_slug: slug });
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
          <div class="voa-form-sparkles" aria-hidden="true">
            <span class="voa-form-spark f1"></span>
            <span class="voa-form-spark f2"></span>
            <span class="voa-form-spark f3"></span>
            <span class="voa-form-spark f4"></span>
          </div>
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
        <button type="button" class="voa-cover-trigger" aria-label="Open the Field Guide capture form">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <path d="M120 28 L194 158 L46 158 Z" fill="none" stroke="rgba(34,192,106,0.3)" stroke-width="1.5"/>
            <path d="M120 70 L162 144 L78 144 Z" fill="none" stroke="rgba(0,229,255,0.28)" stroke-width="1.2"/>
            <path d="M85 148 L120 88 L155 148 Z" fill="none" stroke="rgba(34,192,106,0.22)" stroke-width="1.05"/>
          </svg>
          <div class="voa-cover-sparkles" aria-hidden="true">
            <span class="voa-cover-spark s1"></span>
            <span class="voa-cover-spark s2"></span>
            <span class="voa-cover-spark s3"></span>
            <span class="voa-cover-spark s4"></span>
          </div>
          <svg class="voa-cover-glint g1" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 L17 13 H7 Z M7 14 H17 L12 23 Z" fill="rgba(34,192,106,0.86)"/></svg>
          <svg class="voa-cover-glint g2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 L17 13 H7 Z M7 14 H17 L12 23 Z" fill="rgba(0,229,255,0.82)"/></svg>
          <img src="/images/field-guide-cover.png" alt="Cover of A Field Guide to Vibration of Awesome by Matt EarthStar">
        </button>
        <div class="voa-cover-click">click the cover</div>
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
          <div class="voa-form-sparkles" aria-hidden="true">
            <span class="voa-form-spark f1"></span>
            <span class="voa-form-spark f2"></span>
            <span class="voa-form-spark f3"></span>
            <span class="voa-form-spark f4"></span>
          </div>
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
        <button type="button" class="voa-cover-trigger" aria-label="Open the Field Guide capture form">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <path d="M120 28 L194 158 L46 158 Z" fill="none" stroke="rgba(34,192,106,0.28)" stroke-width="1.4"/>
            <path d="M120 70 L162 144 L78 144 Z" fill="none" stroke="rgba(0,229,255,0.24)" stroke-width="1.15"/>
            <path d="M85 148 L120 88 L155 148 Z" fill="none" stroke="rgba(34,192,106,0.2)" stroke-width="1"/>
          </svg>
          <div class="voa-cover-sparkles" aria-hidden="true">
            <span class="voa-cover-spark s1"></span>
            <span class="voa-cover-spark s2"></span>
            <span class="voa-cover-spark s3"></span>
            <span class="voa-cover-spark s4"></span>
          </div>
          <svg class="voa-cover-glint g1" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 L17 13 H7 Z M7 14 H17 L12 23 Z" fill="rgba(34,192,106,0.82)"/></svg>
          <svg class="voa-cover-glint g2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 L17 13 H7 Z M7 14 H17 L12 23 Z" fill="rgba(0,229,255,0.76)"/></svg>
          <img src="/images/field-guide-cover.png" alt="Cover of A Field Guide to Vibration of Awesome by Matt EarthStar">
        </button>
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

    const coverTrigger = el.querySelector('.voa-cover-trigger');
    if (coverTrigger) {
      coverTrigger.addEventListener('click', function () {
        openModal(slug, placement + '-cover');
      });
    }

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
