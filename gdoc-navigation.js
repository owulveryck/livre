(function() {
  'use strict';

  // Index de recherche global
  let searchIndex = null;
  let indexLoading = false;

  // Charger l'index JSON au démarrage
  async function loadSearchIndex() {
    if (searchIndex !== null) return searchIndex;
    if (indexLoading) return null;

    indexLoading = true;
    try {
      const response = await fetch('search-index.json');
      if (!response.ok) {
        console.warn('Index de recherche non disponible');
        return null;
      }
      searchIndex = await response.json();
      console.log(`Index de recherche chargé : ${searchIndex.length} chapitres`);
      return searchIndex;
    } catch (error) {
      console.error('Erreur chargement index de recherche:', error);
      return null;
    } finally {
      indexLoading = false;
    }
  }

  // Fonction de recherche
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const mainContent = document.getElementById('main-content');

  if (searchInput && searchResults && mainContent) {
    let searchTimeout;

    searchInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim().toLowerCase();

      if (query.length < 2) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('show');
        return;
      }

      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 300);
    });

    async function performSearch(query) {
      const results = [];

      // 1. Recherche GLOBALE dans l'index (autres chapitres)
      const index = await loadSearchIndex();
      if (index) {
        index.forEach(chapter => {
          const content = chapter.content.toLowerCase();
          if (content.includes(query.toLowerCase())) {
            // Extraire un snippet autour du match
            const snippet = getSnippet(chapter.content, query);
            results.push({
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              chapterPart: chapter.part,
              chapterUrl: chapter.url,
              snippet: snippet,
              isGlobal: true  // Flag pour résultat global
            });
          }
        });
      }

      // 2. Recherche LOCALE dans le chapitre actuel
      const searchableElements = mainContent.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');

      searchableElements.forEach((element, index) => {
        const text = element.textContent.toLowerCase();
        if (text.includes(query)) {
          const snippet = getSnippet(element.textContent, query);
          results.push({
            element: element,
            snippet: snippet,
            index: index,
            isGlobal: false  // Résultat local
          });
        }
      });

      // 3. Trier : résultats locaux en premier, puis globaux
      results.sort((a, b) => {
        if (a.isGlobal === b.isGlobal) return 0;
        return a.isGlobal ? 1 : -1;
      });

      displayResults(results, query);
    }

    function getSnippet(text, query) {
      const maxLength = 150;
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(query.toLowerCase());

      if (index === -1) return text.substring(0, maxLength) + '...';

      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + query.length + 100);

      let snippet = text.substring(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';

      return snippet;
    }

    function displayResults(results, query) {
      if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">Aucun résultat trouvé</div>';
        searchResults.classList.add('show');
        return;
      }

      const maxResults = 20;  // Augmenté pour résultats globaux
      let html = `<div class="search-count">${results.length} résultat${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}</div>`;

      // Séparer résultats locaux et globaux
      const localResults = results.filter(r => !r.isGlobal);
      const globalResults = results.filter(r => r.isGlobal);

      // Afficher résultats locaux (chapitre actuel)
      if (localResults.length > 0) {
        html += '<div class="search-section-header">Dans ce chapitre</div>';
        localResults.slice(0, 5).forEach((result) => {
          const highlightedSnippet = highlightQuery(result.snippet, query);
          html += `
            <div class="search-result search-result-local" data-index="${result.index}">
              <div class="search-snippet">${highlightedSnippet}</div>
            </div>
          `;
        });
      }

      // Afficher résultats globaux (autres chapitres)
      if (globalResults.length > 0) {
        html += '<div class="search-section-header">Dans le livre</div>';
        globalResults.slice(0, 15).forEach((result) => {
          const highlightedSnippet = highlightQuery(result.snippet, query);
          html += `
            <div class="search-result search-result-global" data-url="${result.chapterUrl}">
              <div class="search-chapter-info">
                ${result.chapterPart ? `<span class="search-part">${result.chapterPart}</span> › ` : ''}
                <span class="search-chapter">${result.chapterTitle}</span>
              </div>
              <div class="search-snippet">${highlightedSnippet}</div>
            </div>
          `;
        });
      }

      if (results.length > maxResults) {
        html += `<div class="search-more">... et ${results.length - maxResults} autres résultats</div>`;
      }

      searchResults.innerHTML = html;
      searchResults.classList.add('show');

      // Gestionnaires de clic

      // Résultats locaux : scroll vers l'élément
      searchResults.querySelectorAll('.search-result-local').forEach(resultDiv => {
        resultDiv.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          const element = document.querySelectorAll('#main-content p, #main-content h1, #main-content h2, #main-content h3, #main-content h4, #main-content blockquote, #main-content li')[index];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('search-highlight');
            setTimeout(() => element.classList.remove('search-highlight'), 2000);
          }
          searchResults.classList.remove('show');
          searchInput.value = '';
        });
      });

      // Résultats globaux : navigation vers le chapitre
      searchResults.querySelectorAll('.search-result-global').forEach(resultDiv => {
        resultDiv.addEventListener('click', function() {
          const url = this.dataset.url;
          window.location.href = url;
        });
      });
    }

    function highlightQuery(text, query) {
      const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
      return text.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Fermer les résultats si clic en dehors
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.remove('show');
      }
    });
  }


  // ===============================================
  // THEME MANAGEMENT
  // ===============================================

  const THEME_KEY = 'gdoc-theme';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    // Load saved theme or detect system preference
    let savedTheme = loadThemePreference();
    if (!savedTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      savedTheme = prefersDark ? THEME_DARK : THEME_LIGHT;
    }

    applyTheme(savedTheme);

    // Toggle on button click
    themeToggle.addEventListener('click', function() {
      const currentTheme = document.body.classList.contains('dark-theme') ? THEME_DARK : THEME_LIGHT;
      const newTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
      applyTheme(newTheme);
      saveThemePreference(newTheme);
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!loadThemePreference()) {
        applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
      }
    });
  }

  function applyTheme(theme) {
    if (theme === THEME_DARK) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  function saveThemePreference(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.warn('Cannot save theme preference:', e);
    }
  }

  function loadThemePreference() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      console.warn('Cannot load theme preference:', e);
      return null;
    }
  }

  // ===============================================
  // FONT SIZE CONTROLS
  // ===============================================

  const FONT_SIZE_KEY = 'gdoc-font-size';
  const FONT_SIZE_MIN = 10;
  const FONT_SIZE_MAX = 18;
  const FONT_SIZE_DEFAULT = 12;
  const FONT_SIZE_STEP = 1;

  function initFontControls() {
    const fontIncrease = document.getElementById('font-increase');
    const fontDecrease = document.getElementById('font-decrease');
    const fontReset = document.getElementById('font-reset');

    if (!fontIncrease || !fontDecrease || !fontReset) return;

    // Load saved font size
    let fontSize = loadFontSize();
    applyFontSize(fontSize);

    fontIncrease.addEventListener('click', function() {
      if (fontSize < FONT_SIZE_MAX) {
        fontSize += FONT_SIZE_STEP;
        applyFontSize(fontSize);
        saveFontSize(fontSize);
      }
    });

    fontDecrease.addEventListener('click', function() {
      if (fontSize > FONT_SIZE_MIN) {
        fontSize -= FONT_SIZE_STEP;
        applyFontSize(fontSize);
        saveFontSize(fontSize);
      }
    });

    fontReset.addEventListener('click', function() {
      fontSize = FONT_SIZE_DEFAULT;
      applyFontSize(fontSize);
      saveFontSize(fontSize);
    });
  }

  function applyFontSize(size) {
    document.documentElement.style.setProperty('--font-size-base', size + 'pt');
    document.documentElement.style.setProperty('--font-size-h1', (size * 2) + 'pt');
    document.documentElement.style.setProperty('--font-size-h2', (size * 1.5) + 'pt');
    document.documentElement.style.setProperty('--font-size-h3', (size * 1.17) + 'pt');
    document.documentElement.style.setProperty('--font-size-code', (size * 0.83) + 'pt');
  }

  function saveFontSize(size) {
    try {
      localStorage.setItem(FONT_SIZE_KEY, size);
    } catch (e) {
      console.warn('Cannot save font size:', e);
    }
  }

  function loadFontSize() {
    try {
      const saved = localStorage.getItem(FONT_SIZE_KEY);
      return saved ? parseInt(saved) : FONT_SIZE_DEFAULT;
    } catch (e) {
      console.warn('Cannot load font size:', e);
      return FONT_SIZE_DEFAULT;
    }
  }

  // ===============================================
  // SIDEBAR MANAGEMENT
  // ===============================================

  function initSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('book-sidebar');

    if (!sidebarToggle || !sidebar) return;

    // Toggle on button click
    sidebarToggle.addEventListener('click', function() {
      document.body.classList.toggle('sidebar-open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
          document.body.classList.remove('sidebar-open');
        }
      }
    });

    // Initialize part collapse/expand
    initPartCollapse();

    // Mark current chapter
    markCurrentChapter();
  }

  function initPartCollapse() {
    const parts = document.querySelectorAll('.sidebar-toc .toc-part');

    parts.forEach(part => {
      part.addEventListener('click', function() {
        this.classList.toggle('collapsed');
      });
    });
  }

  function markCurrentChapter() {
    const currentFile = window.location.pathname.split('/').pop();
    const tocItems = document.querySelectorAll('.sidebar-toc .toc-item');

    tocItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === currentFile) {
        item.classList.add('current');
      }
    });
  }

  // ===============================================
  // CHAPTER OUTLINE GENERATION
  // ===============================================

  function generateChapterOutline() {
    const mainContent = document.getElementById('main-content');
    const outlineContainer = document.getElementById('chapter-outline');

    if (!mainContent || !outlineContainer) return;

    // Find all H2 and H3 headings
    const headings = mainContent.querySelectorAll('h2, h3');

    if (headings.length === 0) {
      outlineContainer.style.display = 'none';
      return;
    }

    // Generate outline HTML
    let outlineHTML = '<div class="outline-header">Dans ce chapitre</div>';

    headings.forEach((heading, index) => {
      const level = heading.tagName.toLowerCase() === 'h2' ? 2 : 3;
      const text = heading.textContent;
      const id = heading.id || 'heading-' + index;

      // Add ID if not present
      if (!heading.id) {
        heading.id = id;
      }

      outlineHTML += `
        <a href="#${id}" class="outline-item level-${level}" data-heading-id="${id}">
          ${text}
        </a>
      `;
    });

    outlineContainer.innerHTML = outlineHTML;

    // Add click handlers for smooth scrolling
    outlineContainer.querySelectorAll('.outline-item').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('data-heading-id');
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Close sidebar on mobile
          if (window.innerWidth <= 768) {
            document.body.classList.remove('sidebar-open');
          }
        }
      });
    });
  }

  // ===============================================
  // SCROLL SPY
  // ===============================================

  let scrollSpyTimeout;

  function initScrollSpy() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Throttled scroll handler
    window.addEventListener('scroll', function() {
      clearTimeout(scrollSpyTimeout);
      scrollSpyTimeout = setTimeout(updateScrollSpy, 100);
    }, { passive: true });

    // Initial update
    updateScrollSpy();
  }

  function updateScrollSpy() {
    const headings = document.querySelectorAll('#main-content h2, #main-content h3');
    const outlineItems = document.querySelectorAll('.outline-item');

    if (headings.length === 0 || outlineItems.length === 0) return;

    // Find currently visible heading
    let activeHeading = null;
    const scrollPosition = window.scrollY + 100; // Offset for navbar

    headings.forEach(heading => {
      const headingTop = heading.offsetTop;
      if (headingTop <= scrollPosition) {
        activeHeading = heading;
      }
    });

    // Update outline highlighting
    outlineItems.forEach(item => {
      item.classList.remove('active');
      if (activeHeading && item.getAttribute('data-heading-id') === activeHeading.id) {
        item.classList.add('active');
      }
    });
  }

  // ===============================================
  // READING PROGRESS BAR
  // ===============================================

  let progressTimeout;

  function initProgressBar() {
    const progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;

    window.addEventListener('scroll', function() {
      clearTimeout(progressTimeout);
      progressTimeout = setTimeout(updateProgressBar, 50);
    }, { passive: true });

    // Initial update
    updateProgressBar();
  }

  function updateProgressBar() {
    const progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    const scrollableDistance = documentHeight - windowHeight;
    const progress = scrollableDistance > 0 ? (scrollTop / scrollableDistance) * 100 : 0;

    progressBar.style.width = Math.min(progress, 100) + '%';
  }

  // ===============================================
  // KEYBOARD SHORTCUTS
  // ===============================================

  // Extend existing keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Existing: Ctrl+K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.focus();
    }

    // NEW: 'd' for dark mode toggle
    if (e.key === 'd' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) themeToggle.click();
    }

    // NEW: 's' for sidebar toggle (mobile)
    if (e.key === 's' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        document.body.classList.toggle('sidebar-open');
      }
    }

    // Escape closes everything
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('search-input');
      const searchResults = document.getElementById('search-results');

      if (searchInput) {
        searchInput.value = '';
        searchInput.blur();
      }
      if (searchResults) {
        searchResults.classList.remove('show');
      }
      if (window.innerWidth <= 768) {
        document.body.classList.remove('sidebar-open');
      }
    }
  });

  // ===============================================
  // INITIALIZATION
  // ===============================================

  // Charger l'index de recherche au démarrage de la page
  document.addEventListener('DOMContentLoaded', function() {
    // Load search index (existing)
    loadSearchIndex().then(() => {
      console.log('Index de recherche prêt');
    });

    // Initialize new features
    initTheme();
    initFontControls();
    initSidebar();
    generateChapterOutline();
    initScrollSpy();
    initProgressBar();
  });
})();
