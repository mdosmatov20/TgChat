/* Выбор дизайна (Liquid Glass, 10 вариантов). Хранится в localStorage под ключом dc_design. */
(function () {
  'use strict';
  const KEY = 'dc_design', DEFAULT = 'aurora';
  const root = document.documentElement;
  const btn = document.getElementById('designBtn');
  const menu = document.getElementById('designMenu');
  if (!btn || !menu) return;
  const opts = Array.from(menu.querySelectorAll('.opt'));
  const valid = opts.map((o) => o.dataset.design);

  function setOpen(o) { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); }
  function apply(name, save) {
    if (!valid.includes(name)) name = DEFAULT;
    if (name === DEFAULT) root.removeAttribute('data-design'); else root.setAttribute('data-design', name);
    opts.forEach((o) => o.setAttribute('aria-checked', String(o.dataset.design === name)));
    if (save) { try { localStorage.setItem(KEY, name); } catch (e) {} }
  }

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  apply(saved || DEFAULT, false);

  btn.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
  opts.forEach((o) => o.addEventListener('click', () => { apply(o.dataset.design, true); setOpen(false); }));
  // capture-фаза: другие меню вызывают stopPropagation, но это меню всё равно должно закрыться
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target !== btn) setOpen(false); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
})();
