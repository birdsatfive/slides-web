/**
 * Slide tagging for shared HTML.
 *
 * The viewer's comments panel files each comment under the slide the framed
 * page last announced with a `slide-change` postMessage. Decks we build do
 * that themselves; most uploads never did, so every comment on them landed in
 * one untagged pile. This script is added to every HTML document the share
 * routes serve and announces the slide on the deck's behalf.
 *
 * It reads the current slide off the page rather than off any one framework:
 * among the top-level `.slide` / `[data-page]` / `.baf-slide` / reveal.js
 * sections, the one marked active, else the one filling most of the viewport.
 * The id is the slide's `data-page`, else its position, so it matches the
 * number the deck prints. A page with fewer than two slides, or whose
 * "slides" are too small to be the page (a carousel inside a site), announces
 * nothing, and its comments stay deck-wide.
 */
const SLIDE_BRIDGE = `(function(){
  if (window.parent === window) return;
  var SEL = "[data-page],.slide,.baf-slide,.reveal .slides>section";
  var ACTIVE = ".is-active,.active,.present,.current,[aria-current=true],[aria-current=page]";
  var last = null, timer = 0;
  function slides(){
    var all = document.querySelectorAll(SEL), out = [];
    for (var k = 0; k < all.length; k++) {
      var p = all[k].parentElement;
      if (!p || !p.closest(SEL)) out.push(all[k]);
    }
    return out;
  }
  function onScreen(el){
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return 0;
    var r = el.getBoundingClientRect();
    var w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    var h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function current(list){
    var marked = list.filter(function(el){ return el.matches(ACTIVE); });
    if (marked.length === 1) return marked[0];
    var best = null, most = 0;
    list.forEach(function(el){ var a = onScreen(el); if (a > most) { most = a; best = el; } });
    return best;
  }
  function check(){
    timer = 0;
    var list = slides();
    if (list.length < 2) return;
    var el = current(list);
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.5 && r.height < innerHeight * 0.5) return;
    var n = list.indexOf(el) + 1;
    var id = el.getAttribute("data-page") || String(n);
    if (id === last) return;
    last = id;
    try { window.parent.postMessage({ type: "slide-change", slide: parseInt(id, 10) || n, slide_id: id }, "*"); } catch (e) {}
  }
  function soon(){ if (!timer) timer = setTimeout(check, 150); }
  if (window.MutationObserver) new MutationObserver(soon).observe(document.documentElement,
    { subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-current"] });
  ["hashchange", "resize", "load"].forEach(function(t){ window.addEventListener(t, soon); });
  ["scroll", "transitionend", "animationend"].forEach(function(t){
    document.addEventListener(t, soon, { capture: true, passive: true });
  });
  check();
})();`;

/**
 * Add the bridge before the closing body tag. A document that already posts
 * `slide-change` knows its own numbering better, so it is left alone.
 */
export function withSlideBridge(html: string): string {
  if (html.includes("slide-change")) return html;
  const tag = `<script data-share-bridge>${SLIDE_BRIDGE}</script>`;
  const at = html.toLowerCase().lastIndexOf("</body>");
  return at < 0 ? html + tag : html.slice(0, at) + tag + html.slice(at);
}
