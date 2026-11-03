/**
 * KMA PRINTWORKS - Theme Manager (Dark & Light)
 * Persists user preference via localStorage across all pages.
 */

(function() {
    // Instant execution to prevent theme flickering (FOUC)
    const savedTheme = localStorage.getItem('kma_theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        if (document.body) {
            document.body.classList.add('light-theme');
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                document.body.classList.add('light-theme');
                updateThemeUI('light');
            });
        }
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('kma_theme') || 'dark';
    applyTheme(currentTheme);
});

function applyTheme(theme) {
    const isLight = theme === 'light';
    if (isLight) {
        document.body.classList.add('light-theme');
        document.documentElement.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.documentElement.classList.remove('light-theme');
    }
    localStorage.setItem('kma_theme', theme);
    updateThemeUI(theme);
}

function updateThemeUI(theme) {
    const isLight = theme === 'light';
    const btnIcon = document.getElementById('themeToggleIcon');
    const btnText = document.getElementById('themeToggleText');
    if (btnIcon && btnText) {
        btnIcon.innerText = isLight ? '🌙' : '☀️';
        btnText.innerText = isLight ? 'Dark Mode' : 'Light Mode';
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('kma_theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}
