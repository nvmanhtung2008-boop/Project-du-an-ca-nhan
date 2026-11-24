/**
 * Hà Nội Phố Vị - Quản lý Giao Diện Sáng/Tối & Độ Sáng Màn Hình
 * Đồng bộ liên trang (index.html & games.html) và đa tab via localStorage.
 */
(function () {
  'use strict';

  var THEME_KEY = 'hanoi_phovi_theme_v1';
  var BRIGHTNESS_KEY = 'hanoi_phovi_brightness_v1';
  var MIN_BRIGHTNESS = 60;
  var MAX_BRIGHTNESS = 120;
  var DEFAULT_BRIGHTNESS = 100;

  function clampBrightness(val) {
    if (val === '' || val === null || val === undefined) return DEFAULT_BRIGHTNESS;
    var n = Math.round(Number(val));
    if (isNaN(n) || !isFinite(n)) return DEFAULT_BRIGHTNESS;
    if (n < MIN_BRIGHTNESS) return MIN_BRIGHTNESS;
    if (n > MAX_BRIGHTNESS) return MAX_BRIGHTNESS;
    return n;
  }

  function getSavedTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return 'light';
  }

  function getSavedBrightness() {
    try {
      var raw = localStorage.getItem(BRIGHTNESS_KEY);
      if (raw !== null && raw !== '') return clampBrightness(raw);
    } catch (e) {}
    return DEFAULT_BRIGHTNESS;
  }

  function ensureOverlay() {
    var overlay = document.getElementById('screenBrightnessOverlay');
    if (!overlay && document.body) {
      overlay = document.createElement('div');
      overlay.id = 'screenBrightnessOverlay';
      overlay.className = 'screen-brightness-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function updateThemeButtonUI(theme) {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    var isDark = theme === 'dark';
    var icon = isDark ? '☀️' : '🌙';
    var label = isDark ? 'Sáng' : 'Tối';
    var fullTitle = isDark
      ? 'Đang ở chế độ Tối Đông Dương — bấm để chuyển sang chế độ Sáng'
      : 'Đang ở chế độ Sáng Giấy Cổ — bấm để chuyển sang chế độ Tối';

    btn.innerHTML = '<span>' + icon + '</span> <span>' + label + '</span>';
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.setAttribute('title', fullTitle);
    btn.setAttribute('aria-label', fullTitle);
    btn.classList.toggle('is-dark', isDark);
  }

  function applyBrightnessVisual(val) {
    var b = clampBrightness(val);
    document.documentElement.dataset.brightness = String(b);

    var overlay = ensureOverlay();
    if (overlay) {
      var theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      var supportsBackdrop = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' &&
        (CSS.supports('backdrop-filter', 'brightness(1)') || CSS.supports('-webkit-backdrop-filter', 'brightness(1)'));

      if (b === 100) {
        overlay.style.backgroundColor = 'transparent';
        overlay.style.opacity = '0';
        overlay.style.mixBlendMode = 'normal';
        overlay.style.backdropFilter = 'none';
        overlay.style.webkitBackdropFilter = 'none';
      } else if (supportsBackdrop) {
        var factor = (b / 100).toFixed(2);
        overlay.style.backgroundColor = 'transparent';
        overlay.style.mixBlendMode = 'normal';
        overlay.style.opacity = '1';
        overlay.style.backdropFilter = 'brightness(' + factor + ')';
        overlay.style.webkitBackdropFilter = 'brightness(' + factor + ')';
      } else if (b < 100) {
        // Fallback giảm độ sáng mượt 60%..99% bằng lớp phủ tối pointer-events: none
        var darkAlpha = ((100 - b) / 100) * 1.12;
        if (darkAlpha > 0.52) darkAlpha = 0.52;
        overlay.style.backdropFilter = 'none';
        overlay.style.webkitBackdropFilter = 'none';
        overlay.style.mixBlendMode = 'normal';
        overlay.style.backgroundColor = 'rgba(8, 6, 4, ' + darkAlpha.toFixed(3) + ')';
        overlay.style.opacity = '1';
      } else {
        // Fallback tăng độ sáng 101%..120%
        var ratio = (b - 100) / (MAX_BRIGHTNESS - 100);
        overlay.style.backdropFilter = 'none';
        overlay.style.webkitBackdropFilter = 'none';
        if (theme === 'dark') {
          overlay.style.mixBlendMode = 'screen';
          overlay.style.backgroundColor = 'rgba(255, 248, 232, ' + (ratio * 0.14).toFixed(3) + ')';
        } else {
          overlay.style.mixBlendMode = 'soft-light';
          overlay.style.backgroundColor = 'rgba(255, 253, 245, ' + (ratio * 0.48).toFixed(3) + ')';
        }
        overlay.style.opacity = '1';
      }
    }

    var slider = document.getElementById('brightnessSlider');
    if (slider && Number(slider.value) !== b) {
      slider.value = String(b);
    }

    var valLabel = document.getElementById('brightnessValLabel');
    if (valLabel) valLabel.textContent = b + '%';

    var badge = document.getElementById('brightnessBtnBadge');
    if (badge) badge.textContent = b + '%';

    var presetBtns = document.querySelectorAll('[data-brightness-preset]');
    for (var i = 0; i < presetBtns.length; i++) {
      var p = Number(presetBtns[i].getAttribute('data-brightness-preset'));
      presetBtns[i].classList.toggle('active', p === b);
    }
  }

  function setTheme(theme, persist) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;

    if (persist !== false) {
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
    }

    updateThemeButtonUI(next);
    applyBrightnessVisual(getSavedBrightnessFromDom());

    try {
      window.dispatchEvent(new CustomEvent('hn-theme-changed', { detail: { theme: next } }));
    } catch (e) {}
    return next;
  }

  function getSavedBrightnessFromDom() {
    var raw = document.documentElement.dataset.brightness;
    if (raw) return clampBrightness(raw);
    return getSavedBrightness();
  }

  function setBrightness(val, persist) {
    var next = clampBrightness(val);
    if (persist !== false) {
      try {
        localStorage.setItem(BRIGHTNESS_KEY, String(next));
      } catch (e) {}
    }
    applyBrightnessVisual(next);
    return next;
  }

  function toggleTheme() {
    var current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    return setTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  function resetBrightness() {
    return setBrightness(DEFAULT_BRIGHTNESS, true);
  }

  function closeBrightnessPopover() {
    var pop = document.getElementById('brightnessPopover');
    var btn = document.getElementById('btnBrightnessControl');
    if (pop) {
      pop.classList.remove('open');
      pop.setAttribute('hidden', '');
    }
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('active');
    }
  }

  function openBrightnessPopover() {
    var pop = document.getElementById('brightnessPopover');
    var btn = document.getElementById('btnBrightnessControl');
    if (!pop) return;
    pop.removeAttribute('hidden');
    pop.classList.add('open');
    if (btn) {
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('active');
    }
  }

  function initThemeControls() {
    ensureOverlay();

    var initialTheme = getSavedTheme();
    var initialBrightness = getSavedBrightness();
    setTheme(initialTheme, false);
    setBrightness(initialBrightness, false);

    var themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn && !themeBtn.dataset.boundTheme) {
      themeBtn.dataset.boundTheme = '1';
      themeBtn.addEventListener('click', function () {
        toggleTheme();
      });
    }

    var brightBtn = document.getElementById('btnBrightnessControl');
    var pop = document.getElementById('brightnessPopover');
    if (brightBtn && pop && !brightBtn.dataset.boundBright) {
      brightBtn.dataset.boundBright = '1';
      brightBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (pop.classList.contains('open')) {
          closeBrightnessPopover();
        } else {
          openBrightnessPopover();
        }
      });

      pop.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    var slider = document.getElementById('brightnessSlider');
    if (slider && !slider.dataset.boundBright) {
      slider.dataset.boundBright = '1';
      slider.addEventListener('input', function () {
        setBrightness(slider.value, true);
      });
      slider.addEventListener('change', function () {
        setBrightness(slider.value, true);
      });
    }

    var presets = document.querySelectorAll('[data-brightness-preset]');
    for (var i = 0; i < presets.length; i++) {
      (function (btnEl) {
        if (btnEl.dataset.boundPreset) return;
        btnEl.dataset.boundPreset = '1';
        btnEl.addEventListener('click', function () {
          setBrightness(btnEl.getAttribute('data-brightness-preset'), true);
        });
      })(presets[i]);
    }

    var resetBtn = document.getElementById('btnResetBrightness');
    if (resetBtn && !resetBtn.dataset.boundReset) {
      resetBtn.dataset.boundReset = '1';
      resetBtn.addEventListener('click', function () {
        resetBrightness();
      });
    }

    document.addEventListener('click', function (e) {
      var wrap = document.getElementById('brightnessControlWrap');
      if (wrap && !wrap.contains(e.target)) {
        closeBrightnessPopover();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeBrightnessPopover();
      }
    });
  }

  window.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY) {
      setTheme(e.newValue === 'dark' ? 'dark' : 'light', false);
    } else if (e.key === BRIGHTNESS_KEY) {
      setBrightness(e.newValue !== null && e.newValue !== '' ? e.newValue : DEFAULT_BRIGHTNESS, false);
    }
  });

  if (document.getElementById('themeToggleBtn') || document.readyState !== 'loading') {
    initThemeControls();
  } else {
    document.addEventListener('DOMContentLoaded', initThemeControls);
  }

  window.HNTheme = {
    getTheme: function () {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    },
    setTheme: function (theme) {
      return setTheme(theme, true);
    },
    toggleTheme: toggleTheme,
    getBrightness: getSavedBrightnessFromDom,
    setBrightness: function (val) {
      return setBrightness(val, true);
    },
    resetBrightness: resetBrightness
  };
})();
