/**
 * KMA PRINTWORKS - Theme Manager (Dark & Light)
 * Persists user preference via localStorage across all pages.
 * Supports origin-based circular ripple transition from the button click.
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
                updateThemeUI('light', false);
            });
        }
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('kma_theme') || 'dark';
    applyTheme(currentTheme, false);
});

function applyTheme(theme, animateIcon = true) {
    const isLight = theme === 'light';
    if (isLight) {
        document.body.classList.add('light-theme');
        document.documentElement.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.documentElement.classList.remove('light-theme');
    }
    localStorage.setItem('kma_theme', theme);
    updateThemeUI(theme, animateIcon);
}

function updateThemeUI(theme, animateIcon = false) {
    const isLight = theme === 'light';
    const btnIcon = document.getElementById('themeToggleIcon');
    const btn = document.getElementById('themeToggleBtn');
    
    if (btnIcon) {
        if (animateIcon) {
            btnIcon.style.transition = 'transform 0.15s ease';
            btnIcon.style.transform = 'scale(0.5) rotate(45deg)';
            setTimeout(() => {
                btnIcon.innerText = isLight ? '🌙' : '☀️';
                btnIcon.style.transform = 'scale(1) rotate(0deg)';
            }, 120);
        } else {
            btnIcon.innerText = isLight ? '🌙' : '☀️';
        }
    }
    
    if (btn) {
        btn.setAttribute('title', isLight ? 'Ganti ke Dark Mode' : 'Ganti ke Light Mode');
    }
}

function toggleTheme(event) {
    const currentTheme = localStorage.getItem('kma_theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Fallback if View Transitions API is not supported in the browser
    if (!document.startViewTransition) {
        applyTheme(newTheme, true);
        return;
    }

    // Determine origin coordinates (x, y) from the clicked button or event
    let x = window.innerWidth - 30;
    let y = 30;

    if (event && (event.clientX !== undefined && event.clientY !== undefined)) {
        x = event.clientX;
        y = event.clientY;
    } else {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            const rect = btn.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
    }

    // Calculate radius to the furthest viewport corner from (x, y)
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
        applyTheme(newTheme, true);
    });

    transition.ready.then(() => {
        const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
        ];

        document.documentElement.animate(
            {
                clipPath: clipPath
            },
            {
                duration: 480,
                easing: 'cubic-bezier(0.2, 0, 0, 1)',
                pseudoElement: '::view-transition-new(root)'
            }
        );
    });
}
