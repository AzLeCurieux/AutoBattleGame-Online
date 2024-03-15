document.addEventListener('DOMContentLoaded', () => {
    // Check authentication (User OR Admin)
    const userToken = localStorage.getItem('token'); // Legacy token key?
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const adminToken = localStorage.getItem('admin_token');

    const activeToken = adminToken || authToken;

    if (!activeToken) {
        window.location.href = '/admin-login';
        return;
    }

    // If we have an admin token, show indicator
    if (adminToken) {
        const logo = document.querySelector('.logo span');
        if (logo) logo.innerHTML += ' <span style="color: #e74c3c; font-size: 0.8em;">(ADMIN)</span>';
    }

    const refreshBtn = document.getElementById('refresh-btn');
    const connectionStatus = document.getElementById('connection-status');
    const lastUpdate = document.getElementById('last-update');

    let isUpdating = false;

    // Charts
    let systemChart = null;
    let gameChart = null;
    let bandwidthChart = null;

    function initCharts() {
        const ctxSys = document.getElementById('systemChart').getContext('2d');
        const ctxGame = document.getElementById('gameChart').getContext('2d');
        const ctxBandwidth = document.getElementById('bandwidthChart').getContext('2d');

        Chart.defaults.color = '#8899a6';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

        systemChart = new Chart(ctxSys, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'CPU (%)',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'RAM (GB)',
                        data: [],
                        borderColor: '#f1c40f',
                        backgroundColor: 'rgba(241, 196, 15, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: {
                        display: false // Hide time labels for cleaner look
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });

        gameChart = new Chart(ctxGame, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Joueurs',
                        data: [],
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Sessions',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    x: { display: false }
                }
            }
        });

        bandwidthChart = new Chart(ctxBandwidth, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Entrant (MB)',
                        data: [],
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Sortant (MB)',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: { display: false }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    function updateCharts(history) {
        if (!systemChart || !gameChart || !bandwidthChart || !history) return;

        const labels = history.map(h => new Date(h.time).toLocaleTimeString());

        // Update System Chart
        systemChart.data.labels = labels;
        systemChart.data.datasets[0].data = history.map(h => h.cpu);
        systemChart.data.datasets[1].data = history.map(h => (h.mem / (1024 * 1024 * 1024)).toFixed(2)); // GB
        systemChart.update('none'); // 'none' mode for performance

        // Update Game Chart
        gameChart.data.labels = labels;
        gameChart.data.datasets[0].data = history.map(h => h.users);
        gameChart.data.datasets[1].data = history.map(h => h.sessions);
        gameChart.update('none');

        // Update Bandwidth Chart
        bandwidthChart.data.labels = labels;
        bandwidthChart.data.datasets[0].data = history.map(h => (h.netIn / (1024 * 1024)).toFixed(2)); // MB
        bandwidthChart.data.datasets[1].data = history.map(h => (h.netOut / (1024 * 1024)).toFixed(2)); // MB
        bandwidthChart.update('none');
    }

    // Function to format bytes
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Function to format time
    function formatUptime(seconds) {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);

        const dDisplay = d > 0 ? d + (d == 1 ? "j " : "j ") : "";
        const hDisplay = h > 0 ? h + (h == 1 ? "h " : "h ") : "";
        const mDisplay = m > 0 ? m + (m == 1 ? "m " : "m ") : "";
        const sDisplay = s > 0 ? s + (s == 1 ? "s" : "s") : "";
        return dDisplay + hDisplay + mDisplay + sDisplay;
    }

    async function fetchStats() {
        if (isUpdating) return;
        isUpdating = true;
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/api/monitoring/stats', {
                headers: {
                    'Authorization': `Bearer ${activeToken}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                // Token invalid or expired
                if (adminToken) {
                    localStorage.removeItem('admin_token');
                    window.location.href = '/admin-login';
                } else {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
                return;
            }

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            updateUI(data);

            connectionStatus.classList.remove('offline');
            lastUpdate.textContent = 'Mis à jour: ' + new Date().toLocaleTimeString();
        } catch (error) {
            console.error('Error fetching stats:', error);
            connectionStatus.classList.add('offline');
            lastUpdate.textContent = 'Erreur de connexion';
        } finally {
            isUpdating = false;
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualiser';
        }
    }

    function updateUI(data) {
        // System Stats
        document.getElementById('uptime').textContent = formatUptime(data.system.uptime);

        // CPU Load (from systeminformation)
        // data.system.cpuLoad is the overall %
        const loadPercent = data.system.cpuLoad ? data.system.cpuLoad.toFixed(1) : '0.0';
        document.getElementById('cpu-load').textContent = loadPercent + '%';

        // Load Avg (array)
        if (data.system.loadavg && Array.isArray(data.system.loadavg)) {
            document.getElementById('load-avg').textContent = `Avg: ${data.system.loadavg.map(n => n.toFixed(2)).join(', ')}`;
        }

        // Memory (from systeminformation)
        // data.system.memory.active / total
        const memUsed = data.system.memory.active;
        const memTotal = data.system.memory.total;

        document.getElementById('memory-usage').textContent = formatBytes(memUsed);
        document.getElementById('memory-total').textContent = 'Total: ' + formatBytes(memTotal);

        document.getElementById('heap-used').textContent = formatBytes(data.system.memory.heapUsed);
        document.getElementById('rss-used').textContent = formatBytes(data.system.memory.rss);

        // Detail RSS (if element exists)
        const rssDetail = document.getElementById('rss-used-detail');
        if (rssDetail) rssDetail.textContent = formatBytes(data.system.memory.rss);

        // Visual bar for memory usage
        const memPercent = (memUsed / memTotal) * 100;
        document.getElementById('memory-bar').style.width = Math.min(memPercent, 100) + '%';

        // Game Stats
        document.getElementById('connected-clients').textContent = data.socket.connected;
        document.getElementById('active-users').textContent = data.game.activeUsers;
        document.getElementById('active-sessions').textContent = data.game.activeSessions;
        document.getElementById('leaderboard-size').textContent = data.game.leaderboardSize;

        // Disk Usage
        if (data.system.disk) {
            document.getElementById('disk-usage').textContent = data.system.disk.percent;
            document.getElementById('disk-details').textContent = `${data.system.disk.used} / ${data.system.disk.total}`;
            document.getElementById('disk-bar').style.width = data.system.disk.percent;
        }

        // Bandwidth
        if (data.network) {
            document.getElementById('bandwidth-in').textContent = formatBytes(data.network.bytesIn);
            document.getElementById('bandwidth-out').textContent = formatBytes(data.network.bytesOut);
        }

        // Ports
        if (data.system.ports) {
            document.getElementById('open-ports-count').textContent = data.system.ports.length;
            document.getElementById('open-ports-list').textContent = data.system.ports.join(', ');
        }

        // Process Info
        if (data.process) {
            document.getElementById('process-pid').textContent = `PID: ${data.process.pid}`;
            document.getElementById('node-version').textContent = data.system.nodeVersion;
            document.getElementById('os-platform').textContent = data.system.platform;
            document.getElementById('os-arch').textContent = data.system.arch;
        }

        // Plugins
        if (data.plugins) {
            const pluginsGrid = document.getElementById('plugins-grid');
            pluginsGrid.innerHTML = ''; // Clear existing

            data.plugins.forEach(plugin => {
                const card = document.createElement('div');
                card.className = 'plugin-card';
                card.innerHTML = `
                    <div class="plugin-name">${plugin.name}</div>
                    <span class="plugin-status"><i class="fas fa-check-circle"></i> ${plugin.status}</span>
                    <div class="plugin-detail">${plugin.details}</div>
                `;
                pluginsGrid.appendChild(card);
            });
        }

        // Update Charts if history exists
        if (data.history) {
            if (!systemChart) initCharts();
            updateCharts(data.history);
        }
    }

    // Initial fetch
    fetchStats();

    // Auto refresh every 5 seconds
    setInterval(fetchStats, 5000);

    // Manual refresh
    refreshBtn.addEventListener('click', fetchStats);
});
