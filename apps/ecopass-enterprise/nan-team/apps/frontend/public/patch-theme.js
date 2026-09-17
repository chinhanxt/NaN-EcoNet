// Clean, robust theme synchronization, buttery-smooth transition & anti-flicker patcher
(function() {
  'use strict';

  // 1. Instant Theme Synchronization
  function getDesiredMode() {
    try {
      var match = document.cookie.match(/(?:^|;\s*)mode=([^;]+)/);
      if (match && (match[1] === 'dark' || match[1] === 'light')) {
        return match[1];
      }
      var stored = localStorage.getItem('mode');
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch(e) {}
    return 'light';
  }

  function syncHtmlWithBody(mode) {
    var root = document.documentElement;
    if (!root) return;

    if (mode === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    // Clear inline styles so stylesheet rules control background smoothly
    if (root.style.backgroundColor) root.style.backgroundColor = '';
    if (root.style.color) root.style.color = '';
    if (document.body) {
      if (document.body.style.backgroundColor) document.body.style.backgroundColor = '';
      if (document.body.style.color) document.body.style.color = '';
    }
  }

  function initTheme() {
    var mode = getDesiredMode();
    syncHtmlWithBody(mode);
    if (document.body && !document.body.classList.contains(mode)) {
      document.body.classList.remove('dark', 'light');
      document.body.classList.add(mode);
    }
  }

  initTheme();

  // 2. Observe Body Class Changes (When user clicks the toggle in UI)
  function setupBodyObserver() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', setupBodyObserver);
      return;
    }

    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === 'class') {
          var isDark = document.body.classList.contains('dark');
          var isLight = document.body.classList.contains('light');
          var activeMode = isDark ? 'dark' : (isLight ? 'light' : null);

          if (activeMode) {
            syncHtmlWithBody(activeMode);
            // Persist to cookie and localStorage
            document.cookie = 'mode=' + activeMode + '; Path=/; Max-Age=31536000; SameSite=Lax';
            try {
              localStorage.setItem('mode', activeMode);
            } catch(e) {}
          }
        }
      }
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  setupBodyObserver();

  // 3. Widen & Beautify Sidebar
  function applySidebarStyles() {
    var leftMenu = document.getElementById('left-menu');
    if (leftMenu) {
      leftMenu.style.width = '82px';
      leftMenu.style.left = '20px';
      
      var parent = leftMenu.parentElement;
      if (parent) {
        parent.style.width = '98px';
        parent.style.borderRadius = '26px';
        parent.style.boxShadow = '0 10px 32px -5px rgba(0, 0, 0, 0.12)';
        
        var mainPanel = parent.nextElementSibling;
        if (mainPanel) {
          mainPanel.style.borderRadius = '12px';
        }
      }
    }
  }

  // 4. Spinner Styling (Emerald Theme)
  function patchSpinners() {
    document.querySelectorAll('div[style*="animation: spin"], div[style*="border-top-color"]').forEach(function(el) {
      if (el.dataset.spinnerPatched) return;
      el.dataset.spinnerPatched = 'true';
      el.style.borderTopColor = '#10B981';
      el.style.borderColor = 'rgba(16, 185, 129, 0.15)';
    });
  }

  // 5. Setup layout enhancements
  function patchEnhancements() {
    applySidebarStyles();
    patchSpinners();
    patchTransitions();
  }

  // 6. Smooth Page Transition & Fluid Navigation (Zero-flicker)
  function patchTransitions() {
    var mainPanel = document.querySelector('.blurMe');
    if (mainPanel && !mainPanel.dataset.transitionInit) {
      mainPanel.dataset.transitionInit = 'true';
      mainPanel.classList.add('enterprise-page-enter');
    }
  }

  window.addEventListener('popstate', function() {
    var mainPanel = document.querySelector('.blurMe');
    if (mainPanel) {
      mainPanel.classList.remove('enterprise-page-enter');
      void mainPanel.offsetWidth;
      mainPanel.classList.add('enterprise-page-enter');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchEnhancements);
  } else {
    patchEnhancements();
  }

  setTimeout(patchEnhancements, 150);
  setTimeout(patchEnhancements, 600);
  setTimeout(patchEnhancements, 1500);
})();
