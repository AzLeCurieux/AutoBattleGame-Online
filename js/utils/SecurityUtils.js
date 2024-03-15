/**
 * Security Utilities
 * Fonctions pour prévenir XSS et autres attaques
 */

/**
 * Échappe les caractères HTML dangereux pour prévenir XSS
 * @param {string} text - Texte à échapper
 * @returns {string} Texte échappé safe pour innerHTML
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return text;
    }

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize user input pour affichage safe
 * @param {string} input - Input utilisateur
 * @returns {string} Input sanitizé
 */
function sanitizeUserInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    return escapeHtml(input.trim());
}

/**
 * Crée un élément avec du texte échappé
 * Alternative sûre à innerHTML
 * @param {string} tag - Tag HTML (div, span, p, etc.)
 * @param {string} text - Texte à afficher
 * @param {string} className - Classes CSS optionnelles
 * @returns {HTMLElement}
 */
function createSafeElement(tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text; // textContent est safe par défaut
    if (className) {
        element.className = className;
    }
    return element;
}

/**
 * Insère du HTML de manière sûre en échappant le contenu dynamique
 * @param {HTMLElement} container - Élément conteneur
 * @param {string} template - Template HTML avec placeholders ${...}
 * @param {Object} data - Données à insérer (seront échappées)
 */
function setSafeHTML(container, template, data = {}) {
    let safeHTML = template;

    // Remplacer chaque placeholder par la valeur échappée
    for (const [key, value] of Object.entries(data)) {
        const placeholder = `\${${key}}`;
        safeHTML = safeHTML.replace(new RegExp(placeholder, 'g'), escapeHtml(value));
    }

    container.innerHTML = safeHTML;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        sanitizeUserInput,
        createSafeElement,
        setSafeHTML
    };
}
