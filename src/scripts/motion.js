// Dependency-free motion. Respects prefers-reduced-motion. All progressive enhancement:
// the site is fully readable with JS off (content is in the HTML).
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Scroll reveal (blur-fade in) */
function reveals() {
  const els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
  );
  els.forEach((el) => io.observe(el));
}

/* Count-up numbers. <span data-count="70" data-suffix="%"> */
function counters() {
  const els = document.querySelectorAll('[data-count]');
  const run = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (reduce) {
      el.textContent = prefix + target.toFixed(dec) + suffix;
      return;
    }
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (target * eased).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) {
    els.forEach(run);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  els.forEach((el) => io.observe(el));
}

/* Magic-card spotlight follows the pointer */
function magicCards() {
  if (reduce) return;
  document.querySelectorAll('.mcard').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* Scroll-aware header + reading progress bar */
function scrollChrome() {
  const head = document.querySelector('.site-head');
  const bar = document.querySelector('.read-bar');
  const article = document.querySelector('[data-article]');
  const onScroll = () => {
    if (head) head.classList.toggle('is-scrolled', window.scrollY > 8);
    if (bar && article) {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const done = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      bar.style.width = `${(done / Math.max(total, 1)) * 100}%`;
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* TOC scrollspy */
function toc() {
  const links = document.querySelectorAll('.toc a[href^="#"]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map();
  links.forEach((l) => {
    const id = decodeURIComponent(l.getAttribute('href').slice(1));
    const sec = document.getElementById(id);
    if (sec) map.set(sec, l);
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-active'));
          const active = map.get(e.target);
          if (active) active.classList.add('is-active');
        }
      });
    },
    { rootMargin: '-10% 0px -70% 0px' }
  );
  map.forEach((_, sec) => io.observe(sec));
}

/* Mobile menu: the hamburger toggles the primary nav as a dropdown.
   Progressive enhancement, the links are reachable with JS off (the header
   bar wraps on small screens). */
function navMenu() {
  const btn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    set(btn.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !btn.contains(e.target)) set(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 720) set(false); });
}

const init = () => {
  reveals();
  counters();
  magicCards();
  scrollChrome();
  toc();
  navMenu();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
