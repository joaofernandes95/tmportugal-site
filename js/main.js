/* ===== TMPortugal — interactions ===== */
(function () {
  'use strict';

  /* =======================================================================
     CONFIGURATION — fill these in to enable Web3Forms + live Google reviews.
     Leave empty to keep the offline fallbacks (mailto + recovered reviews).
     ======================================================================= */
  var CONFIG = {
    // Web3Forms: free access key from https://web3forms.com (emailed to you).
    WEB3FORMS_ACCESS_KEY: '087e0b81-3cf2-490f-9b4a-e72901ae5537',

    // Live Google reviews via Places API (New): https://console.cloud.google.com
    // Enable "Places API (New)", create an API key RESTRICTED to your domain.
    GOOGLE_PLACES_API_KEY: '',           // e.g. 'AIza....'
    GOOGLE_PLACE_ID: '',                 // the business Place ID, e.g. 'ChIJ....'

    MAIL_TO: 'geral@tmportugal.com'
  };

  /* ---- Current year in footer ---- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Logo scrolls to top (only when already on the homepage) ---- */
  var brand = document.querySelector('.brand[href="#top"]');
  if (brand) {
    brand.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (history.replaceState) history.replaceState(null, '', location.pathname);
    });
  }

  /* ---- Mobile navigation ---- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* =======================================================================
     REVIEWS SLIDER — rebuildable so live Google data can replace the markup
     ======================================================================= */
  var sliderState = null;

  function setupSlider() {
    var track = document.getElementById('reviewsTrack');
    var dotsWrap = document.getElementById('reviewsDots');
    var slider = document.getElementById('reviewsSlider');
    if (!track || !slider) return;

    if (sliderState && sliderState.timer) clearInterval(sliderState.timer);
    dotsWrap.innerHTML = '';

    var slides = track.children;
    var total = slides.length;
    var index = 0;
    var timer;

    for (var i = 0; i < total; i++) {
      var b = document.createElement('button');
      b.setAttribute('aria-label', 'Ir para opinião ' + (i + 1));
      (function (n) { b.addEventListener('click', function () { go(n); restart(); }); })(i);
      dotsWrap.appendChild(b);
    }
    var dots = dotsWrap.children;

    function go(n) {
      index = (n + total) % total;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('active', d === index);
    }
    function next() { go(index + 1); }
    function prev() { go(index - 1); }
    function restart() { clearInterval(timer); timer = setInterval(next, 6000); }

    slider.querySelector('.slider-next').onclick = function () { next(); restart(); };
    slider.querySelector('.slider-prev').onclick = function () { prev(); restart(); };

    go(0);
    restart();
    slider.onmouseenter = function () { clearInterval(timer); };
    slider.onmouseleave = restart;

    sliderState = { timer: timer };
  }

  setupSlider();

  /* ---- Live Google reviews (Places API New) ---- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  }
  function starRow(n) {
    n = Math.round(n || 5);
    return new Array(Math.max(0, n) + 1).join('★') + new Array(Math.max(0, 5 - n) + 1).join('☆');
  }

  function loadGoogleReviews() {
    if (!CONFIG.GOOGLE_PLACES_API_KEY || !CONFIG.GOOGLE_PLACE_ID) return; // keep fallback

    var url = 'https://places.googleapis.com/v1/places/' + encodeURIComponent(CONFIG.GOOGLE_PLACE_ID);
    fetch(url, {
      headers: {
        'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'displayName,rating,userRatingCount,googleMapsUri,reviews'
      }
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var reviews = (data && data.reviews) || [];
        if (!reviews.length) return;

        // update summary
        var ratingNum = document.querySelector('#opinioes .rating-num');
        var ratingMeta = document.querySelector('#opinioes .rating-meta');
        if (ratingNum && data.rating) ratingNum.textContent = data.rating.toFixed(1);
        if (ratingMeta && data.userRatingCount) {
          ratingMeta.textContent = 'Com base em ' + data.userRatingCount + ' críticas no Google';
        }

        // rebuild slides
        var track = document.getElementById('reviewsTrack');
        track.innerHTML = reviews.map(function (rv) {
          var author = (rv.authorAttribution && rv.authorAttribution.displayName) || 'Cliente Google';
          var text = (rv.text && rv.text.text) || (rv.originalText && rv.originalText.text) || '';
          var when = rv.relativePublishTimeDescription || '';
          return '<li class="review">' +
            '<div class="review-stars">' + starRow(rv.rating) + '</div>' +
            '<p class="review-text">' + esc(text) + '</p>' +
            '<div class="review-author"><span class="avatar">' + esc(initials(author)) + '</span> ' +
            esc(author) + (when ? ' <span class="review-when">· ' + esc(when) + '</span>' : '') +
            '</div></li>';
        }).join('');

        setupSlider();
      })
      .catch(function (err) {
        // silently keep the recovered fallback reviews
        if (window.console) console.warn('Google reviews indisponíveis, a usar fallback:', err);
      });
  }
  loadGoogleReviews();

  /* =======================================================================
     reCAPTCHA — explicit render, one widget per form
     ======================================================================= */
  var captchaReady = false;
  window.grecaptchaInit = function () {
    captchaReady = true;
    document.querySelectorAll('.g-recaptcha').forEach(function (el) {
      if (el.dataset.widgetId) return;
      try {
        el.dataset.widgetId = window.grecaptcha.render(el, { sitekey: el.getAttribute('data-sitekey') });
      } catch (e) { /* already rendered */ }
    });
  };
  function captchaResponse(form) {
    var el = form.querySelector('.g-recaptcha');
    if (!el || !captchaReady || !window.grecaptcha || el.dataset.widgetId === undefined) return null;
    return window.grecaptcha.getResponse(el.dataset.widgetId);
  }
  function captchaReset(form) {
    var el = form.querySelector('.g-recaptcha');
    if (el && captchaReady && window.grecaptcha && el.dataset.widgetId !== undefined) {
      window.grecaptcha.reset(el.dataset.widgetId);
    }
  }

  /* =======================================================================
     FORMS — Web3Forms (fetch) with mailto fallback
     ======================================================================= */
  function val(form, name) {
    var el = form.elements[name];
    return el ? el.value.trim() : '';
  }
  function markInvalid(form) {
    var ok = true;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var empty = !el.value.trim();
      var badEmail = el.type === 'email' && el.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
      var bad = empty || badEmail;
      el.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    return ok;
  }

  function handleForm(formId, statusId, subjectPrefix, buildBody) {
    var form = document.getElementById(formId);
    var status = document.getElementById(statusId);
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';

      // 1) honeypot
      if (val(form, 'website')) { return; }

      // 2) required fields
      if (!markInvalid(form)) {
        status.textContent = 'Por favor preencha os campos obrigatórios corretamente.';
        status.classList.add('err');
        return;
      }

      // 3) reCAPTCHA (null = widget unavailable, e.g. offline preview -> allow)
      var token = captchaResponse(form);
      if (token === '') {
        status.textContent = 'Por favor confirme que não é um robô.';
        status.classList.add('err');
        return;
      }

      var subject = subjectPrefix + ' — ' + val(form, 'name');

      // ---- Preferred path: Web3Forms ----
      if (CONFIG.WEB3FORMS_ACCESS_KEY) {
        var payload = {
          access_key: CONFIG.WEB3FORMS_ACCESS_KEY,
          subject: subject,
          from_name: 'Site TMPortugal',
          name: val(form, 'name'),
          email: val(form, 'email'),
          phone: val(form, 'phone'),
          service: val(form, 'service'),
          message: buildBody(form),
          botcheck: ''
        };

        if (btn) { btn.disabled = true; }
        status.textContent = 'A enviar…';

        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.success) {
              status.textContent = 'Mensagem enviada com sucesso. Obrigado — entraremos em contacto!';
              status.classList.add('ok');
              form.reset();
              captchaReset(form);
            } else {
              status.textContent = 'Não foi possível enviar: ' + (data.message || 'tente novamente.');
              status.classList.add('err');
            }
          })
          .catch(function () {
            status.textContent = 'Erro de ligação. Tente novamente ou envie email para ' + CONFIG.MAIL_TO + '.';
            status.classList.add('err');
          })
          .finally(function () { if (btn) { btn.disabled = false; } });
        return;
      }

      // ---- Fallback path: mailto ----
      var href = 'mailto:' + CONFIG.MAIL_TO +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(buildBody(form));
      window.location.href = href;
      status.textContent = 'Abrimos o seu email para enviar a mensagem a ' + CONFIG.MAIL_TO + '.';
      status.classList.add('ok');
      form.reset();
      captchaReset(form);
    });
  }

  handleForm('quoteForm', 'quoteStatus', 'Pedido de orçamento', function (f) {
    return 'Nome: ' + val(f, 'name') +
      '\nEmail: ' + val(f, 'email') +
      '\nTelefone: ' + val(f, 'phone') +
      '\nServiço: ' + val(f, 'service') +
      '\n\nDescrição:\n' + val(f, 'message');
  });

  handleForm('contactForm', 'contactStatus', 'Contacto pelo site', function (f) {
    return 'Nome: ' + val(f, 'name') +
      '\nEmail: ' + val(f, 'email') +
      '\n\nMensagem:\n' + val(f, 'message');
  });

})();
