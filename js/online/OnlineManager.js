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
    
    this.init();
  }

  async init() {
    // Check if user is already authenticated
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      await this.authenticateWithToken(token);
    } else {
      // Redirect to login page if not authenticated
      window.location.href = '/login';
    }
  }

  // Initialize Socket.io connection
  connectSocket() {
    this.socket = io();
    
    this.socket.on('connect', () => {
      if (this.user && this.user.token) {
        this.socket.emit('authenticate', { token: this.user.token });
      }
    });

    this.socket.on('authenticated', async (data) => {
      this.isAuthenticated = true;
      this.user = { ...this.user, ...data };
      this.updateUI();
      
      // Initialize server-side game client (ACTIVÉ - 100% serveur)
      this.serverGameClient = new ServerGameClient(this);
      if (data.sessionId && data.gameState) {
        this.serverGameClient.initializeGameSession(data.sessionId, data.gameState);
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
      
      // Start game session immediately after authentication
      try {
        await this.startGameSession();
        // Request secure session via socket with the same sessionId
        this.socket.emit('start_game_session', {
          sessionId: this.sessionId
        });
      } catch (error) {
        console.error('Failed to start game session after authentication:', error);
      }
    });

    this.socket.on('auth_error', (error) => {
      console.error('Authentication error:', error);
      // Redirect to login page on auth error
      window.location.href = '/login';
    });

        this.socket.on('leaderboard_update', (data) => {
          this.leaderboard = data.leaderboard;
          this.updateLeaderboard();
        });

    this.socket.on('online_players_update', (data) => {
      this.onlinePlayers = data.players;
      this.updateOnlinePlayers();
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
      
      // Request session passives to restore them
      this.requestSessionPassives();
    });

    // Détection de rafraîchissement de page
    this.socket.on('game_restored', (data) => {
      console.log('🔄 Partie restaurée après rafraîchissement:', data);
      this.handleGameRestoration(data);
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

  // Show new record notification
  showNewRecordNotification(data) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'record-notification';
    notification.innerHTML = `
      <div class="record-content">
        <div class="record-icon">🏆</div>
        <div class="record-text">
          <div class="record-title">NOUVEAU RECORD !</div>
          <div class="record-details">Niveau ${data.level} atteint !</div>
          <div class="record-previous">Précédent: ${data.previousRecord}</div>
        </div>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }, 5000);
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
      const isUrl = typeof this.user.avatar === 'string' && /^(https?:)\/\//i.test(this.user.avatar);
      const avatarHtml = isUrl ? `<img class=\"avatar-img\" src=\"${this.user.avatar}\" alt=\"avatar\" />` : this.getAvatarEmoji(this.user.avatar);
      userInfo.innerHTML = `
          <span class=\"user-avatar\">${avatarHtml}</span>
          <button class=\"user-name\" id=\"profile-view-open\" title=\"Ouvrir le profil\">${this.user.username}</button>
          <div class=\"util-actions\">
            <button id=\"profile-btn\" class=\"btn btn-outline btn-compact\">Profil</button>
            <button id=\"logout-btn\" class=\"btn btn-small\" title=\"Déconnexion\">⎋</button>
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
        const modal = document.getElementById('profile-modal');
        const input = document.getElementById('profile-avatar-url');
        if (input) input.value = (typeof this.user.avatar === 'string' && /^(https?:)\/\//i.test(this.user.avatar)) ? this.user.avatar : '';
        if (modal) modal.style.display = 'flex';
      });
    }

    // Bind profile modal actions
    this.bindProfileModalEvents();
    // Apply avatar to player square if URL
    this.applyAvatarToPlayerSquare();

    // Bind profile view (read-only) on username click
    const profileViewOpen = document.getElementById('profile-view-open');
    if (profileViewOpen) {
      profileViewOpen.addEventListener('click', () => this.openProfileView());
    }
  }

  bindProfileModalEvents() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    const input = document.getElementById('profile-avatar-url');
    const closeBtn = document.getElementById('profile-close');
    const cancelBtn = document.getElementById('profile-cancel');
    const saveBtn = document.getElementById('profile-save');

    const closeModal = () => { modal.style.display = 'none'; };
    if (closeBtn) {
      closeBtn.onclick = closeModal;
    }
    if (cancelBtn) {
      cancelBtn.onclick = closeModal;
    }
    // Save avatar URL
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const url = (input?.value || '').trim();
        if (!url) { closeModal(); return; }
        // Basic validation: http/https only
        let valid = false;
        try {
          const u = new URL(url);
          valid = ['http:', 'https:'].includes(u.protocol);
        } catch (_) {}
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
          this.updateLeaderboard();
          this.updateOnlinePlayers();
          closeModal();
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
    const avatar = this.user?.avatar;
    const isUrl = typeof avatar === 'string' && /^(https?:)\/\//i.test(avatar);
    if (isUrl) {
      playerEl.style.backgroundImage = `url('${avatar}')`;
      playerEl.style.backgroundSize = 'cover';
      playerEl.style.backgroundPosition = 'center';
    } else {
      playerEl.style.backgroundImage = '';
    }
  }

  // Render passive gains under combat stats (simple aggregation)
  renderPassiveGains() {
    const el = document.getElementById('passives-gains');
    if (!el) return;
    const msgs = window.game?.passiveGainMessages || [];
    if (!msgs.length) { el.textContent = ''; return; }
    el.innerHTML = msgs.map(m => `<span class="gain">${m}</span>`).join(' <span class="sep">•</span> ');
  }

  // Get avatar emoji
  getAvatarEmoji(avatar) {
    const avatars = {
      default: '🔵',
      red: '🔴',
      green: '🟢',
      yellow: '🟡',
      purple: '🟣',
      orange: '🟠'
    };
    return avatars[avatar] || avatars.default;
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
        ${this.leaderboard.slice(0, 10).map((player, index) => `
          <div class="leaderboard-item ${player.user_id === this.user?.id ? 'current-user' : ''}" data-username="${player.username}" data-level="${player.best_level || 0}" data-gold="${player.total_gold || 0}">
            <span class="rank">${index + 1}</span>
            <span class="avatar">${/^(https?:)\/\//i.test(player.avatar || '') ? `<img class='avatar-img' src='${player.avatar}' alt='avatar' />` : this.getAvatarEmoji(player.avatar)}</span>
            <span class="username">${player.username}</span>
            <span class="score">Niveau ${player.best_level || 0}</span>
          </div>
        `).join('')}
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
        const avatar = entry.avatar || '';
        const isUrl = /^(https?:)\/\//i.test(avatar || '');
        const avatarHtml = isUrl ? `<img class='avatar-big' src='${avatar}' alt='avatar'/>` : `<div class='avatar-big' style='display:flex;align-items:center;justify-content:center;font-size:28px;'>${this.getAvatarEmoji(avatar)}</div>`;
        const games = entry.games_played || '-';
        const last = entry.last_activity || '-';
        hover.innerHTML = `
          <div class='avatar-wrap'>
            ${avatarHtml}
            <div class='meta'>
              <div class='title'>${name}</div>
              <div class='line'>Niveau max: ${lvl}</div>
              <div class='line'>Or total: ${gold}</div>
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
        ${this.onlinePlayers.map(player => `
          <div class="online-player" data-username="${player.username}" data-level="${player.currentLevel || 0}">
            <span class="avatar">${/^(https?:)\/\//i.test(player.avatar || '') ? `<img class='avatar-img' src='${player.avatar}' alt='avatar' />` : this.getAvatarEmoji(player.avatar)}</span>
            <span class="username">${player.username}</span>
            <span class="current-level">Niveau ${player.currentLevel || 0}</span>
          </div>
        `).join('')}
      </div>
    `;
    const hover = document.getElementById('hover-card');
    onlineContainer.querySelectorAll('.online-player').forEach(item => {
      item.addEventListener('mousemove', (e) => {
        if (!hover) return;
        const name = item.dataset.username;
        const lvl = item.dataset.level;
        hover.innerHTML = `<div class="title">${name}</div><div class="line">Niveau actuel: ${lvl}</div>`;
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
      console.log("Cannot submit score: not authenticated");
      return;
    }

    // STRICT: Session ID and security token are REQUIRED
    if (!this.sessionId || !this.securityToken) {
      console.log("Cannot submit score: missing session data");
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

    // STRICT: Session ID and security token are REQUIRED
    if (!this.sessionId || !this.securityToken) {
      console.error('Cannot update level: missing session data');
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

  // Gérer la restauration de partie après rafraîchissement
  handleGameRestoration(data) {
    if (!window.game) {
      console.error('❌ Game non disponible pour la restauration');
      return;
    }

    console.log('🔄 Restauration de la partie...');
    
    // Restaurer l'état du joueur
    if (data.player) {
      const player = data.player;
      
      // Restaurer les stats de base
      if (player.level !== undefined) {
        window.game.level.setLevel(player.level);
      }
      if (player.gold !== undefined) {
        window.game.player.gold = player.gold;
        window.game.player.updateGoldAmount();
      }
      if (player.maxHealth !== undefined) {
        window.game.player.maxHealth = player.maxHealth;
      }
      if (player.currentHealth !== undefined) {
        window.game.player.currentHealth = player.currentHealth;
        window.game.player.updateHealth();
      }
      if (player.damage !== undefined) {
        window.game.player.damage.setDamage(player.damage);
      }
      
      console.log(`✅ Joueur restauré - Niveau: ${player.level}, Or: ${player.gold}, Santé: ${player.currentHealth}/${player.maxHealth}`);
    }

    // Restaurer les améliorations passives
    if (data.passiveUpgrades && data.passiveUpgrades.length > 0) {
      window.game.player.passiveUpgrades = data.passiveUpgrades;
      console.log(`✅ ${data.passiveUpgrades.length} améliorations passives restaurées`);
    }

    // Restaurer les améliorations de boss
    if (data.bossPassives && data.bossPassives.length > 0) {
      window.game.player.bossPassives = data.bossPassives;
      console.log(`✅ ${data.bossPassives.length} améliorations de boss restaurées`);
    }

    // Mettre à jour l'UI
    window.game.updateUI();
    
    // Afficher un message de confirmation
    this.showRestorationMessage();
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

    const modal = document.getElementById('profile-view');
    if (!modal) return;

    const token = this.user?.token || localStorage.getItem('auth_token');
    try {
      const resp = await fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();
      if (!data?.success) throw new Error(data?.message || 'Profile fetch failed');
      const d = data.data || {};
      const isUrl = typeof d.avatar === 'string' && /^(https?:)\/\//i.test(d.avatar);
      const avatarEl = document.getElementById('profile-view-avatar');
      if (avatarEl) avatarEl.src = isUrl ? d.avatar : '';
      const u = document.getElementById('profile-view-username');
      if (u) u.textContent = d.username || this.user?.username || 'Utilisateur';
      const last = document.getElementById('profile-view-last');
      if (last) last.textContent = d.lastLogin || '-';
      const bl = document.getElementById('profile-view-best-level');
      if (bl) bl.textContent = d.bestLevel || 0;
      const bs = document.getElementById('profile-view-best-score');
      if (bs) bs.textContent = d.bestScore || d.bestLevel || 0;
      const gp = document.getElementById('profile-view-games');
      if (gp) gp.textContent = d.gamesPlayed || 0;
      const close1 = document.getElementById('profile-view-close');
      const close2 = document.getElementById('profile-view-close2');
      const doClose = () => (modal.style.display = 'none');
      if (close1) close1.onclick = doClose;
      if (close2) close2.onclick = doClose;
      modal.style.display = 'flex';
    } catch (e) {
      console.error('Failed to open profile view:', e);
      this.showError(e.message);
    }
  }
}

// Make OnlineManager globally available
window.OnlineManager = OnlineManager;
