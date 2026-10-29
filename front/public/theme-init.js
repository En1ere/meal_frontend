(() => {
    const themes = new Set(['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark']);
    try {
        const savedTheme = localStorage.getItem('meal-theme');
        if (savedTheme && themes.has(savedTheme)) document.documentElement.dataset.theme = savedTheme;
    } catch {
        // Storage can be unavailable in hardened browser contexts. Keep the server default.
    }
})();
