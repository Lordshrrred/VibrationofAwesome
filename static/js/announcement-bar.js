// announcement-bar.js ~ Sticky dismissable announcement bar
// vibrationofawesome.com
// Inject by adding: <script src="/js/announcement-bar.js"></script>
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  var STORAGE_KEY = 'voa_announce_dismissed_v1';

  if (localStorage.getItem(STORAGE_KEY)) return;

  var css = [
    '#voa-announce{',
      'position:fixed;top:0;left:0;width:100%;z-index:99999;',
      'background:linear-gradient(90deg,rgba(10,22,24,0.97),rgba(6,15,16,0.97));',
      'border-bottom:1px solid rgba(212,175,55,0.3);',
      'padding:0.55rem 1rem;',
      'display:flex;align-items:center;justify-content:center;gap:0.75rem;flex-wrap:wrap;',
      'font-family:"Poppins","Space Grotesk",sans-serif;font-size:0.78rem;',
      'box-shadow:0 2px 16px rgba(0,0,0,0.4);',
      'transform:translateY(-100%);transition:transform 0.35s ease;',
    '}',
    '#voa-announce.visible{transform:translateY(0);}',
    '#voa-announce .ann-text{color:rgba(232,244,240,0.82);letter-spacing:0.01em;}',
    '#voa-announce .ann-text strong{color:#D4AF37;}',
    '#voa-announce .ann-link{',
      'background:#D4AF37;color:#020a0a;',
      'font-weight:700;font-size:0.72rem;letter-spacing:0.07em;text-transform:uppercase;',
      'text-decoration:none;border-radius:4px;padding:0.3rem 0.85rem;',
      'white-space:nowrap;transition:opacity 0.2s;',
    '}',
    '#voa-announce .ann-link:hover{opacity:0.85;}',
    '#voa-announce .ann-close{',
      'position:absolute;right:0.85rem;top:50%;transform:translateY(-50%);',
      'background:none;border:none;color:rgba(232,244,240,0.4);',
      'font-size:1.1rem;line-height:1;cursor:pointer;padding:0.25rem;transition:color 0.2s;',
    '}',
    '#voa-announce .ann-close:hover{color:rgba(232,244,240,0.85);}',
  ].join('');

  var html = [
    '<div id="voa-announce" role="banner">',
      '<span class="ann-text"><strong>Free ebook:</strong> A Field Guide to Vibration of Awesome</span>',
      '<a href="/field-guide/" class="ann-link">Download Now &#10022;</a>',
      '<button class="ann-close" id="voa-announce-close" aria-label="Dismiss">&times;</button>',
    '</div>',
  ].join('');

  function inject() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    document.body.insertAdjacentHTML('afterbegin', html);

    // Animate in after short delay
    setTimeout(function () {
      var bar = document.getElementById('voa-announce');
      if (bar) bar.classList.add('visible');
    }, 800);

    document.getElementById('voa-announce-close').addEventListener('click', function () {
      var bar = document.getElementById('voa-announce');
      if (bar) {
        bar.style.transition = 'transform 0.25s ease,opacity 0.25s ease';
        bar.style.transform = 'translateY(-100%)';
        bar.style.opacity = '0';
        setTimeout(function () { bar.remove(); }, 300);
      }
      localStorage.setItem(STORAGE_KEY, '1');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
