// 闭包封装，避免全局变量污染
(function(window, document) {
    'use strict';

    // ====================== 【仅需修改这里！WebDAV配置】 ======================
    const WEBDAV_CONFIG = {
        // 1. 你的 WebDAV 地址（以 / 结尾，指向存放data.json的目录）
        url: "https://dav-nutstore.jianguoyun.com/dav/萤鳏/",
        // 2. WebDAV 账号
        user: "404268045@qq.com",
        // 3. WebDAV 密码
        pass: "atn56mc65uwpbdcd",
        // 云端数据文件名（不用改）
        fileName: "firefly_gold_data.json"
    };
    // =========================================================================

    // ========== 1. 常量与DOM缓存（性能优化：减少重复DOM查询） ==========
    const CONFIG = window.FIREFLY_CONFIG;
    const DOM = {
        backToTop: document.getElementById('backToTop'),
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        addAccountBtn: document.getElementById('addAccountBtn'),
        exportDataBtn: document.getElementById('exportDataBtn'),
        importDataBtn: document.getElementById('importDataBtn'),
        importFile: document.getElementById('importFile'),
        birdviewBtns: document.getElementById('birdviewBtns'),
        birdviewModal: document.getElementById('birdviewModal'),
        birdviewTitle: document.getElementById('birdviewTitle'),
        birdviewContent: document.getElementById('birdviewContent'),
        closeBirdviewBtn: document.getElementById('closeBirdviewBtn'),
        idFilter: document.getElementById('idFilter'),
        sortGoldAsc: document.getElementById('sortGoldAsc'),
        sortGoldDesc: document.getElementById('sortGoldDesc'),
        sortId: document.getElementById('sortId'),
        accountsContainer: document.getElementById('accountsContainer'),
        totalGold: document.getElementById('totalGold'),
        totalTaskRate: document.getElementById('totalTaskRate'),
        totalCompletedCount: document.getElementById('totalCompletedCount'),
        dailyTaskRate: document.getElementById('dailyTaskRate'),
        dailyCompletedCount: document.getElementById('dailyCompletedCount'),
        weeklyTaskRate: document.getElementById('weeklyTaskRate'),
        weeklyCompletedCount: document.getElementById('weeklyCompletedCount'),
        dailyCountdown: document.getElementById('dailyCountdown'),
        weeklyCountdown: document.getElementById('weeklyCountdown'),
        landscapeTip: document.getElementById('landscapeTip') // 横屏提示DOM
    };

    // 状态管理（精简：合并冗余状态）
    const state = {
        originalData: [],
        filteredAccounts: null,
        currentSort: 'default',
        currentBirdviewTask: null,
        activeSortBtn: null,
        isSyncing: false // 新增：同步状态锁，避免重复同步
    };

    // ========== 新增：WebDAV同步核心模块 ==========
    const SyncManager = {
        // 获取云端文件完整路径
        getFullFilePath() {
            return WEBDAV_CONFIG.url + WEBDAV_CONFIG.fileName;
        },

        // 生成认证头
        getAuthHeader() {
            return 'Basic ' + btoa(WEBDAV_CONFIG.user + ':' + WEBDAV_CONFIG.pass);
        },

        // 从云端拉取数据（核心：替代原localStorage读取）
        async pullData() {
            try {
                const response = await fetch(this.getFullFilePath(), {
                    method: 'GET',
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });

                if (response.status === 404) {
                    // 云端无文件，返回空数组
                    console.log('云端无数据文件，初始化空数据');
                    return [];
                }

                if (!response.ok) {
                    throw new Error(`同步失败：${response.status} ${response.statusText}`);
                }

                const text = await response.text();
                return text ? JSON.parse(text) : [];
            } catch (error) {
                console.error('拉取云端数据失败：', error);
                // 失败时降级使用本地缓存（避免数据丢失）
                const localData = localStorage.getItem(CONFIG.storageKey);
                return localData ? JSON.parse(localData) : [];
            }
        },

        // 上传数据到云端（核心：替代原localStorage保存）
        async pushData(data) {
            if (state.isSyncing) return; // 避免重复同步
            state.isSyncing = true;

            try {
                // 先备份到本地（双重保障）
                localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
                
                const response = await fetch(this.getFullFilePath(), {
                    method: 'PUT',
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    body: JSON.stringify(data, null, 2),
                    timeout: 10000
                });

                if (!response.ok) {
                    throw new Error(`上传失败：${response.status} ${response.statusText}`);
                }

                console.log('✅ 数据已同步到云端');
                state.originalData = [...data];
            } catch (error) {
                console.error('上传云端数据失败：', error);
                alert(`同步云端失败（已本地备份）：${error.message}`);
            } finally {
                state.isSyncing = false;
            }
        }
    };

    // ========== 2. 工具函数（保留所有原有功能） ==========
    const Utils = {
        /**
         * 防抖函数（优化：支持立即执行）
         * @param {Function} fn 执行函数
         * @param {Number} delay 延迟时间
         * @param {Boolean} immediate 是否立即执行
         * @returns {Function} 防抖函数
         */
        debounce(fn, delay = 500, immediate = false) {
            let timer = null;
            return function(...args) {
                const context = this;
                if (timer) clearTimeout(timer);
                if (immediate && !timer) {
                    fn.apply(context, args);
                }
                timer = setTimeout(() => {
                    fn.apply(context, args);
                    timer = null;
                }, delay);
            };
        },

        /**
         * 格式化数字（优化：处理NaN）
         * @param {Number|String} num 数字
         * @returns {String} 格式化后的数字
         */
        formatNumber(num) {
            const n = Number(num) || 0;
            return n.toLocaleString();
        },

        /**
         * 格式化倒计时
         * @param {Number} ms 毫秒数
         * @returns {String} 格式化后的倒计时
         */
        formatCountdown(ms) {
            const days = Math.floor(ms / (1000 * 60 * 60 * 24));
            const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((ms % (1000 * 60)) / 1000);
            return `${days > 0 ? `${days}天` : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        },

        /**
         * 获取重置时间
         * @param {String} type 类型：daily/weekly
         * @returns {Date} 重置时间
         */
        getNextResetTime(type) {
            const now = new Date();
            const resetTime = new Date(now);
            
            if (type === 'daily') {
                resetTime.setHours(CONFIG.resetTime.dailyHour, 0, 0, 0);
                if (now >= resetTime) resetTime.setDate(resetTime.getDate() + 1);
            } else if (type === 'weekly') {
                resetTime.setHours(CONFIG.resetTime.weeklyHour, 0, 0, 0);
                const dayDiff = CONFIG.resetTime.weeklyWeekDay - now.getDay();
                const dayAdd = dayDiff < 0 || (dayDiff === 0 && now >= resetTime) ? dayDiff + 7 : dayDiff;
                resetTime.setDate(resetTime.getDate() + dayAdd);
            }
            
            return resetTime;
        },

        /**
         * 检查任务完成状态
         * @param {Object} role 角色数据
         * @param {String} type 类型：daily/weekly/all
         * @returns {Boolean} 是否完成
         */
        checkTaskCompleted(role, type) {
            if (type === 'daily') {
                return CONFIG.tasks.daily.every(task => role[task.key]);
            } else if (type === 'weekly') {
                return CONFIG.tasks.weekly.every(task => role[task.key]);
            } else {
                return this.checkTaskCompleted(role, 'daily') && this.checkTaskCompleted(role, 'weekly');
            }
        },

        /**
         * 安全的类型转换（避免NaN）
         * @param {*} value 要转换的值
         * @param {String} type 类型：number/string/boolean
         * @returns {*} 转换后的值
         */
        safeConvert(value, type) {
            switch(type) {
                case 'number':
                    return Number(value) || 0;
                case 'string':
                    return (value || '').toString().trim();
                case 'boolean':
                    return !!value;
                default:
                    return value;
            }
        }
    };

    // ========== 3. 数据管理（修改同步逻辑，保留所有原有功能） ==========
    const DataManager = {
        data: [],
        saveDebounced: null,

        /**
         * 初始化数据（修改：从云端拉取）
         */
        async init() {
            // 初始化防抖保存函数（改为同步到云端）
            this.saveDebounced = Utils.debounce(this.saveToCloud.bind(this), CONFIG.debounceDelay);
            
            // 从云端拉取数据（替代原localStorage读取）
            this.data = await SyncManager.pullData();
            state.originalData = [...this.data];
            
            // 检查并重置任务（保留原有逻辑）
            this.checkAndResetTasks();
            
            // 更新统计数据（保留原有逻辑）
            this.updateAllStats();
        },

        /**
         * 检查并重置任务（保留所有原有逻辑）
         */
        checkAndResetTasks() {
            const now = new Date();
            const lastReset = JSON.parse(localStorage.getItem('firefly_last_reset') || '{"daily":0,"weekly":0}');
            let needSave = false;

            // 每日重置
            if (now >= Utils.getNextResetTime('daily') || new Date(lastReset.daily) < Utils.getNextResetTime('daily')) {
                this.data.forEach(account => {
                    account?.slots?.forEach(role => {
                        CONFIG.tasks.daily.forEach(task => {
                            role[task.key] = false;
                        });
                    });
                });
                lastReset.daily = now.getTime();
                needSave = true;
            }

            // 每周重置
            if (now >= Utils.getNextResetTime('weekly') || new Date(lastReset.weekly) < Utils.getNextResetTime('weekly')) {
                this.data.forEach(account => {
                    account?.slots?.forEach(role => {
                        CONFIG.tasks.weekly.forEach(task => {
                            role[task.key] = false;
                        });
                    });
                });
                lastReset.weekly = now.getTime();
                needSave = true;
            }

            // 仅在需要时更新存储（性能优化：减少写操作）
            if (needSave) {
                localStorage.setItem('firefly_last_reset', JSON.stringify(lastReset));
                this.saveDebounced();
            }
        },

        /**
         * 保存数据到云端（替代原saveToStorage）
         */
        async saveToCloud() {
            await SyncManager.pushData(this.data);
        },

        /**
         * 更新所有统计数据（保留所有原有逻辑）
         */
        updateAllStats() {
            let totalGold = 0;
            let totalTasks = 0;
            let completedTasks = 0;
            let totalRoles = 0;
            let dailyCompletedRoles = 0;
            let weeklyCompletedRoles = 0;

            // 遍历数据（优化：for循环比forEach性能更好）
            for (let i = 0; i < this.data.length; i++) {
                const account = this.data[i];
                if (!account?.slots) continue;

                for (let j = 0; j < account.slots.length; j++) {
                    const role = account.slots[j];
                    if (!role) continue;

                    // 累计金条
                    totalGold += Utils.safeConvert(role.gold, 'number');
                    totalRoles++;

                    // 任务统计
                    const dailyTasks = CONFIG.tasks.daily.length;
                    const weeklyTasks = CONFIG.tasks.weekly.length;
                    totalTasks += dailyTasks + weeklyTasks;

                    // 完成的任务数
                    let roleCompletedTasks = 0;
                    CONFIG.tasks.daily.forEach(task => {
                        if (role[task.key]) roleCompletedTasks++;
                    });
                    CONFIG.tasks.weekly.forEach(task => {
                        if (role[task.key]) roleCompletedTasks++;
                    });
                    completedTasks += roleCompletedTasks;

                    // 完成的角色数
                    if (Utils.checkTaskCompleted(role, 'daily')) dailyCompletedRoles++;
                    if (Utils.checkTaskCompleted(role, 'weekly')) weeklyCompletedRoles++;
                }
            }

            // 计算完成率（避免除以0）
            const totalTaskRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            const dailyTaskRate = totalRoles > 0 ? (dailyCompletedRoles / totalRoles) * 100 : 0;
            const weeklyTaskRate = totalRoles > 0 ? (weeklyCompletedRoles / totalRoles) * 100 : 0;

            // 批量更新DOM（减少重绘）
            DOM.totalGold.textContent = Utils.formatNumber(totalGold);
            DOM.totalTaskRate.textContent = `${totalTaskRate.toFixed(1)}%`;
            DOM.totalCompletedCount.textContent = totalRoles > 0 ? dailyCompletedRoles : 0;
            DOM.dailyTaskRate.textContent = `${dailyTaskRate.toFixed(1)}%`;
            DOM.dailyCompletedCount.textContent = dailyCompletedRoles;
            DOM.weeklyTaskRate.textContent = `${weeklyTaskRate.toFixed(1)}%`;
            DOM.weeklyCompletedCount.textContent = weeklyCompletedRoles;
        },

        /**
         * 获取数据（支持筛选）（保留所有原有逻辑）
         * @returns {Array} 数据列表
         */
        getAll() {
            return state.filteredAccounts || this.data;
        },

        /**
         * 添加账号（保留所有原有逻辑）
         * @param {Object} account 账号数据
         */
        add(account) {
            this.data.push(account);
            this.saveDebounced();
        },

        /**
         * 更新账号信息（保留所有原有逻辑）
         * @param {Number} index 索引
         * @param {String} key 键名
         * @param {*} value 值
         */
        updateAccount(index, key, value) {
            if (this.data[index]) {
                this.data[index][key] = value;
                this.saveDebounced();
            }
        },

        /**
         * 更新角色信息（保留所有原有逻辑）
         * @param {Number} accountIndex 账号索引
         * @param {Number} roleIdx 角色索引
         * @param {String} key 键名
         * @param {*} value 值
         */
        updateRole(accountIndex, roleIdx, key, value) {
            if (this.data[accountIndex]?.slots[roleIdx]) {
                // 金条字段特殊处理
                const val = key === 'gold' ? Utils.safeConvert(value, 'number') : value;
                this.data[accountIndex].slots[roleIdx][key] = val;
                this.saveDebounced();
                
                // 更新鸟瞰图
                if (state.currentBirdviewTask) {
                    BirdViewManager.render(state.currentBirdviewTask);
                }
                
                // 更新统计
                this.updateAllStats();
            }
        },

        /**
         * 更新鸟瞰图任务状态（保留所有原有逻辑）
         * @param {Number} accountIndex 账号索引
         * @param {Number} roleIdx 角色索引
         * @param {String} taskKey 任务键名
         * @param {Boolean} completed 是否完成
         */
        updateBirdviewTask(accountIndex, roleIdx, taskKey, completed) {
            this.updateRole(accountIndex, roleIdx, taskKey, completed);
            Renderer.renderAll();
        },

        /**
         * 删除账号（保留所有原有逻辑）
         * @param {Number} index 索引
         */
        delete(index) {
            if (this.data[index]) {
                this.data.splice(index, 1);
                this.saveDebounced();
            }
        },

        /**
         * 一键完成任务（保留所有原有逻辑）
         * @param {Number} accountIndex 账号索引
         * @param {String} taskKey 任务键名
         */
        onekeyCheck(accountIndex, taskKey) {
            if (this.data[accountIndex]?.slots) {
                this.data[accountIndex].slots.forEach(role => {
                    role[taskKey] = true;
                });
                this.saveDebounced();
                Renderer.renderAll();
                this.updateAllStats();
            }
        },

        /**
         * 创建空角色（保留所有原有逻辑）
         * @returns {Object} 空角色数据
         */
        createEmptyRole() {
            const role = { name: '', gold: 0, server: '' };
            // 初始化所有任务为未完成
            [...CONFIG.tasks.daily, ...CONFIG.tasks.weekly].forEach(task => {
                role[task.key] = false;
            });
            return role;
        }
    };

    // ========== 4. 倒计时管理（保留所有原有逻辑） ==========
    const CountdownManager = {
        timer: null,

        /**
         * 初始化倒计时
         */
        init() {
            this.update();
            // 每分钟更新一次（性能优化：减少定时器执行频率）
            this.timer = setInterval(this.update.bind(this), 60 * 1000);
        },

        /**
         * 更新倒计时
         */
        update() {
            const now = new Date();
            const dailyMs = Utils.getNextResetTime('daily').getTime() - now.getTime();
            const weeklyMs = Utils.getNextResetTime('weekly').getTime() - now.getTime();
            
            DOM.dailyCountdown.textContent = Utils.formatCountdown(dailyMs);
            DOM.weeklyCountdown.textContent = Utils.formatCountdown(weeklyMs);
        },

        /**
         * 销毁倒计时
         */
        destroy() {
            if (this.timer) clearInterval(this.timer);
        }
    };

    // ========== 5. 搜索与筛选（保留所有原有逻辑） ==========
    const SearchManager = {
        /**
         * 搜索数据
         */
        doSearch() {
            const keyword = Utils.safeConvert(DOM.searchInput.value, 'string').toLowerCase();
            
            if (!keyword) {
                state.filteredAccounts = null;
                Renderer.renderAll();
                return;
            }

            // 筛选数据（优化：提前终止循环）
            state.filteredAccounts = DataManager.data.filter(account => {
                // 账号ID匹配
                if (account.id && account.id.toLowerCase().includes(keyword)) return true;
                
                // 区服匹配
                if (account.slots[0]?.server && account.slots[0].server.toLowerCase().includes(keyword)) return true;
                
                // 角色名匹配
                for (let i = 0; i < account.slots.length; i++) {
                    if (account.slots[i]?.name && account.slots[i].name.toLowerCase().includes(keyword)) {
                        return true;
                    }
                }
                
                return false;
            });

            Renderer.renderAll();
        },

        /**
         * 按账号ID筛选
         */
        filterById() {
            const selectedId = DOM.idFilter.value;
            
            if (selectedId === 'all') {
                state.filteredAccounts = null;
            } else {
                state.filteredAccounts = DataManager.data.filter(account => account.id === selectedId);
            }
            
            Renderer.renderAll();
        },

        /**
         * 更新账号筛选下拉框
         */
        updateIdFilter() {
            // 清空原有选项（保留第一个）
            DOM.idFilter.innerHTML = '<option value="all">全部账号</option>';
            
            // 获取唯一账号ID（优化：使用Set去重）
            const accountIds = [...new Set(DataManager.data.map(account => account.id).filter(Boolean))];
            
            // 添加选项
            accountIds.forEach(id => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = id;
                DOM.idFilter.appendChild(option);
            });
        }
    };

    // ========== 6. 排序管理（保留所有原有逻辑） ==========
    const SortManager = {
        /**
         * 按金条升序排序
         */
        sortByGoldAsc() {
            this.sort('gold', 'asc');
        },

        /**
         * 按金条降序排序
         */
        sortByGoldDesc() {
            this.sort('gold', 'desc');
        },

        /**
         * 按账号ID排序
         */
        sortById() {
            this.sort('id', 'asc');
        },

        /**
         * 通用排序方法（优化：复用逻辑）
         * @param {String} type 排序类型：gold/id
         * @param {String} order 排序方向：asc/desc
         */
        sort(type, order) {
            // 重置排序状态
            if (state.currentSort === `${type}-${order}`) {
                state.currentSort = 'default';
                state.filteredAccounts = null;
                this.resetActiveBtn();
                Renderer.renderAll();
                return;
            }

            // 设置排序状态
            state.currentSort = `${type}-${order}`;
            const sortedData = [...DataManager.data];

            // 执行排序
            sortedData.sort((a, b) => {
                if (type === 'gold') {
                    // 计算账号总金条
                    const goldA = a.slots.reduce((sum, role) => sum + Utils.safeConvert(role.gold, 'number'), 0);
                    const goldB = b.slots.reduce((sum, role) => sum + Utils.safeConvert(role.gold, 'number'), 0);
                    return order === 'asc' ? goldA - goldB : goldB - goldA;
                } else if (type === 'id') {
                    return a.id.localeCompare(b.id, 'zh-CN');
                }
                return 0;
            });

            // 更新筛选数据
            state.filteredAccounts = sortedData;
            
            // 更新激活按钮
            this.setActiveBtn(`sort${type === 'gold' ? 'Gold' : 'Id'}${order === 'asc' ? 'Asc' : 'Desc'}`);
            
            // 渲染
            Renderer.renderAll();
        },

        /**
         * 设置激活的排序按钮
         * @param {String} btnId 按钮ID
         */
        setActiveBtn(btnId) {
            this.resetActiveBtn();
            state.activeSortBtn = btnId;
            const btn = document.getElementById(btnId);
            if (btn) btn.style.opacity = '0.8';
        },

        /**
         * 重置排序按钮状态
         */
        resetActiveBtn() {
            [DOM.sortGoldAsc, DOM.sortGoldDesc, DOM.sortId].forEach(btn => {
                btn.style.opacity = '1';
            });
            state.activeSortBtn = null;
        }
    };

    // ========== 7. 拖拽管理（保留所有原有逻辑） ==========
    const DragManager = {
        draggedIndex: -1,

        /**
         * 初始化拖拽
         */
        init() {
            const handles = DOM.accountsContainer.querySelectorAll('.drag-handle');
            
            // 绑定拖拽事件（优化：事件委托替代逐个绑定）
            handles.forEach((handle, index) => {
                handle.setAttribute('data-index', index);
                handle.setAttribute('draggable', 'true');
                
                handle.addEventListener('dragstart', (e) => {
                    this.draggedIndex = parseInt(handle.dataset.index, 10);
                    const card = handle.closest('.account-card');
                    if (card) card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });

                handle.addEventListener('dragend', () => {
                    const card = handle.closest('.account-card');
                    if (card) card.classList.remove('dragging');
                    this.draggedIndex = -1;
                });
            });

            // 绑定放置事件
            DOM.accountsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            DOM.accountsContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.draggedIndex === -1) return;

                // 获取目标索引
                const targetCard = e.target.closest('.account-card');
                if (!targetCard) return;
                
                const targetIndex = parseInt(targetCard.dataset.index, 10);
                if (this.draggedIndex === targetIndex) return;

                // 交换数据
                const temp = DataManager.data[this.draggedIndex];
                DataManager.data[this.draggedIndex] = DataManager.data[targetIndex];
                DataManager.data[targetIndex] = temp;
                
                // 保存并重新渲染
                DataManager.saveDebounced();
                Renderer.renderAll();
            });
        }
    };

    // ========== 8. 导入导出（保留所有原有逻辑） ==========
    const ImportExportManager = {
        /**
         * 导出数据
         */
        exportData() {
            try {
                const dataStr = JSON.stringify(DataManager.data, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `萤鳏金条管家备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
                document.body.appendChild(a);
                a.click();
                
                // 清理
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('导出失败：' + err.message);
                console.error('导出数据失败：', err);
            }
        },

        /**
         * 触发导入文件选择
         */
        triggerImport() {
            DOM.importFile.click();
        },

        /**
         * 导入数据
         * @param {File} file 导入文件
         */
        handleImport(file) {
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data)) {
                        alert('导入失败：文件格式错误（非数组）');
                        return;
                    }

                    // 更新数据
                    DataManager.data = data;
                    DataManager.saveDebounced();
                    
                    // 更新界面
                    alert('数据导入成功！');
                    Renderer.renderAll();
                    DataManager.updateAllStats();
                    SearchManager.updateIdFilter();
                } catch (err) {
                    alert('导入失败：' + err.message);
                    console.error('导入数据失败：', err);
                }
            };
            
            reader.readAsText(file);
        }
    };

    // ========== 9. 账号管理（保留所有原有逻辑） ==========
    const AccountManager = {
        /**
         * 添加新账号
         */
        addNew() {
            const id = prompt('请输入账号ID（邮箱/昵称）：');
            const trimmedId = Utils.safeConvert(id, 'string');
            
            // 生成默认ID
            let accountId = trimmedId;
            if (!accountId) {
                const defaultId = `账号${Date.now().toString().slice(-6)}`;
                if (!confirm(`账号ID不能为空，是否使用默认ID：${defaultId}？`)) {
                    return;
                }
                accountId = defaultId;
            }

            // 创建新账号
            const newAccount = {
                id: accountId,
                slots: Array(CONFIG.defaultRoleCount).fill(null).map(() => DataManager.createEmptyRole())
            };

            // 添加并更新界面
            DataManager.add(newAccount);
            Renderer.renderAll();
            SearchManager.updateIdFilter();
        },

        /**
         * 删除账号
         * @param {Number} index 索引
         */
        delete(index) {
            if (!confirm('确定要删除该账号吗？删除后数据无法恢复！')) return;
            
            // 删除并更新界面
            DataManager.delete(index);
            state.filteredAccounts = null;
            state.currentSort = 'default';
            SortManager.resetActiveBtn();
            Renderer.renderAll();
            SearchManager.updateIdFilter();
            DataManager.updateAllStats();
        }
    };

    // ========== 10. 鸟瞰图管理（保留所有原有逻辑） ==========
    const BirdViewManager = {
        /**
         * 初始化鸟瞰图
         */
        init() {
            // 绑定鸟瞰图按钮事件（事件委托）
            DOM.birdviewBtns.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-birdview');
                if (btn) {
                    const taskKey = btn.dataset.task;
                    this.open(taskKey);
                }
            });

            // 绑定关闭按钮事件
            DOM.closeBirdviewBtn.addEventListener('click', this.close.bind(this));

            // 鸟瞰图复选框事件委托（性能优化：减少事件监听器）
            DOM.birdviewContent.addEventListener('change', (e) => {
                const checkbox = e.target.closest('.birdview-check');
                if (checkbox) {
                    const { accountIndex, roleIdx, taskKey } = checkbox.dataset;
                    DataManager.updateBirdviewTask(
                        parseInt(accountIndex, 10),
                        parseInt(roleIdx, 10),
                        taskKey,
                        checkbox.checked
                    );
                }
            });
        },

        /**
         * 打开鸟瞰图
         * @param {String} taskKey 任务键名
         */
        open(taskKey) {
            state.currentBirdviewTask = taskKey;
            
            // 更新按钮状态
            DOM.birdviewBtns.querySelectorAll('.btn-birdview').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.task === taskKey);
            });

            // 更新标题并渲染
            DOM.birdviewTitle.textContent = `${this.getTaskName(taskKey)}任务 - 鸟瞰视图`;
            this.render(taskKey);
            
            // 显示模态框
            DOM.birdviewModal.classList.add('show');
        },

        /**
         * 关闭鸟瞰图
         */
        close() {
            state.currentBirdviewTask = null;
            DOM.birdviewBtns.querySelectorAll('.btn-birdview').forEach(btn => {
                btn.classList.remove('active');
            });
            DOM.birdviewModal.classList.remove('show');
        },

        /**
         * 渲染鸟瞰图（优化：文档片段减少重绘）
         * @param {String} taskKey 任务键名
         */
        render(taskKey) {
            const fragment = document.createDocumentFragment();
            let roleCount = 0;

            // 无数据提示
            if (DataManager.data.length === 0) {
                const emptyTip = document.createElement('div');
                emptyTip.className = 'empty-tip';
                emptyTip.style.gridColumn = '1/-1';
                emptyTip.textContent = '暂无账号数据';
                fragment.appendChild(emptyTip);
                DOM.birdviewContent.innerHTML = '';
                DOM.birdviewContent.appendChild(fragment);
                return;
            }

            // 遍历数据生成鸟瞰图项
            for (let i = 0; i < DataManager.data.length && roleCount < 100; i++) {
                const account = DataManager.data[i];
                if (!account?.slots) continue;

                for (let j = 0; j < account.slots.length && roleCount < 100; j++) {
                    const role = account.slots[j];
                    if (!role?.name) continue;

                    // 创建鸟瞰图项
                    const item = document.createElement('div');
                    item.className = 'birdview-item';

                    // 角色名
                    const roleName = document.createElement('div');
                    roleName.className = 'birdview-role';
                    roleName.textContent = role.name;
                    item.appendChild(roleName);

                    // 复选框
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'birdview-check';
                    checkbox.checked = !!role[taskKey];
                    // 存储索引数据
                    checkbox.dataset.accountIndex = i;
                    checkbox.dataset.roleIdx = j;
                    checkbox.dataset.taskKey = taskKey;
                    item.appendChild(checkbox);

                    // 添加到文档片段
                    fragment.appendChild(item);
                    roleCount++;
                }
            }

            // 无有效角色提示
            if (roleCount === 0) {
                const emptyTip = document.createElement('div');
                emptyTip.className = 'empty-tip';
                emptyTip.style.gridColumn = '1/-1';
                emptyTip.textContent = '暂无有效角色数据';
                fragment.appendChild(emptyTip);
            }

            // 批量更新DOM（减少重绘）
            DOM.birdviewContent.innerHTML = '';
            DOM.birdviewContent.appendChild(fragment);
        },

        /**
         * 获取任务名称
         * @param {String} taskKey 任务键名
         * @returns {String} 任务名称
         */
        getTaskName(taskKey) {
            const allTasks = [...CONFIG.tasks.daily, ...CONFIG.tasks.weekly];
            const task = allTasks.find(t => t.key === taskKey);
            return task?.name || '未知';
        }
    };

    // ========== 11. 渲染管理（保留所有原有逻辑） ==========
    const Renderer = {
        /**
         * 渲染所有账号卡片
         */
        renderAll() {
            const accounts = DataManager.getAll();
            const fragment = document.createDocumentFragment();

            // 无数据提示
            if (accounts.length === 0) {
                const emptyTip = document.createElement('div');
                emptyTip.className = 'empty-tip';
                emptyTip.textContent = '暂无账号数据';
                fragment.appendChild(emptyTip);
                DOM.accountsContainer.innerHTML = '';
                DOM.accountsContainer.appendChild(fragment);
                return;
            }

            // 生成账号卡片
            accounts.forEach((account, index) => {
                const card = this.createCard(account, index);
                card.dataset.index = index;
                fragment.appendChild(card);
            });

            // 批量更新DOM
            DOM.accountsContainer.innerHTML = '';
            DOM.accountsContainer.appendChild(fragment);

            // 初始化拖拽
            DragManager.init();
        },

        /**
         * 创建账号卡片（优化：字符串拼接减少DOM操作）
         * @param {Object} account 账号数据
         * @param {Number} index 索引
         * @returns {HTMLElement} 账号卡片
         */
        createCard(account, index) {
            const card = document.createElement('div');
            card.className = 'account-card';

            // 生成一键操作按钮
            const allTasks = [...CONFIG.tasks.daily, ...CONFIG.tasks.weekly];
            const onekeyBtns = allTasks.map(task => `
                <button class="onekey-btn" onclick="DataManager.onekeyCheck(${index}, '${task.key}')">${task.name}</button>
            `).join('');

            // 生成角色行
            let roleRows = '';
            account.slots.forEach((role, roleIdx) => {
                // 生成任务复选框
                const taskTds = allTasks.map(task => `
                    <td>
                        <input type="checkbox" class="task-check ${CONFIG.tasks.daily.includes(task) ? 'daily' : 'weekly'}" 
                               ${role[task.key] ? 'checked' : ''}
                               onchange="DataManager.updateRole(${index}, ${roleIdx}, '${task.key}', this.checked)">
                    </td>
                `).join('');

                // 角色行HTML
                if (roleIdx === 0) {
                    roleRows += `
                        <tr>
                            <td class="col-server server-cell" rowspan="${account.slots.length}">
                                <input type="text" value="${role.server || ''}" 
                                       onchange="DataManager.updateRole(${index}, ${roleIdx}, 'server', this.value)"
                                       placeholder="区服">
                            </td>
                            <td class="col-role role-cell">
                                <input type="text" value="${role.name || ''}" 
                                       onchange="DataManager.updateRole(${index}, ${roleIdx}, 'name', this.value)"
                                       placeholder="角色名">
                            </td>
                            ${taskTds}
                            <td class="col-gold gold-cell">
                                <input type="text" value="${role.gold || ''}" 
                                       onkeydown="Utils.onlyNumberInput(event)"
                                       onchange="DataManager.updateRole(${index}, ${roleIdx}, 'gold', this.value)"
                                       placeholder="金条数">
                            </td>
                        </tr>
                    `;
                } else {
                    roleRows += `
                        <tr>
                            <td class="col-role role-cell">
                                <input type="text" value="${role.name || ''}" 
                                       onchange="DataManager.updateRole(${index}, ${roleIdx}, 'name', this.value)"
                                       placeholder="角色名">
                            </td>
                            ${taskTds}
                            <td class="col-gold gold-cell">
                                <input type="text" value="${role.gold || ''}" 
                                       onkeydown="Utils.onlyNumberInput(event)"
                                       onchange="DataManager.updateRole(${index}, ${roleIdx}, 'gold', this.value)"
                                       placeholder="金条数">
                            </td>
                        </tr>
                    `;
                }
            });

            // 生成表头
            const taskThs = allTasks.map(task => `
                <th class="task-${CONFIG.tasks.daily.includes(task) ? 'daily' : 'weekly'}">${task.name}</th>
            `).join('');

            // 卡片HTML
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-header-left">
                        <div class="drag-handle">☰</div>
                        <div class="account-id-input">
                            <input type="text" value="${account.id || ''}" 
                                   onchange="DataManager.updateAccount(${index}, 'id', this.value)"
                                   placeholder="账号ID/邮箱">
                        </div>
                        <div class="onekey-group">${onekeyBtns}</div>
                    </div>
                    <button class="btn btn-danger" onclick="AccountManager.delete(${index})">删除账号</button>
                </div>
                <table class="role-table">
                    <thead>
                        <tr>
                            <th class="col-server">区服</th>
                            <th class="col-role">角色名</th>
                            ${taskThs}
                            <th class="col-gold">金条总数</th>
                        </tr>
                    </thead>
                    <tbody>${roleRows}</tbody>
                </table>
            `;

            return card;
        }
    };

    // ========== 12. 事件绑定与初始化（修改init为异步，保留所有原有逻辑） ==========
    const init = async () => {
        // 验证配置
        if (!CONFIG) {
            alert('配置文件加载失败！');
            return;
        }

        // 初始化数据（改为异步从云端拉取）
        await DataManager.init();

        // 初始化倒计时
        CountdownManager.init();

        // 初始化鸟瞰图
        BirdViewManager.init();

        // 绑定全局事件
        // 返回顶部按钮
        window.addEventListener('scroll', () => {
            DOM.backToTop.classList.toggle('show', window.scrollY > 300);
        });
        DOM.backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // 搜索事件
        DOM.searchBtn.addEventListener('click', SearchManager.doSearch.bind(SearchManager));
        DOM.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') SearchManager.doSearch();
        });

        // 筛选事件
        DOM.idFilter.addEventListener('change', SearchManager.filterById.bind(SearchManager));

        // 排序事件
        DOM.sortGoldAsc.addEventListener('click', SortManager.sortByGoldAsc.bind(SortManager));
        DOM.sortGoldDesc.addEventListener('click', SortManager.sortByGoldDesc.bind(SortManager));
        DOM.sortId.addEventListener('click', SortManager.sortById.bind(SortManager));

        // 账号操作事件
        DOM.addAccountBtn.addEventListener('click', AccountManager.addNew.bind(AccountManager));
        DOM.exportDataBtn.addEventListener('click', ImportExportManager.exportData.bind(ImportExportManager));
        DOM.importDataBtn.addEventListener('click', ImportExportManager.triggerImport.bind(ImportExportManager));
        DOM.importFile.addEventListener('change', (e) => {
            ImportExportManager.handleImport(e.target.files[0]);
            // 重置文件选择
            e.target.value = '';
        });

        // 初始渲染
        Renderer.renderAll();
        SearchManager.updateIdFilter();

        // ========== 横屏检测逻辑（保留原有） ==========
        // 检测横屏状态
        function checkLandscape() {
            if (window.innerWidth <= 768) {
                // 移动端
                if (window.orientation === 0 || window.orientation === 180) {
                    // 竖屏 - 显示提示
                    DOM.landscapeTip.classList.add('show');
                } else {
                    // 横屏 - 隐藏提示
                    DOM.landscapeTip.classList.remove('show');
                }
            } else {
                // 非移动端 - 隐藏提示
                DOM.landscapeTip.classList.remove('show');
            }
        }

        // 监听屏幕旋转/尺寸变化
        window.addEventListener('orientationchange', checkLandscape);
        window.addEventListener('resize', checkLandscape);

        // 初始检测
        checkLandscape();
        // ========== 横屏检测逻辑结束 ==========

        // 暴露必要的API到全局（供内联事件使用）
        window.Utils = Utils;
        window.DataManager = DataManager;
        window.AccountManager = AccountManager;
        window.SearchManager = SearchManager;
        window.SortManager = SortManager;
        window.ImportExportManager = ImportExportManager;
        window.BirdViewManager = BirdViewManager;
    };

    // 页面加载完成后初始化（改为异步）
    document.addEventListener('DOMContentLoaded', init);

    // 窗口卸载时销毁定时器
    window.addEventListener('beforeunload', () => {
        CountdownManager.destroy();
    });

})(window, document);