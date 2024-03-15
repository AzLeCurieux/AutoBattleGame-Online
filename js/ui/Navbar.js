/**
 * Navbar Component
 * Injects a consistent, minimalist navigation bar into the page.
 */
class Navbar {
    constructor() {
        this.init();
    }

    init() {
        // Remove existing topbar if present (to avoid duplicates during transition)
        const existingTopbar = document.getElementById('topbar');
        if (existingTopbar) {
            existingTopbar.remove();
        }

        // Remove existing nav-buttons-container (gambling page specific)
        const navButtons = document.querySelector('.nav-buttons-container');
        if (navButtons) {
            navButtons.remove();
        }

        // Remove existing back buttons (deck/inventory specific)
        const backButtons = document.querySelectorAll('.back-button');
        backButtons.forEach(btn => btn.remove());

        // Create the navbar element
        const navbar = document.createElement('header');
        navbar.id = 'topbar';
        navbar.className = 'topbar';

        // Determine active page for highlighting
        const path = window.location.pathname;
        const isHome = path === '/' || path === '/index.html';
        const isGambling = path.includes('/gambling');
        const isInventory = path.includes('/inventory');

        navbar.innerHTML = `
            <div class="topbar-left">
                <div class="brand" onclick="window.location.href='/'" style="cursor: pointer;">JeuDéKaré</div>
            </div>
            <div class="topbar-center">
                <div class="topbar-icon-btn ${isGambling ? 'active' : ''}" id="gambling-btn-wrapper">
                    <button id="gambling-btn" class="icon-btn" title="Ouvrir les caisses" onclick="window.location.href='/gambling'">
                        🎰
                    </button>
                    <span class="icon-btn-label">Gambling</span>
                </div>
                <div class="topbar-icon-btn ${isInventory ? 'active' : ''}" id="inventory-btn-wrapper">
                    <button id="inventory-btn" class="icon-btn" title="Voir mon inventaire" onclick="window.location.href='/inventory'">
                        📦
                    </button>
                    <span class="icon-btn-label">Inventaire</span>
                </div>
            </div>
            <div class="topbar-right">
                ${isHome ? '<div id="user-info"><!-- Rempli par OnlineManager --></div>' : ''}
            </div>
        `;

        // Insert at the beginning of the body or specific container
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.insertBefore(navbar, gameUI.firstChild);
        } else {
            document.body.insertBefore(navbar, document.body.firstChild);
        }

        // Add padding to body to prevent content from being hidden behind fixed navbar
        // Only if not already handled by specific page layouts
        if (!document.getElementById('game-ui')) {
            document.body.style.paddingTop = '80px';
        }
    }
}

// Initialize Navbar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Navbar();
});
