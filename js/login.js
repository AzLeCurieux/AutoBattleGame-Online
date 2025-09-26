class LoginManager {
  constructor() {
    this.currentForm = 'login';
    this.selectedAvatar = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkExistingAuth();
  }

  setupEventListeners() {
    // Login form
    document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
    document.getElementById('register-btn').addEventListener('click', () => this.showRegisterForm());

    // Register form
    document.getElementById('register-submit-btn').addEventListener('click', () => this.handleRegister());
    document.getElementById('back-to-login-btn').addEventListener('click', () => this.showLoginForm());

    // Form switching
    document.getElementById('switch-to-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterForm();
    });

    document.getElementById('back-to-login-from-avatar').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginForm();
    });

    // Avatar selection
    document.getElementById('select-avatar-btn').addEventListener('click', () => this.handleAvatarSelection());

    // Avatar options
    document.querySelectorAll('.avatar-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedAvatar = option.dataset.avatar;
        document.getElementById('select-avatar-btn').disabled = false;
      });
    });

    // Enter key support
    document.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (this.currentForm === 'login') {
          this.handleLogin();
        } else if (this.currentForm === 'register') {
          this.handleRegister();
        } else if (this.currentForm === 'avatar') {
          this.handleAvatarSelection();
        }
      }
    });
  }

  checkExistingAuth() {
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.validateToken(token);
    }
  }

  async validateToken(token) {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // Token is valid, redirect to game
        this.redirectToGame();
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('auth_token');
    }
  }

  showLoginForm() {
    this.currentForm = 'login';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('avatar-selection').style.display = 'none';
    this.hideMessages();
  }

  showRegisterForm() {
    this.currentForm = 'register';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('avatar-selection').style.display = 'none';
    this.hideMessages();
  }

  showAvatarSelection() {
    this.currentForm = 'avatar';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('avatar-selection').style.display = 'block';
    this.hideMessages();
  }

  async handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      this.showError('Veuillez remplir tous les champs');
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('auth_token', data.data.token);
        this.redirectToGame();
      } else {
        this.showError(data.message);
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('Erreur de connexion au serveur');
    } finally {
      this.showLoading(false);
    }
  }

  async handleRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!username || !password) {
      this.showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (password.length < 6) {
      this.showError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    this.showLoading(true);
    const submitBtn = document.getElementById('register-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      // Graceful handling of non-JSON and rate limit
      if (!response.ok) {
        let message = `Erreur serveur (${response.status})`;
        try {
          const text = await response.text();
          if (text) message = text;
        } catch (_) {}
        if (response.status === 429) {
          message = 'Trop de tentatives. Réessayez dans 1 minute.';
        }
        this.showError(message);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        this.showError('Réponse invalide du serveur');
        return;
      }

      if (data.success) {
        localStorage.setItem('auth_token', data.data.token);
        this.showAvatarSelection();
      } else {
        this.showError(data.message || 'Inscription échouée');
      }
    } catch (error) {
      console.error('Register error:', error);
      this.showError("Erreur d'inscription");
    } finally {
      this.showLoading(false);
      if (submitBtn) setTimeout(() => (submitBtn.disabled = false), 1500);
    }
  }

  async handleAvatarSelection() {
    if (!this.selectedAvatar) {
      this.showError('Veuillez sélectionner un avatar');
      return;
    }

    this.showLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar: this.selectedAvatar })
      });

      const data = await response.json();

      if (data.success) {
        this.redirectToGame();
      } else {
        this.showError(data.message);
      }
    } catch (error) {
      console.error('Avatar selection error:', error);
      this.showError('Erreur de sélection d\'avatar');
    } finally {
      this.showLoading(false);
    }
  }

  redirectToGame() {
    window.location.href = '/';
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('success-message').style.display = 'none';
  }

  showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
  }

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }

  hideMessages() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
  }
}

// Initialize login manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  new LoginManager();
});

