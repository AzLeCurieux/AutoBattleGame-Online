class OnlineManager {
  constructor() {
    this.socket = null;
    this.isAuthenticated = false;
    this.user = null;
    this.sessionId = null;
    this.securityToken = null;
    this.runId = null;
    this.leaderboard = [];
    this.onlinePlayers = [];
    this.sessionPassives = { passiveUpgrades: [], bossPassives: [] };
    this.recordNotificationShown = false; // Flag pour éviter les notifications répétées

    // Ne pas s'initialiser automatiquement sur la page gambling
    if (!window.GAMBLING_PAGE) {
      this.init();
    }
  }

  async init() {
    // Check if user is already authenticated
    const token = localStorage.getItem('auth_token'); // Changed from 'token' to 'auth_token'
    if (token) {
      // User has a token, try to authenticate
      await this.authenticateWithToken(token);
    } else {
      // Redirect to login page if not authenticated (sauf sur gambling)
      if (!window.GAMBLING_PAGE) {
        window.location.href = '/login';
      }
    }
  }

  // Initialize Socket.io connection
  connectSocket() {
    this.socket = io();

    this.socket.on('connect', () => {
      // Get token from localStorage with correct key
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.socket.emit('authenticate', { token });
      }
    });

    this.socket.on('authenticated', async (data) => {
      this.isAuthenticated = true;
      this.user = { ...this.user, ...data };
      this.updateUI();

      // Initialize server-side game client (ACTIVÉ - 100% serveur)
      if (typeof ServerGameClient !== 'undefined') {
        this.serverGameClient = new ServerGameClient(this);
        if (data.sessionId && data.gameState) {
          this.serverGameClient.initializeGameSession(data.sessionId, data.gameState);
        }
      } else {
        console.warn('⚠️ ServerGameClient n\'est pas défini');
      }

      // Initialize server validator (validation en arrière-plan)
      this.serverValidator = new ServerValidator(this);
      this.serverValidator.activate();
      this.serverValidator.startPeriodicValidation();

      // Load initial leaderboard and force update
      await this.loadInitialLeaderboard();

      // Request fresh leaderboard from server via socket after a short delay
      setTimeout(() => {
        this.socket.emit('request_leaderboard_update');
      }, 1000);

      // Charger l'inventaire de caisses (lié à l'utilisateur, persistant)
      if (window.lootBoxSystem) {
        await window.lootBoxSystem.loadInventory();
      }

      // Start game session immediately after authentication
      // Utiliser uniquement le socket pour créer la session (plus fiable)
      this.socket.emit('start_game_session', {});
    });

    this.socket.on('auth_error', (error) => {
      console.error('Authentication error:', error);
      // Redirect to login page on auth error
      window.location.href = '/login';
    });

    // Écouter l'événement de rafraîchissement forcé (connexion multiple)
    this.socket.on('force_refresh', (data) => {
      console.warn('🔄 Rafraîchissement forcé:', data.message);
      // Afficher un message à l'utilisateur
      alert(data.message || 'Une nouvelle session a été ouverte. Cette page va se rafraîchir.');
      // Forcer le rafraîchissement immédiat
      window.location.reload();
    });

    this.socket.on('leaderboard_update', (data) => {
      this.leaderboard = data.leaderboard;
      this.updateLeaderboard();
    });

    this.socket.on('online_players_update', (data) => {
      this.onlinePlayers = data.players;
      this.updateOnlinePlayers();
    });

    // Écouter les changements d'état de jeu (fight lancé depuis une autre fenêtre)
    this.socket.on('game_state_changed', (data) => {
      // Pas de synchronisation - chaque session est indépendante
      console.log('🔄 État de jeu changé (synchronisation désactivée)');
    });

    this.socket.on('game_result', (result) => {
      console.log('Game result:', result);
      // Handle game results
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (error.message && error.message.includes('Score submission failed')) {
        console.log('Score submission error ignored to prevent spam');
        return;
      }
      this.showError(error.message);
    });

    this.socket.on('new_record', (data) => {
      this.showNewRecordNotification(data);
    });

    this.socket.on('score_submitted', (result) => {
      // Score soumis silencieusement
    });

    this.socket.on('session_passives', (data) => {
      this.onSessionPassivesReceived(data);
    });

    this.socket.on('game_session_started', (data) => {
      this.sessionId = data.sessionId;
      this.securityToken = data.securityToken;
      this.runId = data.runId;
      console.log('✅ Session créée:', this.sessionId);

      // Validate deck for anti-cheat
      this.validateCurrentDeck();

      // Mettre à jour le niveau actuel maintenant que la session est disponible
      if (window.game && window.game.level) {
        const currentLevel = window.game.level.getLevel();
        const currentGold = window.game.player ? window.game.player.getGold() : 0;
        this.updateCurrentLevel(currentLevel, currentGold);
      }

      // Pas de restauration des passifs - chaque session démarre au niveau de base
    });

    // Handle deck validation result
    this.socket.on('deck_validation_result', (data) => {
      if (!data.valid) {
        // SILENT: Only log to console, no popup
        console.warn('⚠️ Deck validation failed:', data.reason);

        // Clear invalid deck silently
        if (window.cardSystem) {
          window.cardSystem.clearDeck();
        }
      } else {
        console.log('✅ Deck validé côté serveur');
      }
    });

    // Détection de rafraîchissement de page (DÉSACTIVÉ - pas de restauration)
    this.socket.on('game_restored', (data) => {
      // Pas de restauration - chaque session démarre au niveau de base
      console.log('🔄 Nouvelle session - démarrage au niveau de base');
    });

    this.socket.on('warning', (data) => {
      console.warn('Security warning:', data);
      this.showWarning(data.message, data.type);
    });

    this.socket.on('user_banned', (data) => {
      console.error('User banned:', data);
      this.showBanMessage(data.message, data.duration);
    });

    // Removed cheat_detected handler - no user messages

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isAuthenticated = false;
    });
  }




  // Ensure connection is active (called when user performs action like fighting)
  ensureConnection() {
    if (!this.socket) {
      console.log('🔌 Socket not initialized, connecting...');
      this.connectSocket();
      return;
    }

    if (!this.socket.connected) {
      console.log('🔌 Socket disconnected, reconnecting...');
      this.socket.connect();
      return;
    }

    // If connected, emit a heartbeat/activity signal to ensure server knows we're here
    // Requesting leaderboard update is a good way to say "I'm active" without a dedicated heartbeat event
    this.socket.emit('request_leaderboard_update');
  }

  // Authenticate with existing token
  async authenticateWithToken(token) {
    try {
      console.log('Authenticating with token:', token.substring(0, 20) + '...');

      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });


      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        this.user = { ...data.data, token };
        this.connectSocket();
      } else {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Token authentication error:', error);
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  }


  // Show general error
  showError(message) {
    console.error('Error:', message);
    // You can implement a toast notification system here
  }

  // Réinitialiser le flag de notification de record (appelé lors du restart)
  resetRecordNotification() {
    this.recordNotificationShown = false;
  }

  // Show new record notification (sobre, une seule fois par session)
  showNewRecordNotification(data) {
    // Ne pas afficher si une notification a déjà été affichée dans cette session
    if (this.recordNotificationShown) {
      return;
    }

    // Marquer comme affichée
    this.recordNotificationShown = true;

    // Vérifier si une notification existe déjà pour éviter les doublons
    const existingNotification = document.querySelector('.record-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Déterminer si c'est un record du leaderboard (top 1)
    const isLeaderboardRecord = data.isLeaderboardRecord || false;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `record-notification ${isLeaderboardRecord ? 'leaderboard-record' : ''}`;
    notification.innerHTML = `
      <div class="record-content">
        <div class="record-icon">${isLeaderboardRecord ? '👑' : '🏆'}</div>
        <div class="record-text">
          <div class="record-title">${isLeaderboardRecord ? 'Record du Leaderboard !' : 'Nouveau Record'}</div>
          <div class="record-details">Niveau ${(data.level || 0) + 1}</div>
          ${data.previousRecord !== undefined ? `<div class="record-previous">Précédent: ${(data.previousRecord || 0) + 1}</div>` : ''}
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Animate in (une seule fois)
    setTimeout(() => {
      notification.classList.add('show');
    }, 50);

    // Remove after 4 seconds (plus long pour le leaderboard record)
    const displayTime = isLeaderboardRecord ? 5000 : 3000;
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, displayTime);
  }

  // Show security warning
  showWarning(message, type) {
    const notification = document.createElement('div');
    notification.className = 'security-warning';
    notification.innerHTML = `
      <div class="warning-content">
        <div class="warning-icon">⚠️</div>
        <div class="warning-text">
          <div class="warning-title">Avertissement de Sécurité</div>
          <div class="warning-message">${message}</div>
        </div>
        <button class="warning-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }

  // Show ban message
  showBanMessage(message, duration) {
    const notification = document.createElement('div');
    notification.className = 'ban-message';
    notification.innerHTML = `
      <div class="ban-content">
        <div class="ban-icon">🔒</div>
        <div class="ban-text">
          <div class="ban-title">Accès Temporairement Restreint</div>
          <div class="ban-message">${message}</div>
          <div class="ban-countdown" id="ban-countdown">${duration}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Countdown timer
    let timeLeft = duration;
    const countdownElement = notification.querySelector('#ban-countdown');
    const countdownInterval = setInterval(() => {
      timeLeft--;
      countdownElement.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }
    }, 1000);
  }

  // Update UI after authentication
  updateUI() {
    // Update user info display
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      const avatarUrl = AvatarUtils.getAvatarUrl(this.user.avatar, this.user.username);
      const avatarHtml = `<img class="avatar-img" src="${avatarUrl}" alt="avatar" />`;
      const nameToShow = this.user.displayName || this.user.username;
      userInfo.innerHTML = `
          <span class="user-avatar">${avatarHtml}</span>
          <button class="user-name" id="profile-view-open" title="Ouvrir le profil">${nameToShow}</button>
          <div class="util-actions">
            <button id="profile-btn" class="btn btn-outline btn-compact">Profil</button>
            <button id="logout-btn" class="btn btn-small" title="Déconnexion">⎋</button>
          </div>
      `;
    }

    // Setup logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        this.openProfileView();
      });
    }

    // Bind profile modal actions
    this.bindProfileModalEvents();
    // Apply avatar to player square if URL
    this.applyAvatarToPlayerSquare();
  }

  bindProfileModalEvents() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    const input = document.getElementById('profile-avatar-url');
    const closeBtn = document.getElementById('profile-close');
    const closeBtn2 = document.getElementById('profile-close-btn');
    const saveBtn = document.getElementById('profile-save');

    const closeModal = () => { AnimationUtils.hideModal(modal); };
    if (closeBtn) {
      closeBtn.onclick = closeModal;
    }
    if (closeBtn2) {
      closeBtn2.onclick = closeModal;
    }
    // Also close on overlay click or ESC
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (modal.classList.contains('show') && e.key === 'Escape') closeModal();
    });
    // Save avatar URL
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const url = (input?.value || '').trim();
        if (!url) {
          alert('Veuillez entrer une URL valide');
          return;
        }
        // Basic validation: http/https only
        let valid = false;
        try {
          const u = new URL(url);
          valid = ['http:', 'https:'].includes(u.protocol);
        } catch (_) { }
        if (!valid) {
          alert('URL invalide. Utilisez http(s)://');
          return;
        }
        try {
          const token = this.user?.token || localStorage.getItem('auth_token');
          const resp = await fetch('/api/auth/avatar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ avatar: url })
          });
          const data = await resp.json();
          if (!resp.ok || !data.success) throw new Error(data.message || 'Erreur');
          // Update local user avatar and UI
          this.user.avatar = url;
          this.applyAvatarToPlayerSquare();
          this.updateUI();
          this.updateLeaderboard();
          this.updateOnlinePlayers();

          // Mettre à jour l'aperçu
          const avatarPreview = document.getElementById('profile-avatar-preview');
          const infoAvatar = document.getElementById('profile-info-avatar');
          if (avatarPreview) avatarPreview.src = url;
          if (infoAvatar) infoAvatar.src = url;

          // Afficher un message de succès
          saveBtn.textContent = '✓ Enregistré';
          saveBtn.style.background = '#35bd86';
          setTimeout(() => {
            saveBtn.textContent = 'Enregistrer';
            saveBtn.style.background = '';
          }, 2000);
        } catch (e) {
          console.error('Avatar update failed', e);
          alert('Impossible de mettre à jour la photo de profil.');
        }
      };
    }
  }

  applyAvatarToPlayerSquare() {
    const playerEl = document.getElementById('player');
    if (!playerEl) return;
    const avatarUrl = AvatarUtils.getAvatarUrl(this.user?.avatar, this.user?.username);
    playerEl.style.backgroundImage = `url('${avatarUrl}')`;
    playerEl.style.backgroundSize = 'cover';
    playerEl.style.backgroundPosition = 'center';
  }

  // Render passive gains - Désactivé car maintenant dans l'historique
  renderPassiveGains() {
    // Plus de rendu des passifs, tout est dans l'historique
    const el = document.getElementById('passives-gains');
    if (el) el.textContent = '';
  }

  // Update leaderboard
  updateLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) {
      return;
    }

    if (this.leaderboard.length === 0) {
      leaderboardContainer.innerHTML = `
        <h3>🏆 Classement</h3>
        <div class="leaderboard-list">
          <div class="leaderboard-item">
            <span class="rank">-</span>
            <span class="avatar">📊</span>
            <span class="username">Chargement...</span>
            <span class="score">-</span>
          </div>
        </div>
      `;
      return;
    }

    leaderboardContainer.innerHTML = `
      <h3>🏆 Classement (Niveau Max)</h3>
      <div class="leaderboard-list">
        ${this.leaderboard.slice(0, 10).map((player, index) => {
      const avatarUrl = AvatarUtils.getAvatarUrl(player.avatar, player.username);
      return `
          <div class="leaderboard-item ${player.user_id === this.user?.id ? 'current-user' : ''}" data-username="${player.username}" data-level="${player.best_level || 0}" data-gold="${player.total_gold || 0}">
            <span class="rank">${index + 1}</span>
            <span class="avatar"><img class='avatar-img' src='${avatarUrl}' alt='avatar' /></span>
            <span class="username">${player.username}</span>
            <span class="score">Niveau ${(player.best_level || 0) + 1}</span>
          </div>
        `}).join('')}
      </div>
    `;

    // Bind hover cards
    const hover = document.getElementById('hover-card');
    leaderboardContainer.querySelectorAll('.leaderboard-item').forEach(item => {
      item.addEventListener('mousemove', (e) => {
        if (!hover) return;
        const name = item.dataset.username;
        const lvl = item.dataset.level;
        const gold = item.dataset.gold;
        const entry = this.leaderboard.find(p => p.username === name) || {};
        const avatarUrl = AvatarUtils.getAvatarUrl(entry.avatar, entry.username);
        const avatarHtml = `<img class='avatar-big' src='${avatarUrl}' alt='avatar'/>`;
        const games = entry.games_played || '-';
        const last = entry.last_activity || '-';
        hover.innerHTML = `
          <div class='avatar-wrap'>
            ${avatarHtml}
            <div class='meta'>
              <div class='title'>${name}</div>
              <div class='line'>Niveau max: ${parseInt(lvl) + 1}</div>
              <div class='line'>Parties jouées: ${games}</div>
              <div class='line'>Dernière activité: ${last}</div>
            </div>
          </div>`;
        hover.style.left = (e.clientX + 12) + 'px';
        hover.style.top = (e.clientY + 12) + 'px';
        hover.style.display = 'block';
      });
      item.addEventListener('mouseleave', () => { if (hover) hover.style.display = 'none'; });
    });
  }

  // Update online players
  updateOnlinePlayers() {
    const onlineContainer = document.getElementById('online-players');
    if (!onlineContainer) {
      return;
    }

    if (this.onlinePlayers.length === 0) {
      onlineContainer.innerHTML = `
        <h3>👥 En ligne (0)</h3>
        <div class="online-list">
          <div class="online-player">
            <span class="avatar">👤</span>
            <span class="username">Aucun joueur en ligne</span>
          </div>
        </div>
      `;
      return;
    }

    onlineContainer.innerHTML = `
      <h3>👥 En ligne (${this.onlinePlayers.length})</h3>
      <div class="online-list">
        ${this.onlinePlayers.map(player => {
      const avatarUrl = AvatarUtils.getAvatarUrl(player.avatar, player.username);
      return `
          <div class="online-player" data-username="${player.username}" data-level="${player.currentLevel || 0}">
            <span class="avatar"><img class='avatar-img' src='${avatarUrl}' alt='avatar' /></span>
            <span class="username">${player.username}</span>
            <span class="current-level">Niveau ${(player.currentLevel || 0) + 1}</span>
          </div>
        `}).join('')}
      </div>
    `;
    const hover = document.getElementById('hover-card');
    onlineContainer.querySelectorAll('.online-player').forEach(item => {
      item.addEventListener('mousemove', (e) => {
        if (!hover) return;
        const name = item.dataset.username;
        const lvl = parseInt(item.dataset.level) || 0;
        hover.innerHTML = `<div class="title">${name}</div><div class="line">Niveau actuel: ${lvl + 1}</div>`;
        hover.style.left = (e.clientX + 12) + 'px';
        hover.style.top = (e.clientY + 12) + 'px';
        hover.style.display = 'block';
      });
      item.addEventListener('mouseleave', () => { if (hover) hover.style.display = 'none'; });
    });
  }

  // Start game session
  async startGameSession() {
    if (!this.isAuthenticated) {
      return null;
    }

    try {

      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.user.token}`
        }
      });

      console.log('Game session response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Game session error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        this.sessionId = data.data.sessionId;
        return this.sessionId;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Start game session error:', error);
      throw error;
    }
  }

  // Submit game action
  async submitGameAction(action, data) {
    if (!this.isAuthenticated || !this.sessionId) return;

    this.socket.emit('game_action', {
      sessionId: this.sessionId,
      action,
      data
    });
  }

  // Submit score
  async submitScore(level, score, gold) {
    if (!this.isAuthenticated) {
      return;
    }

    // Si la session n'existe pas, essayer de la créer
    if (!this.sessionId || !this.securityToken) {
      // Essayer de créer la session si elle n'existe pas (silencieusement)
      if (this.socket && this.socket.connected) {
        this.socket.emit('start_game_session', {});
        // Attendre un peu pour que la session soit créée
        setTimeout(() => {
          if (this.sessionId && this.securityToken) {
            this.submitScore(level, score, gold);
          }
        }, 500);
      }
      // Ne pas afficher d'erreur, juste retourner silencieusement
      return;
    }

    const data = {
      sessionId: this.sessionId,
      securityToken: this.securityToken,
      level,
      score,
      gold
    };

    this.socket.emit('submit_score', data);
  }

  // Update current level in real-time
  updateCurrentLevel(level, gold, enemiesKilled = 0, bossDefeated = false) {
    if (!this.isAuthenticated) return;

    // Si la session n'existe pas, essayer de la créer
    if (!this.sessionId || !this.securityToken) {
      // Essayer de créer la session si elle n'existe pas (silencieusement)
      if (this.socket && this.socket.connected) {
        this.socket.emit('start_game_session', {});
        // Attendre un peu pour que la session soit créée
        setTimeout(() => {
          if (this.sessionId && this.securityToken) {
            this.updateCurrentLevel(level, gold, enemiesKilled, bossDefeated);
          }
        }, 500);
      }
      // Ne pas afficher d'erreur, juste retourner silencieusement
      return;
    }

    const data = {
      level,
      gold,
      enemiesKilled,
      bossDefeated,
      sessionId: this.sessionId,
      securityToken: this.securityToken
    };

    this.socket.emit('update_level', data);
  }

  // Validate current deck (anti-cheat)
  validateCurrentDeck() {
    if (!this.isAuthenticated || !this.sessionId) {
      return;
    }

    // Get current deck from cardSystem
    if (!window.cardSystem) {
      return;
    }

    const deck = window.cardSystem.playerDeck || [];

    // SILENT: Only validate if deck is not empty (avoid error on fresh start)
    if (deck.length === 0) {
      console.log('🔒 Deck vide, validation ignorée');
      return;
    }

    // Send deck to server for validation
    this.socket.emit('validate_deck', {
      sessionId: this.sessionId,
      deck: deck
    });

    console.log('🔒 Deck envoyé pour validation:', deck.length, 'cartes');
  }

  // Load initial leaderboard
  async loadInitialLeaderboard() {
    try {
      const response = await fetch('/api/leaderboard');
      const data = await response.json();

      if (data.success) {
        this.leaderboard = data.data.leaderboard;
        this.updateLeaderboard();
      }
    } catch (error) {
      console.error('Failed to load initial leaderboard:', error);
    }
  }

  // Force leaderboard update (for reconnection)
  async forceLeaderboardUpdate() {
    if (this.socket && this.isAuthenticated) {
      console.log('Requesting fresh leaderboard update...');
      this.socket.emit('request_leaderboard_update');
    }
  }

  // Gérer la restauration de partie après rafraîchissement (DÉSACTIVÉ)
  handleGameRestoration(data) {
    // Pas de restauration - chaque session démarre au niveau de base
    console.log('🔄 Nouvelle session - démarrage au niveau de base (pas de restauration)');
  }

  // Afficher un message de restauration
  showRestorationMessage() {
    const message = document.createElement('div');
    message.textContent = '🔄 Partie restaurée avec succès !';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(145deg, #00b894, #00a085);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      font-weight: 600;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      box-shadow: 0 5px 15px rgba(0, 184, 148, 0.3);
    `;

    document.body.appendChild(message);

    // Supprimer le message après 3 secondes
    setTimeout(() => {
      message.remove();
    }, 3000);
  }

  // Logout
  async logout() {
    try {
      if (this.user && this.user.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.user.token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      this.user = null;
      this.isAuthenticated = false;
      this.sessionId = null;

      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      location.reload();
    }
  }

  // Save passive upgrade to session
  savePassiveUpgrade(upgrade) {
    if (this.socket && this.sessionId) {
      this.socket.emit('save_passive_upgrade', {
        sessionId: this.sessionId,
        upgrade: upgrade
      });
    }
  }

  // Save boss passive to session
  saveBossPassive(bossPassive) {
    if (this.socket && this.sessionId) {
      this.socket.emit('save_boss_passive', {
        sessionId: this.sessionId,
        bossPassive: bossPassive
      });
    }
  }

  // Request session passives
  requestSessionPassives() {
    if (this.socket && this.sessionId) {
      this.socket.emit('request_session_passives', {
        sessionId: this.sessionId
      });
    }
  }

  // Effacer la sauvegarde de la partie en cours
  clearGameSession() {
    if (this.socket && this.sessionId) {
      this.socket.emit('clear_game_session', {
        sessionId: this.sessionId,
        securityToken: this.securityToken
      });
      console.log('🗑️ Sauvegarde serveur effacée pour la session:', this.sessionId);
    }
  }

  // Handle session passives received
  onSessionPassivesReceived(passives) {
    this.sessionPassives = passives;

    // Notify game to restore passives
    if (window.game && window.game.restoreSessionPassives) {
      window.game.restoreSessionPassives(passives);
    }
  }

  // Get server game client
  getServerGameClient() {
    return this.serverGameClient;
  }

  // Check if using server-side game logic (DÉSACTIVÉ pour les fonctions de base)
  isUsingServerGameLogic() {
    return false; // Désactivé pour garder les fonctions de base côté client
    // return this.serverGameClient && this.serverGameClient.isConnectedToServer();
  }

  // Get server validator
  getServerValidator() {
    return this.serverValidator;
  }

  // Check if server validation is active
  isServerValidationActive() {
    return this.serverValidator && this.serverValidator.isValidationActive();
  }

  // Open profile view modal
  async openProfileView() {
    if (!this.isAuthenticated || !this.user) {
      console.error('Cannot open profile view: not authenticated or user data missing');
      return;
    }

    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    const token = this.user?.token || localStorage.getItem('auth_token');
    try {
      const resp = await fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();
      if (!data?.success) throw new Error(data?.message || 'Profile fetch failed');
      const d = data.data || {};

      // Récupérer l'or total et les caisses depuis le leaderboard
      let totalGold = 0;
      let totalLootBoxes = 0;
      try {
        const leaderboardResp = await fetch('/api/leaderboard/user/' + this.user.id);
        if (leaderboardResp.ok) {
          const lbData = await leaderboardResp.json();
          if (lbData.success && lbData.data) {
            totalGold = lbData.data.total_gold || 0;
            totalLootBoxes = lbData.data.total_loot_boxes || 0;
          }
        }
      } catch (e) {
        console.warn('Could not fetch stats from leaderboard:', e);
      }

      const avatarUrl = AvatarUtils.getAvatarUrl(d.avatar, d.username);

      // Onglet Informations
      const infoAvatar = document.getElementById('profile-info-avatar');
      if (infoAvatar) infoAvatar.src = avatarUrl;
      const infoUsername = document.getElementById('profile-info-username');
      if (infoUsername) infoUsername.textContent = d.username || this.user?.username || 'Utilisateur';
      const infoLast = document.getElementById('profile-info-last');
      if (infoLast) infoLast.textContent = d.lastLogin ? new Date(d.lastLogin).toLocaleDateString('fr-FR') : '-';
      const infoCreated = document.getElementById('profile-info-created');
      if (infoCreated && d.createdAt) {
        infoCreated.textContent = new Date(d.createdAt).toLocaleDateString('fr-FR');
      } else if (infoCreated) {
        infoCreated.textContent = '-';
      }

      // Onglet Statistiques
      const statLevel = document.getElementById('profile-stat-best-level');
      if (statLevel) statLevel.textContent = (d.bestLevel || 0) + 1;
      const statGold = document.getElementById('profile-stat-total-gold');
      if (statGold) statGold.textContent = totalGold.toLocaleString('fr-FR');
      const statGames = document.getElementById('profile-stat-games');
      if (statGames) statGames.textContent = d.gamesPlayed || 0;
      const statLootBoxes = document.getElementById('profile-stat-loot-boxes');
      if (statLootBoxes) statLootBoxes.textContent = totalLootBoxes.toLocaleString('fr-FR');

      // Onglet Photo de profil
      const avatarPreview = document.getElementById('profile-avatar-preview');
      if (avatarPreview) avatarPreview.src = avatarUrl;
      const avatarInput = document.getElementById('profile-avatar-url');
      if (avatarInput) {
        avatarInput.value = (typeof d.avatar === 'string' && /^(https?:)\/\//i.test(d.avatar)) ? d.avatar : '';
      }

      // Gestion des onglets
      const tabs = modal.querySelectorAll('.profile-tab');
      const tabContents = modal.querySelectorAll('.profile-tab-content');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const targetTab = tab.dataset.tab;

          // Désactiver tous les onglets
          tabs.forEach(t => t.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));

          // Activer l'onglet sélectionné
          tab.classList.add('active');
          const targetContent = document.getElementById(`tab-${targetTab}`);
          if (targetContent) targetContent.classList.add('active');
        });
      });

      // Mise à jour de l'aperçu de l'avatar en temps réel
      if (avatarInput) {
        avatarInput.addEventListener('input', (e) => {
          const url = e.target.value.trim();
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            if (avatarPreview) avatarPreview.src = url;
          } else if (avatarPreview) {
            avatarPreview.src = avatarUrl;
          }
        });
      }

      AnimationUtils.showModal(modal);
    } catch (e) {
      console.error('Failed to open profile view:', e);
      this.showError(e.message);
    }
  }
}

// Make OnlineManager globally available
window.OnlineManager = OnlineManager;
