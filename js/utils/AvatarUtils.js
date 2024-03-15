/**
 * AvatarUtils.js
 * Gestion centralisée des avatars utilisateurs
 */

class AvatarUtils {
    static getAvatarUrl(avatar, username) {
        // 1. Si c'est une URL valide (http ou data), on l'utilise
        if (avatar && (avatar.startsWith('http') || avatar.startsWith('data:'))) {
            return avatar;
        }

        // 2. Génération d'un avatar par défaut (Lettre sur fond neutre)
        // Couleur de fond neutre (gris foncé)
        const color = '#333333'; 
        
        const str = username || 'User';
        const letter = str.charAt(0).toUpperCase();

        // Création du SVG
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="55" font-family="Arial, sans-serif" font-weight="bold" font-size="50" fill="white" text-anchor="middle" dy=".3em">${letter}</text></svg>`;
        
        // Encodage en Base64 pour éviter les problèmes de guillemets dans le HTML
        return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
    }
}

// Export global pour utilisation directe dans les autres fichiers
window.AvatarUtils = AvatarUtils;


