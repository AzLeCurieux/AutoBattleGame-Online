/**
 * Global Preloader Manager
 * Shows loading screen ONLY if page takes longer than threshold to load
 */

class PreloaderManager {
    constructor() {
        this.preloader = null;
        this.minDisplayTime = 500; // Minimum 500ms display if shown
        this.showThreshold = 300; // Only show if loading takes > 300ms
        this.startTime = Date.now();
        this.isShowing = false;
        this.init();
    }

    init() {
        // Wait for body to exist
        if (!document.body) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                // Retry in next tick
                setTimeout(() => this.init(), 10);
            }
            return;
        }

        this.setup();
    }

    setup() {
        // Check if page already loaded quickly
        if (document.readyState === 'complete') {
            const loadTime = Date.now() - this.startTime;
            if (loadTime < this.showThreshold) {
                // Page loaded fast, no loader needed
                console.log(`⚡ Page loaded in ${loadTime}ms - no loader needed`);
                return;
            }
        }

        // Show loader after threshold if not loaded yet
        this.showTimeout = setTimeout(() => {
            if (document.readyState !== 'complete') {
                console.log(`⏳ Page taking >${this.showThreshold}ms, showing loader...`);
                this.show();
            }
        }, this.showThreshold);

        // Hide when loaded
        if (document.readyState === 'complete') {
            this.hide();
        } else {
            window.addEventListener('load', () => this.hide());
        }
    }

    show() {
        if (this.isShowing || !document.body) return;

        this.isShowing = true;
        document.body.classList.add('loading');

        // Create preloader
        if (!document.querySelector('.preloader')) {
            const html = `
                <div class="preloader">
                    <div class="crack crack1"></div>
                    <div class="crack crack2"></div>
                    <div class="crack crack3"></div>
                    <div class="crack crack4"></div>
                    <div class="crack crack5"></div>
                </div>
            `;
            document.body.insertAdjacentHTML('afterbegin', html);
        }

        this.preloader = document.querySelector('.preloader');
    }

    hide() {
        clearTimeout(this.showTimeout);

        if (!this.isShowing) {
            // Never showed, just finish
            return;
        }

        const elapsed = Date.now() - this.startTime;
        const displayTime = elapsed - this.showThreshold;
        const remaining = Math.max(0, this.minDisplayTime - displayTime);

        setTimeout(() => {
            if (this.preloader) {
                this.preloader.classList.add('hidden');
                if (document.body) {
                    document.body.classList.remove('loading');
                }

                // Remove from DOM after transition
                setTimeout(() => {
                    if (this.preloader && this.preloader.parentNode) {
                        this.preloader.remove();
                    }
                }, 500);
            }
        }, remaining);
    }
}

// Auto-initialize when script loads (will wait for body)
window.preloaderManager = new PreloaderManager();
