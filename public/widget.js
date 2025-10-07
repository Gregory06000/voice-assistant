/* public/widget.js */
(function () {
  if (window.__VocalShopLoaded) return;
  window.__VocalShopLoaded = true;

  var current = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var src = current && current.src ? current.src : '';
  var base;
  try { base = new URL(src).origin; } catch (e) { base = window.location.origin; }

  // ⚙️ paramètres personnalisables
  var catalog = current && current.getAttribute('data-catalog'); // URL JSON produits
  var theme   = current && current.getAttribute('data-theme');   // (facultatif)
  var welcome = current && current.getAttribute('data-welcome'); // message d’accueil
  var width   = current && current.getAttribute('data-width')  || '400';
  var height  = current && current.getAttribute('data-height') || '600';

  var params  = [];
  if (catalog) params.push('catalog=' + encodeURIComponent(catalog));
  if (theme)   params.push('theme='   + encodeURIComponent(theme));
  if (welcome) params.push('welcome=' + encodeURIComponent(welcome));
  var qs = params.length ? ('?' + params.join('&')) : '';

  // 🔵 bouton lanceur
  var launcher = document.createElement('button');
  launcher.id = 'vocalshop-launcher';
  launcher.type = 'button';
  launcher.style.position     = 'fixed';
  launcher.style.right        = '20px';
  launcher.style.bottom       = '20px';
  launcher.style.width        = '56px';
  launcher.style.height       = '56px';
  launcher.style.borderRadius = '999px';
  launcher.style.border       = 'none';
  launcher.style.background   = '#0ea5e9';
  launcher.style.color        = '#fff';
  launcher.style.fontSize     = '24px';
  launcher.style.fontWeight   = '700';
  launcher.style.cursor       = 'pointer';
  launcher.style.boxShadow    = '0 10px 25px rgba(0,0,0,0.22)';
  launcher.style.zIndex       = '2147483647';
  launcher.style.display      = 'inline-flex';
  launcher.style.alignItems   = 'center';
  launcher.style.justifyContent = 'center';
  launcher.style.lineHeight   = '1';
  launcher.title = 'Open voice assistant';
  launcher.textContent = '🎤';
  document.body.appendChild(launcher);

  // 🪟 conteneur + en-tête + iframe (caché au départ)
  var container = document.createElement('div');
  container.id = 'vocalshop-widget';
  container.style.position     = 'fixed';
  container.style.right        = '20px';
  container.style.bottom       = '90px';
  container.style.zIndex       = '2147483647';
  container.style.width        = width + 'px';
  container.style.height       = height + 'px';
  container.style.boxShadow    = '0 12px 32px rgba(0,0,0,0.25)';
  container.style.borderRadius = '16px';
  container.style.overflow     = 'hidden';
  container.style.background   = 'transparent';
  container.style.display      = 'none';
  document.body.appendChild(container);

  var header = document.createElement('div');
  header.style.height        = '40px';
  header.style.background    = '#0ea5e9';
  header.style.color         = '#fff';
  header.style.display       = 'flex';
  header.style.alignItems    = 'center';
  header.style.justifyContent= 'space-between';
  header.style.fontFamily    = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  header.style.padding       = '0 10px';
  header.textContent         = 'Voice Assistant';
  container.appendChild(header);

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.cursor = 'pointer';
  header.appendChild(closeBtn);

  var frameWrap = document.createElement('div');
  frameWrap.style.width  = '100%';
  frameWrap.style.height = 'calc(100% - 40px)';
  container.appendChild(frameWrap);

  var iframe = document.createElement('iframe');
  iframe.src = base + '/widget' + qs;  // ✅ on passe catalog/welcome/theme à la page /widget
  iframe.title = 'Voice commerce assistant';
  iframe.style.border = 'none';
  iframe.style.width  = '100%';
  iframe.style.height = '100%';
  iframe.style.display= 'block';
  iframe.allow = 'microphone; autoplay; clipboard-read; clipboard-write';
  frameWrap.appendChild(iframe);

  function openWidget()  { container.style.display = 'block'; launcher.style.transform = 'scale(0.95)'; }
  function closeWidget() { container.style.display = 'none';  launcher.style.transform = 'scale(1)'; }

  launcher.addEventListener('click', function () {
    var isOpen = container.style.display !== 'none';
    if (isOpen) closeWidget(); else openWidget();
  });
  closeBtn.addEventListener('click', closeWidget);

  var autoOpen = current && current.getAttribute('data-open');
  if (autoOpen === 'true') openWidget();
})();
