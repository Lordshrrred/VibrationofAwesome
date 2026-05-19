/**
 * voa-nav.js — VOA unified AI Engine nav injector
 *
 * Ensures the "AI Engine" link appears in every nav bar across the site,
 * regardless of which nav pattern the page uses. Safe to load on every page:
 * exits immediately if the link is already present.
 *
 * Load with defer before </body> or in <head>.
 * To update nav contents site-wide, edit only this file.
 */
(function () {
  // ── Styles injected once ────────────────────────────────────────────────
  var CSS = [
    '.voa-ai-engine-link {',
    '  font-family: Rajdhani, sans-serif;',
    '  font-size: 0.8rem;',
    '  font-weight: 600;',
    '  letter-spacing: 0.1em;',
    '  text-transform: uppercase;',
    '  text-decoration: none;',
    '  color: rgba(0,229,204,0.8);',
    '  border: 1px solid rgba(0,229,204,0.2);',
    '  border-radius: 4px;',
    '  padding: 0.28rem 0.62rem;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.3rem;',
    '  background: rgba(0,229,204,0.04);',
    '  transition: color 0.2s, background 0.2s, border-color 0.2s;',
    '  white-space: nowrap;',
    '}',
    '.voa-ai-engine-link:hover {',
    '  color: #00e5cc;',
    '  background: rgba(0,229,204,0.09);',
    '  border-color: rgba(0,229,204,0.38);',
    '}',
    '.voa-ai-engine-link svg {',
    '  width: 10px; height: 10px; flex-shrink: 0; opacity: 0.82;',
    '  animation: voa-hex-pulse 4s ease-in-out infinite;',
    '}',
    '@keyframes voa-hex-pulse {',
    '  0%,100% { opacity: 0.7; }',
    '  50%      { opacity: 1; }',
    '}',
    // Wrapper li for list-based navs
    'li.voa-ai-engine-li { list-style: none; display: flex; align-items: center; }',
    // Separator spacing when link is inline (no li wrapper)
    'a.voa-ai-engine-link { margin-left: 0.25rem; }',
    // Site-nav variant (boom/matt blog posts)
    '.site-nav-links .voa-ai-engine-link { font-size: 0.75rem; padding: 0.2rem 0.5rem; }',
  ].join('\n');

  var HEX_SVG = [
    '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true">',
    '<polygon points="6,0.8 10.4,3.3 10.4,8.5 6,11 1.6,8.5 1.6,3.3"',
    ' stroke="currentColor" stroke-width="0.9"/>',
    '<circle cx="6" cy="5.9" r="1.3" fill="currentColor"/>',
    '<line x1="6" y1="0.8" x2="6" y2="3.2"',
    ' stroke="currentColor" stroke-width="0.7" opacity="0.6"/>',
    '</svg>',
  ].join('');

  var LINK_HTML = '<a href="/ai-engine/" class="voa-ai-engine-link">AI Engine ' + HEX_SVG + '</a>';

  // ── Guard: exit if AI Engine is already in the page ────────────────────
  function alreadyPresent() {
    return !!document.querySelector('a[href="/ai-engine/"], a[href*="/ai-engine/"]');
  }

  // ── Create the link element ─────────────────────────────────────────────
  function makeLink() {
    var a = document.createElement('a');
    a.href = '/ai-engine/';
    a.className = 'voa-ai-engine-link';
    a.setAttribute('aria-label', 'AI Engine');
    a.innerHTML = 'AI Engine ' + HEX_SVG;
    return a;
  }

  function makeLi(link) {
    var li = document.createElement('li');
    li.className = 'voa-ai-engine-li';
    li.appendChild(link);
    return li;
  }

  // ── Inject into a <ul>-based nav (standard list nav) ───────────────────
  function injectIntoList(ul) {
    // Try to insert after the Field Guide li
    var items = ul.querySelectorAll('li');
    var afterEl = null;
    for (var i = 0; i < items.length; i++) {
      var a = items[i].querySelector('a');
      if (a && (a.href.indexOf('/field-guide/') !== -1 || a.textContent.indexOf('Field Guide') !== -1)) {
        afterEl = items[i];
        break;
      }
    }
    var li = makeLi(makeLink());
    if (afterEl) {
      afterEl.parentNode.insertBefore(li, afterEl.nextSibling);
    } else {
      // No field guide link — prepend
      ul.insertBefore(li, ul.firstChild);
    }
  }

  // ── Inject into a flex/inline nav (no <ul>, just anchors in a div) ─────
  function injectInline(container) {
    var links = container.querySelectorAll('a');
    var afterEl = null;
    for (var i = 0; i < links.length; i++) {
      if (links[i].href.indexOf('/field-guide/') !== -1 ||
          links[i].textContent.indexOf('Field Guide') !== -1) {
        afterEl = links[i];
        break;
      }
    }
    var newLink = makeLink();
    if (afterEl) {
      afterEl.parentNode.insertBefore(newLink, afterEl.nextSibling);
    } else {
      // Append to end of container
      container.appendChild(newLink);
    }
  }

  // ── Main injection logic ────────────────────────────────────────────────
  function inject() {
    if (alreadyPresent()) return;

    // Inject styles
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Strategy 1: standard .nav-links ul (baseof, art-store)
    var navLinksUl = document.querySelector('ul.nav-links, ul#navLinks');
    if (navLinksUl) { injectIntoList(navLinksUl); return; }

    // Strategy 2: .site-nav-links ul (boom/matt blog posts)
    var siteNavUl = document.querySelector('ul.site-nav-links, ul#siteNavLinks');
    if (siteNavUl) { injectIntoList(siteNavUl); return; }

    // Strategy 3: nav with a <ul> inside (contact, portfolio, privacy, terms)
    var navUl = document.querySelector('#mainNav ul, nav ul');
    if (navUl) { injectIntoList(navUl); return; }

    // Strategy 4: .nav-right flex container (earthstar, aura)
    var navRight = document.querySelector('.nav-right');
    if (navRight) { injectInline(navRight); return; }

    // Strategy 5: .top-nav flex container (field-guide, user-manual)
    var topNav = document.querySelector('.top-nav');
    if (topNav) { injectInline(topNav); return; }

    // Strategy 6: site-header .container (newer blog posts)
    var headerContainer = document.querySelector('.site-header .container, header.site-header');
    if (headerContainer) {
      // Add after the header-blog-name span or at the end
      var navEl = headerContainer.querySelector('.header-nav');
      if (navEl) { injectInline(navEl); return; }
      // Fallback: insert before the last child
      headerContainer.appendChild(makeLink());
      return;
    }

    // Strategy 7: first <nav> found — last resort
    var firstNav = document.querySelector('nav');
    if (firstNav) { injectInline(firstNav); }
  }

  // ── Run when DOM is ready ───────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
