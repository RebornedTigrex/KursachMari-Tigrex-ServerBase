// modules/dataCache.js - Переработанный Data Cache Module для веб-приложения рекламного агентства
// Основные сущности: Клиенты, Кампании, Задачи, Команда (сотрудники), Метрики/Отчеты
// Добавлены полноценные CRUD-методы с optimistic updates и proper error propagation
// Поддержка дашборда с ключевыми метриками агентства (активные кампании, бюджет, ROI и т.д.)

class DataCache {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'ad_agency_cache_v1';
        this.cache = {
            dashboard: null,
            clients: [],          // Array of {id, name, contact, status, totalBudget, campaignsCount}
            campaigns: [],        // Array of {id, clientId, name, status, budget, spent, startDate, endDate, roi}
            tasks: [],            // Array of {id, campaignId, assigneeId, title, description, status, dueDate}
            team: [],             // Array of {id, fullname, role, workload} // workload - % загруженности
            metrics: [],          // Дополнительные метрики по кампаниям
            lastUpdated: null
        };

        this.apiBaseUrl = options.apiBaseUrl || '/api';
        this.enablePersistence = typeof options.enablePersistence === 'boolean' ? options.enablePersistence : true;

        this._loadFromStorage();
    }

    // --- Persistence helpers (без изменений) ---
    _loadFromStorage() {
        if (!this.enablePersistence) return;
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.cache = { ...this.cache, ...parsed };
            }
        } catch (err) {
            console.warn('Failed to load cache from localStorage:', err);
        }
    }

    _saveToStorage() {
        if (!this.enablePersistence) return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.cache));
        } catch (err) {
            console.warn('Failed to save cache to localStorage:', err);
        }
    }

    _markUpdated() {
        this.cache.lastUpdated = new Date().toISOString();
        this._saveToStorage();
        try {
            window.dispatchEvent(new CustomEvent('dataCache:updated', { detail: { lastUpdated: this.cache.lastUpdated } }));
        } catch (e) { }
    }

    _isCacheExpired() {
        if (!this.cache.lastUpdated) return true;
        const now = new Date();
        const last = new Date(this.cache.lastUpdated);
        const diffInMinutes = (now - last) / (1000 * 60);
        return diffInMinutes > 5; // 5-minute TTL
    }

    // --- Network helper (без изменений) ---
    async _syncToServer(method, path, body, options = {}) {
        try {
            const url = `${this.apiBaseUrl}${path}`;
            const headers = { 'Content-Type': 'application/json' };

            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                ...options
            });

            if (!res.ok) {
                const text = await res.text();
                const error = {
                    status: res.status,
                    statusText: res.statusText,
                    body: text
                };
                throw error;
            }

            const data = await res.json();

            if (data.lastUpdated && new Date(data.lastUpdated) > new Date(this.cache.lastUpdated || 0)) {
                this.cache.lastUpdated = data.lastUpdated;
            }
            return data;
        } catch (err) {
            throw err;
        }
    }

    setOptions(opts = {}) {
        if (typeof opts.apiBaseUrl === 'string') this.apiBaseUrl = opts.apiBaseUrl;
        if (typeof opts.enablePersistence === 'boolean') this.enablePersistence = opts.enablePersistence;
        if (opts.storageKey) this.storageKey = opts.storageKey;
        this._saveToStorage();
    }

    // --- Public API ---
    async fetchAllData(forceRefresh = false) {
        if (!forceRefresh && !this._isCacheExpired()) {
            return this.cache;
        }

        try {
            const serverData = await this._syncToServer('GET', '/all-data');
            if (serverData) {
                this.cache = { ...this.cache, ...serverData };
                this._computeDashboard();
                this._markUpdated();
                return this.cache;
            }
        } catch (err) {
            console.warn('Using local cache due to network error:', err);
        }

        // Fallback mock data если кэш пуст
        if (!this.cache.clients.length) {
            this._loadMockData();
        }
        this._computeDashboard();
        this._markUpdated();
        return this.cache;
    }

    _loadMockData() {
        this.cache.clients = [
            { id: 1, name: 'Компания А', contact: 'Иван Иванов', status: 'active', totalBudget: 500000, campaignsCount: 3 },
            { id: 2, name: 'Бренд Б', contact: 'Мария Петрова', status: 'active', totalBudget: 300000, campaignsCount: 2 },
            { id: 3, name: 'Стартап В', contact: 'Алексей Сидоров', status: 'prospect', totalBudget: 0, campaignsCount: 0 }
        ];
        this.cache.campaigns = [
            { id: 1, clientId: 1, name: 'Летняя акция', status: 'running', budget: 200000, spent: 120000, startDate: '2025-06-01', endDate: '2025-09-01', roi: 2.4 },
            { id: 2, clientId: 1, name: 'SMM продвижение', status: 'planning', budget: 150000, spent: 0, startDate: '2025-12-01', endDate: '2026-03-01', roi: null }
        ];
        this.cache.tasks = [
            { id: 1, campaignId: 1, assigneeId: 1, title: 'Создать баннеры', description: '', status: 'in_progress', dueDate: '2025-12-30' }
        ];
        this.cache.team = [
            { id: 1, fullname: 'Анна Креатив', role: 'Дизайнер', workload: 85 },
            { id: 2, fullname: 'Дмитрий Таргетолог', role: 'Специалист по рекламе', workload: 70 }
        ];
    }

    _computeDashboard() {
        const activeCampaigns = this.cache.campaigns.filter(c => c.status === 'running');
        const totalBudget = activeCampaigns.reduce((sum, c) => sum + c.budget, 0);
        const totalSpent = activeCampaigns.reduce((sum, c) => sum + c.spent, 0);
        const avgRoi = activeCampaigns.filter(c => c.roi).reduce((sum, c) => sum + c.roi, 0) / activeCampaigns.filter(c => c.roi).length || 0;

        this.cache.dashboard = {
            activeClients: this.cache.clients.filter(cl => cl.status === 'active').length,
            activeCampaigns: activeCampaigns.length,
            totalBudget,
            totalSpent,
            avgRoi: avgRoi.toFixed(2),
            teamWorkload: Math.round(this.cache.team.reduce((sum, t) => sum + t.workload, 0) / this.cache.team.length || 0)
        };
    }

    async getDashboardData() {
        await this.fetchAllData();
        return this.cache.dashboard;
    }

    async getClients() {
        await this.fetchAllData();
        return this.cache.clients;
    }

    async getCampaigns(clientId = null) {
        await this.fetchAllData();
        if (clientId) return this.cache.campaigns.filter(c => c.clientId === clientId);
        return this.cache.campaigns;
    }

    async getTasks(campaignId = null) {
        await this.fetchAllData();
        if (campaignId) return this.cache.tasks.filter(t => t.campaignId === campaignId);
        return this.cache.tasks;
    }

    async getTeam() {
        await this.fetchAllData();
        return this.cache.team;
    }

    // ---------- CRUD для Клиентов ----------
    async addClient(clientData) {
        const tempId = Date.now();
        const newClient = { id: tempId, status: 'prospect', campaignsCount: 0, totalBudget: 0, ...clientData };

        this.cache.clients.push(newClient);
        this._computeDashboard();
        this._markUpdated();

        try {
            const serverResp = await this._syncToServer('POST', '/clients', clientData);
            if (serverResp && serverResp.id) {
                const idx = this.cache.clients.findIndex(c => c.id === tempId);
                if (idx !== -1) this.cache.clients[idx] = { ...this.cache.clients[idx], ...serverResp };
            }
            await this.fetchAllData(true);
        } catch (error) {
            throw error; // Для notifications.js
        }
        return newClient;
    }

    async updateClient(clientId, changes) {
        const client = this.cache.clients.find(c => c.id === clientId);
        if (!client) throw new Error('Client not found');

        Object.assign(client, changes);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('PUT', `/clients/${clientId}`, client);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return client;
    }

    async deleteClient(clientId) {
        const idx = this.cache.clients.findIndex(c => c.id === clientId);
        if (idx === -1) throw new Error('Client not found');

        this.cache.clients.splice(idx, 1);
        this.cache.campaigns = this.cache.campaigns.filter(c => c.clientId !== clientId);
        this.cache.tasks = this.cache.tasks.filter(t => this.cache.campaigns.some(camp => camp.id === t.campaignId)); // Каскадно
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/clients/${clientId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // ---------- CRUD для Кампаний ----------
    async addCampaign(campaignData) {
        const tempId = Date.now();
        const newCampaign = { id: tempId, status: 'planning', spent: 0, roi: null, ...campaignData };

        this.cache.campaigns.push(newCampaign);
        const client = this.cache.clients.find(c => c.id === campaignData.clientId);
        if (client) {
            client.campaignsCount += 1;
            client.totalBudget += campaignData.budget || 0;
        }
        this._computeDashboard();
        this._markUpdated();

        try {
            const serverResp = await this._syncToServer('POST', '/campaigns', campaignData);
            if (serverResp && serverResp.id) {
                const idx = this.cache.campaigns.findIndex(c => c.id === tempId);
                if (idx !== -1) this.cache.campaigns[idx] = { ...this.cache.campaigns[idx], ...serverResp };
            }
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return newCampaign;
    }

    async updateCampaign(campaignId, changes) {
        const campaign = this.cache.campaigns.find(c => c.id === campaignId);
        if (!campaign) throw new Error('Campaign not found');

        Object.assign(campaign, changes);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('PUT', `/campaigns/${campaignId}`, campaign);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return campaign;
    }

    async deleteCampaign(campaignId) {
        const idx = this.cache.campaigns.findIndex(c => c.id === campaignId);
        if (idx === -1) throw new Error('Campaign not found');

        const clientId = this.cache.campaigns[idx].clientId;
        this.cache.campaigns.splice(idx, 1);
        this.cache.tasks = this.cache.tasks.filter(t => t.campaignId !== campaignId);

        const client = this.cache.clients.find(c => c.id === clientId);
        if (client) client.campaignsCount = Math.max(0, client.campaignsCount - 1);

        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/campaigns/${campaignId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // ---------- CRUD для Задач ----------
    async addTask(taskData) {
        const tempId = Date.now();
        const newTask = {
            id: tempId,
            status: 'todo', // по умолчанию
            ...taskData
        };

        this.cache.tasks.push(newTask);
        this._computeDashboard();
        this._markUpdated();

        try {
            const serverResp = await this._syncToServer('POST', '/tasks', taskData);
            if (serverResp && serverResp.id) {
                const idx = this.cache.tasks.findIndex(t => t.id === tempId);
                if (idx !== -1) this.cache.tasks[idx] = { ...this.cache.tasks[idx], ...serverResp };
            }
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return newTask;
    }

    async updateTask(taskId, changes) {
        const task = this.cache.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');

        Object.assign(task, changes);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('PUT', `/tasks/${taskId}`, task);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return task;
    }

    async deleteTask(taskId) {
        const idx = this.cache.tasks.findIndex(t => t.id === taskId);
        if (idx === -1) throw new Error('Task not found');

        this.cache.tasks.splice(idx, 1);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/tasks/${taskId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // ---------- CRUD для Команды (Сотрудников агентства) ----------
    async addTeamMember(memberData) {
        const tempId = Date.now();
        const newMember = {
            id: tempId,
            workload: 0, // по умолчанию
            ...memberData
        };

        this.cache.team.push(newMember);
        this._computeDashboard();
        this._markUpdated();

        try {
            const serverResp = await this._syncToServer('POST', '/team', memberData);
            if (serverResp && serverResp.id) {
                const idx = this.cache.team.findIndex(m => m.id === tempId);
                if (idx !== -1) this.cache.team[idx] = { ...this.cache.team[idx], ...serverResp };
            }
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return newMember;
    }

    async updateTeamMember(memberId, changes) {
        const member = this.cache.team.find(m => m.id === memberId);
        if (!member) throw new Error('Team member not found');

        Object.assign(member, changes);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('PUT', `/team/${memberId}`, member);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
        return member;
    }

    async deleteTeamMember(memberId) {
        const idx = this.cache.team.findIndex(m => m.id === memberId);
        if (idx === -1) throw new Error('Team member not found');

        // Удаляем назначенные задачи (опционально: можно переназначить, но для MVP просто удаляем)
        this.cache.tasks = this.cache.tasks.filter(t => t.assigneeId !== memberId);

        this.cache.team.splice(idx, 1);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/team/${memberId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // Дополнительные удобные методы (не CRUD, но полезны для UI)
    async getTasksForCampaign(campaignId) {
        await this.fetchAllData();
        return this.cache.tasks.filter(t => t.campaignId === campaignId);
    }

    async getTasksForAssignee(assigneeId) {
        await this.fetchAllData();
        return this.cache.tasks.filter(t => t.assigneeId === assigneeId);
    }

    async recalculateWorkload() {
        // Пример простой логики: workload = (кол-во задач in_progress + todo) * 20%
        this.cache.team.forEach(member => {
            const activeTasks = this.cache.tasks.filter(t =>
                t.assigneeId === member.id && (t.status === 'in_progress' || t.status === 'todo')
            ).length;
            member.workload = Math.min(100, activeTasks * 20);
        });
        this._computeDashboard();
        this._markUpdated();
    }

    clearCache() {
        this.cache = { dashboard: null, clients: [], campaigns: [], tasks: [], team: [], metrics: [], lastUpdated: null };
        try { localStorage.removeItem(this.storageKey); } catch (e) { }
        this._markUpdated();
    }
}

// Initialize and expose globally
if (!window.dataCache) {
    window.dataCache = new DataCache();
}