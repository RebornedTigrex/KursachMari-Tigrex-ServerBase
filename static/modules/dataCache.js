// modules/dataCache.js - Полностью исправленная и расширенная версия Data Cache Module
// Поддерживает все сущности: Clients, Campaigns, Tasks, Team
// Обеспечивает синхронизацию данных между всеми страницами MVP

class DataCache {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'ad_agency_cache_v1';
        this.cache = {
            dashboard: {
                activeClients: 0,
                activeCampaigns: 0,
                totalBudget: 0,
                totalSpent: 0,
                avgRoi: 0,
                teamWorkload: 0
            },
            clients: [],          // {id, name, contact, status, totalBudget, campaignsCount}
            campaigns: [],        // {id, clientId, name, status, budget, spent, startDate, endDate, roi}
            tasks: [],            // {id, campaignId, assigneeId, title, description, status, dueDate}
            team: [],             // {id, fullname, role, workload}
            lastUpdated: null
        };

        this.apiBaseUrl = options.apiBaseUrl || '/api';
        this.enablePersistence = typeof options.enablePersistence === 'boolean' ? options.enablePersistence : true;

        this._loadFromStorage();
    }

    // --- Persistence & helpers ---
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
        window.dispatchEvent(new CustomEvent('dataCache:updated', { detail: { lastUpdated: this.cache.lastUpdated } }));
    }

    _isCacheExpired() {
        if (!this.cache.lastUpdated) return true;
        const diffInMinutes = (Date.now() - new Date(this.cache.lastUpdated)) / (1000 * 60);
        return diffInMinutes > 5; // 5 минут TTL
    }

    async _syncToServer(method, path, body) {
        try {
            const res = await fetch(`${this.apiBaseUrl}${path}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!res.ok) {
                const text = await res.text();
                const error = { status: res.status, statusText: res.statusText, body: text };

                // Специальная обработка 503 — сервер недоступен
                if (res.status === 503) {
                    if (window.notifications) {
                        window.notifications.showWarning(
                            '🔌 Сервер временно недоступен.<br>Приложение переключилось в оффлайн-режим — используются локальные данные.',
                            10000
                        );
                    }
                    // Не бросаем ошибку дальше — позволяем работать с кэшем
                    return null;
                }

                throw error;
            }

            return await res.json();
        } catch (err) {
            // Сетевые ошибки (нет интернета) тоже переводим в warning
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
                if (window.notifications) {
                    window.notifications.showWarning(
                        '🌐 Нет соединения с интернетом.<br>Работаем с локальным кэшем.',
                        10000
                    );
                }
                return null; // Не бросаем — продолжаем с кэшем
            }
            throw err;
        }
    }

    // --- Вычисление дашборда и связанных метрик ---
    _computeDashboard() {
        const activeClients = this.cache.clients.filter(c => c.status === 'active').length;

        const activeCampaigns = this.cache.campaigns.filter(c => c.status === 'running');
        const totalBudget = activeCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
        const totalSpent = activeCampaigns.reduce((sum, c) => sum + (c.spent || 0), 0);

        const completedCampaigns = this.cache.campaigns.filter(c => c.status === 'completed' && c.roi !== undefined);
        const avgRoi = completedCampaigns.length > 0
            ? completedCampaigns.reduce((sum, c) => sum + c.roi, 0) / completedCampaigns.length
            : 0;

        const totalWorkload = this.cache.team.reduce((sum, m) => sum + (m.workload || 0), 0);
        const teamWorkload = this.cache.team.length > 0 ? Math.round(totalWorkload / this.cache.team.length) : 0;

        this.cache.dashboard = {
            activeClients,
            activeCampaigns: activeCampaigns.length,
            totalBudget,
            totalSpent,
            avgRoi: avgRoi.toFixed(2),
            teamWorkload
        };
    }

    recalculateWorkload() {
        this.cache.team.forEach(member => {
            const activeTasks = this.cache.tasks.filter(t =>
                t.assigneeId === member.id && (t.status === 'todo' || t.status === 'in_progress')
            ).length;
            member.workload = Math.min(100, activeTasks * 20); // простая логика для MVP
        });
        this._computeDashboard();
    }

    // --- Public API: загрузка и геттеры ---
    async fetchAllData(forceRefresh = false) {
        if (!forceRefresh && !this._isCacheExpired() && this.cache.clients.length > 0) {
            return this.cache;
        }

        try {
            const serverData = await this._syncToServer('GET', '/all-data');
            this.cache = { ...this.cache, ...serverData };
        } catch (err) {
            console.warn('Network error, using local cache:', err);
        }

        // Если кэш пуст — загружаем мок-данные (для демонстрации MVP)
        if (this.cache.clients.length === 0) {
            this._loadMockData();
        }

        this.recalculateWorkload();
        this._computeDashboard();
        this._markUpdated();
        return this.cache;
    }

    getClients() { return this.cache.clients; }
    getCampaigns() { return this.cache.campaigns; }
    getTasks() { return this.cache.tasks; }
    getTeam() { return this.cache.team; }
    getDashboardData() { return this.cache.dashboard; }

    _loadMockData() {
        this.cache.clients = [
            { id: 1, name: 'Компания А', contact: 'Иван Иванов', status: 'active', totalBudget: 800000, campaignsCount: 3 },
            { id: 2, name: 'Бренд Б', contact: 'Мария Петрова', status: 'active', totalBudget: 450000, campaignsCount: 2 },
            { id: 3, name: 'Стартап В', contact: 'Алексей Сидоров', status: 'prospect', totalBudget: 0, campaignsCount: 0 }
        ];

        this.cache.campaigns = [
            { id: 1, clientId: 1, name: 'Летняя акция', status: 'running', budget: 300000, spent: 150000, startDate: '2025-06-01', endDate: '2025-09-01', roi: null },
            { id: 2, clientId: 1, name: 'Новогодняя', status: 'completed', budget: 500000, spent: 480000, startDate: '2024-12-01', endDate: '2025-01-15', roi: 2.4 },
            { id: 3, clientId: 2, name: 'Ребрендинг', status: 'running', budget: 450000, spent: 200000, startDate: '2025-10-01', endDate: null, roi: null }
        ];

        this.cache.team = [
            { id: 1, fullname: 'Анна Ковалёва', role: 'Аккаунт-менеджер', workload: 60 },
            { id: 2, fullname: 'Дмитрий Смирнов', role: 'Креативный директор', workload: 80 },
            { id: 3, fullname: 'Елена Морозова', role: 'Медиапланер', workload: 40 }
        ];

        this.cache.tasks = [
            { id: 1, campaignId: 1, assigneeId: 1, title: 'Подготовка креативов', description: '', status: 'in_progress', dueDate: '2025-12-30' },
            { id: 2, campaignId: 1, assigneeId: 2, title: 'Утверждение макетов', description: '', status: 'todo', dueDate: '2025-12-28' },
            { id: 3, campaignId: 3, assigneeId: 3, title: 'Медиаплан', description: '', status: 'done', dueDate: '2025-11-15' }
        ];
    }

    // --- CRUD: Clients ---
    async addClient(clientData) {
        const tempId = Date.now();
        const newClient = {
            id: tempId,
            status: 'prospect',
            totalBudget: 0,
            campaignsCount: 0,
            ...clientData
        };

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
            throw error;
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

        // Удаляем связанные кампании и задачи
        const campaignsToDelete = this.cache.campaigns.filter(c => c.clientId === clientId);
        for (const camp of campaignsToDelete) {
            await this.deleteCampaign(camp.id, false); // false — не рекурсивно триггерить fetchAllData
        }

        this.cache.clients.splice(idx, 1);
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/clients/${clientId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // --- CRUD: Campaigns ---
    async addCampaign(campaignData) {
        const tempId = Date.now();
        const newCampaign = {
            id: tempId,
            status: 'planning',
            spent: 0,
            roi: null,
            ...campaignData
        };

        this.cache.campaigns.push(newCampaign);

        // Обновляем клиента
        const client = this.cache.clients.find(c => c.id === newCampaign.clientId);
        if (client) {
            client.campaignsCount++;
            if (newCampaign.status === 'running') {
                client.totalBudget += newCampaign.budget;
            }
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

        const oldStatus = campaign.status;
        const oldBudget = campaign.budget || 0;

        Object.assign(campaign, changes);

        // Пересчитываем бюджет клиента при изменении статуса или бюджета
        const client = this.cache.clients.find(c => c.id === campaign.clientId);
        if (client) {
            if (oldStatus === 'running' && changes.status !== 'running') {
                client.totalBudget -= oldBudget;
            }
            if (changes.status === 'running' && oldStatus !== 'running') {
                client.totalBudget += (changes.budget || campaign.budget || 0);
            }
            if (changes.budget !== undefined && oldStatus === 'running' && changes.status === 'running') {
                client.totalBudget += (changes.budget - oldBudget);
            }
        }

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

    async deleteCampaign(campaignId, refresh = true) {
        const idx = this.cache.campaigns.findIndex(c => c.id === campaignId);
        if (idx === -1) throw new Error('Campaign not found');

        const campaign = this.cache.campaigns[idx];

        // Удаляем связанные задачи
        this.cache.tasks = this.cache.tasks.filter(t => t.campaignId !== campaignId);

        // Обновляем клиента
        const client = this.cache.clients.find(c => c.id === campaign.clientId);
        if (client) {
            client.campaignsCount--;
            if (campaign.status === 'running') {
                client.totalBudget -= (campaign.budget || 0);
            }
        }

        this.cache.campaigns.splice(idx, 1);
        this.recalculateWorkload();
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/campaigns/${campaignId}`);
            if (refresh) await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // --- CRUD: Tasks (оставлены без изменений, но добавлен пересчёт workload) ---
    async addTask(taskData) {
        const tempId = Date.now();
        const newTask = { id: tempId, status: 'todo', ...taskData };

        this.cache.tasks.push(newTask);
        this.recalculateWorkload();
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
        this.recalculateWorkload();
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
        this.recalculateWorkload();
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/tasks/${taskId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    // --- CRUD: Team ---
    async addTeamMember(memberData) {
        const tempId = Date.now();
        const newMember = { id: tempId, workload: 0, ...memberData };

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

        // Снимаем задачи с удалённого сотрудника
        this.cache.tasks = this.cache.tasks.map(t => t.assigneeId === memberId ? { ...t, assigneeId: null } : t);

        this.cache.team.splice(idx, 1);
        this.recalculateWorkload();
        this._computeDashboard();
        this._markUpdated();

        try {
            await this._syncToServer('DELETE', `/team/${memberId}`);
            await this.fetchAllData(true);
        } catch (error) {
            throw error;
        }
    }

    clearCache() {
        this.cache = {
            dashboard: { activeClients: 0, activeCampaigns: 0, totalBudget: 0, totalSpent: 0, avgRoi: 0, teamWorkload: 0 },
            clients: [], campaigns: [], tasks: [], team: [], lastUpdated: null
        };
        localStorage.removeItem(this.storageKey);
        this._markUpdated();
    }
}

// Глобальная инициализация
if (!window.dataCache) {
    window.dataCache = new DataCache({ enablePersistence: true });
}