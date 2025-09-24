class OnlineManager {
  constructor() {
    this.socket = null;
    this.isAuthenticated = false;
    this.user = null;
    this.sessionId = null;
    this.leaderboard = [];
    this.onlinePlayers = [];
    
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
      console.log('Authenticated:', data);
      this.isAuthenticated = true;
      this.user = { ...this.user, ...data };
      this.updateUI();
      this.loadInitialLeaderboard();
      
      // Start game session immediately after authentication
      try {
        await this.startGameSession();
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
      console.log('Leaderboard update received:', data);
      this.leaderboard = data.leaderboard;
      this.updateLeaderboard();
    });

    this.socket.on('online_players_update', (data) => {
      console.log('Online players update received:', data);
      this.onlinePlayers = data.players;
      this.updateOnlinePlayers();
    });

    this.socket.on('game_result', (result) => {
      console.log('Game result:', result);
      // Handle game results
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.showError(error.message);
    });

    this.socket.on('new_record', (data) => {
      console.log('New record!', data);
      this.showNewRecordNotification(data);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isAuthenticated = false;
    });
  }




  // Authenticate with existing token
  async authenticateWithToken(token) {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
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

  // Update UI after authentication
  updateUI() {
    // Update user info display
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      userInfo.innerHTML = `
        <div class="user-profile">
          <span class="user-avatar">${this.getAvatarEmoji(this.user.avatar)}</span>
          <span class="user-name">${this.user.username}</span>
          <button id="logout-btn" class="btn btn-small">Déconnexion</button>
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
      console.log('Leaderboard container not found');
      return;
    }

    console.log('Updating leaderboard with data:', this.leaderboard);

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
          <div class="leaderboard-item ${player.user_id === this.user?.id ? 'current-user' : ''}">
            <span class="rank">${index + 1}</span>
            <span class="avatar">${this.getAvatarEmoji(player.avatar)}</span>
            <span class="username">${player.username}</span>
            <span class="score">Niveau ${player.best_level || 0}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    console.log('Leaderboard updated successfully');
  }

  // Update online players
  updateOnlinePlayers() {
    const onlineContainer = document.getElementById('online-players');
    if (!onlineContainer) {
      console.log('Online players container not found');
      return;
    }

    console.log('Updating online players with data:', this.onlinePlayers);

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
          <div class="online-player">
            <span class="avatar">${this.getAvatarEmoji(player.avatar)}</span>
            <span class="username">${player.username}</span>
            <span class="current-level">Niveau ${player.currentLevel || 0}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    console.log('Online players updated successfully');
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
    if (!this.isAuthenticated || !this.sessionId) {
      console.log("Cannot submit score: not authenticated or no session");
      return;
    }

    this.socket.emit('submit_score', {
      sessionId: this.sessionId,
      level,
      score,
      gold
    });
  }

  // Update current level in real-time
  updateCurrentLevel(level, gold) {
    if (!this.isAuthenticated) return;

    this.socket.emit('update_level', {
      level,
      gold
    });
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
}

// Make OnlineManager globally available
window.OnlineManager = OnlineManager;
