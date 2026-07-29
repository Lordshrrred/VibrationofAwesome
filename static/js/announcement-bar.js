// announcement-bar.js ~ Sticky dismissable announcement bar
// vibrationofawesome.com
// Inject by adding: <script src="/js/announcement-bar.js"></script>
// ─────────────────────────────────────────────────────────────────────────────

// ── Nav Enhancement: cross-lane dropdowns on the active blog lane ─────────────
// Runs unconditionally (before the dismissal check) on every page load.
(function () {
  if (document.getElementById('voa-nav-enhance')) return;
  var style = document.createElement('style');
  style.id = 'voa-nav-enhance';
  style.textContent = [
    '.site-nav-links li.has-dropdown{position:relative;}',
    '.nav-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);min-width:168px;background:rgba(2,10,10,0.97);border:1px solid rgba(255,255,255,0.09);border-radius:3px;padding:0.25rem 0;z-index:400;box-shadow:0 8px 24px rgba(0,0,0,0.55);list-style:none;margin:0;}',
    '.site-nav-links li.has-dropdown:hover .nav-dropdown{display:block;}',
    '.nav-dropdown li{width:100%;}',
    '.nav-dropdown a{display:block!important;padding:0.45rem 1rem!important;font-family:\'Rajdhani\',sans-serif;font-size:0.7rem!important;letter-spacing:0.15em;text-transform:uppercase;color:rgba(208,255,248,0.65)!important;white-space:nowrap;text-decoration:none!important;border:none!important;background:none!important;}',
    '.nav-dropdown a::after{display:none!important;}',
    '.nav-dropdown a:hover{color:rgba(208,255,248,1)!important;background:rgba(255,255,255,0.05)!important;}',
    '@media(max-width:768px){.nav-dropdown{position:static!important;transform:none!important;border:none!important;box-shadow:none!important;background:transparent!important;padding:0 0 0.3rem 1.2rem!important;display:block!important;}}'
  ].join('\n');
  document.head.appendChild(style);

  function enhanceBlogNav() {
    var nav = document.querySelector('nav.site-nav');
    if (!nav || nav.querySelector('.nav-dropdown')) return;
    var links = nav.querySelectorAll('.site-nav-links > li > a');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href');
      var active = a.className.indexOf('active') !== -1;
      var linkIsBoom = active && (href === '/blog/boom/' || href === '/blog/boom');
      var linkIsMatt = active && (href === '/blog/matt/' || href === '/blog/matt');
      if (linkIsBoom || linkIsMatt) {
        var li = a.parentNode;
        li.className = (li.className ? li.className + ' ' : '') + 'has-dropdown';
        var ul = document.createElement('ul');
        ul.className = 'nav-dropdown';
        ul.innerHTML = linkIsBoom
          ? '<li><a href="/blog/matt/">\uD83C\uDF3F Forest Temple</a></li>'
          : '<li><a href="/blog/boom/">\u26A1 Boom Frequency</a></li>';
        li.appendChild(ul);
        break;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceBlogNav);
  } else {
    enhanceBlogNav();
  }
})();

(function () {
  'use strict';

  var STORAGE_KEY = 'voa_announce_dismissed_v1';

  if (localStorage.getItem(STORAGE_KEY)) return;

  // Blog pages (Boom + Forest Temple) use premium green; other pages use gold
  var onBlog = /\/blog\//.test(window.location.pathname);
  var bc     = onBlog ? '#22c06a' : '#D4AF37';
  var bcRgb  = onBlog ? '34,192,106' : '212,175,55';

  var css = [
    '#voa-announce{',
      'position:fixed;top:0;left:0;width:100%;z-index:99999;',
      'background:linear-gradient(90deg,rgba(10,22,24,0.97),rgba(6,15,16,0.97));',
      'border-bottom:1px solid rgba(' + bcRgb + ',0.3);',
      'padding:0.55rem 1rem;',
      'display:flex;align-items:center;justify-content:center;gap:0.75rem;flex-wrap:wrap;',
      'font-family:"Poppins","Space Grotesk",sans-serif;font-size:0.78rem;',
      'box-shadow:0 2px 16px rgba(0,0,0,0.4);',
      'transform:translateY(-100%);transition:transform 0.35s ease;',
    '}',
    '#voa-announce.visible{transform:translateY(0);}',
    'body.voa-announce-open{transition:padding-top 0.35s ease;}',
    '#voa-announce .ann-text{color:rgba(232,244,240,0.82);letter-spacing:0.01em;}',
    '#voa-announce .ann-text strong{color:' + bc + ';}',
    '#voa-announce .ann-link{',
      'background:' + bc + ';color:#020a0a;',
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
    '@media(min-width:769px){#voa-announce{display:none!important;}}',
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

    // Animate in after short delay. Being position:fixed, the bar doesn't
    // reserve space in normal flow ~ on mobile (the only width it renders at)
    // it would otherwise slide down on top of the site header. Push the page
    // down by the bar's actual rendered height instead of overlapping it.
    function applyBodySpacing() {
      var bar = document.getElementById('voa-announce');
      if (!bar || window.innerWidth >= 769) return;
      document.body.classList.add('voa-announce-open');
      document.body.style.paddingTop = bar.offsetHeight + 'px';
    }

    setTimeout(function () {
      var bar = document.getElementById('voa-announce');
      if (bar) bar.classList.add('visible');
      applyBodySpacing();
    }, 800);

    window.addEventListener('resize', applyBodySpacing);

    document.getElementById('voa-announce-close').addEventListener('click', function () {
      var bar = document.getElementById('voa-announce');
      document.body.classList.remove('voa-announce-open');
      document.body.style.paddingTop = '';
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
