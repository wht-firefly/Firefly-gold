// 萤鳏Bullion Butler 核心配置文件（挂载到全局window，确保能被firefly.js读取）
window.FIREFLY_CONFIG = {
    // 任务配置（分每日/周任务，修改这里自动同步所有界面）
    tasks: {
        daily: [
            { key: 'dailyNormal', name: '普通' },
            { key: 'dailyFa', name: '讨伐' },
            { key: 'lanChao', name: '蓝潮' },
            { key: 'xunLuo', name: '巡逻' }
        ],
        weekly: [
            { key: 'fishing', name: '钓鱼' },
            { key: 'weekly', name: '周本' }
        ]
    },
    // 每个账号默认角色数量
    defaultRoleCount: 3,
    // 重置时间配置（24小时制）
    resetTime: {
        dailyHour: 3,        // 每日重置小时（比如3点）
        weeklyWeekDay: 0,    // 每周重置星期（0=周日，1=周一，以此类推）
        weeklyHour: 3        // 每周重置小时
    },
    // 本地存储key（数据存在浏览器里的标识）
    storageKey: 'firefly_gold_manager_data',
    // 防抖延迟（毫秒，防止频繁保存数据）
    debounceDelay: 500
};