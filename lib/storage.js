/**
 * Advanced Image Downloader Pro - Advanced Storage & Persistence System
 * ระบบจัดการข้อมูลและการเก็บถาวรขั้นสูง
 */

class AdvancedStorageManager {
    constructor() {
        this.storageQuota = {
            sync: 102400, // 100KB
            local: 10485760, // 10MB
            session: 1048576 // 1MB
        };
        
        this.compressionThreshold = 1024; // 1KB
        this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
        this.maxRetries = 3;
        
        this.schemas = this.initializeSchemas();
        this.migrationHandlers = this.initializeMigrations();
        
        this.init();
    }
    
    // ================== INITIALIZATION ==================
    async init() {
        try {
            await this.checkStorageQuota();
            await this.runMigrations();
            await this.cleanupExpiredData();
            
            console.log('🗄️ Advanced Storage Manager initialized');
        } catch (error) {
            console.error('Storage initialization failed:', error);
        }
    }
    
    initializeSchemas() {
        return {
            v1: {
                version: 1,
                settings: {
                    fileTypes: 'object',
                    minWidth: 'number',
                    minHeight: 'number',
                    scanDepth: 'number',
                    // ... other settings
                },
                downloadHistory: {
                    url: 'string',
                    filename: 'string',
                    downloadedAt: 'number',
                    size: 'number',
                    status: 'string'
                }
            },
            v2: {
                version: 2,
                settings: {
                    // v1 settings +
                    enableAdvancedFeatures: 'boolean',
                    corsProxyPreferences: 'array',
                    qualityThreshold: 'number'
                },
                downloadQueue: {
                    id: 'string',
                    images: 'array',
                    status: 'string',
                    progress: 'object',
                    createdAt: 'number',
                    completedAt: 'number'
                },
                downloadHistory: {
                    // v1 fields +
                    qualityScore: 'number',
                    extractionMethod: 'string',
                    processingTime: 'number'
                },
                sitePatterns: {
                    domain: 'string',
                    patterns: 'object',
                    lastUsed: 'number',
                    successRate: 'number'
                }
            }
        };
    }
    
    initializeMigrations() {
        return {
            '1->2': async (data) => {
                // Migrate from v1 to v2
                const migrated = { ...data };
                
                // Add new settings
                if (migrated.settings) {
                    migrated.settings.enableAdvancedFeatures = true;
                    migrated.settings.corsProxyPreferences = [];
                    migrated.settings.qualityThreshold = 70;
                }
                
                // Enhance download history
                if (migrated.downloadHistory) {
                    migrated.downloadHistory = migrated.downloadHistory.map(entry => ({
                        ...entry,
                        qualityScore: 50, // Default
                        extractionMethod: 'basic',
                        processingTime: 0
                    }));
                }
                
                // Initialize new collections
                migrated.downloadQueue = [];
                migrated.sitePatterns = [];
                migrated._version = 2;
                
                return migrated;
            }
        };
    }
    
    // ================== STORAGE OPERATIONS ==================
    async set(key, value, options = {}) {
        const config = {
            storageType: 'sync',
            compress: false,
            expire: null,
            encrypt: false,
            ...options
        };
        
        try {
            let processedValue = value;
            
            // Add metadata
            const metadata = {
                _timestamp: Date.now(),
                _version: this.getCurrentVersion(),
                _compressed: false,
                _encrypted: false
            };
            
            if (config.expire) {
                metadata._expires = Date.now() + config.expire;
            }
            
            // Compression
            if (config.compress || this.shouldCompress(value)) {
                processedValue = await this.compressData(value);
                metadata._compressed = true;
            }
            
            // Encryption (if needed for sensitive data)
            if (config.encrypt) {
                processedValue = await this.encryptData(processedValue);
                metadata._encrypted = true;
            }
            
            const finalData = {
                data: processedValue,
                ...metadata
            };
            
            // Choose storage type based on size and type
            const storageType = this.selectOptimalStorage(finalData, config.storageType);
            
            await this.writeToStorage(storageType, key, finalData);
            
            return true;
            
        } catch (error) {
            console.error(`Storage set failed for key ${key}:`, error);
            
            // Fallback strategies
            if (error.message.includes('QUOTA_EXCEEDED')) {
                await this.handleQuotaExceeded(key, value, config);
            }
            
            throw error;
        }
    }
    
    async get(key, options = {}) {
        const config = {
            storageType: 'auto',
            defaultValue: null,
            ignoreExpired: false,
            ...options
        };
        
        try {
            let data = null;
            
            // Try different storage types if auto
            if (config.storageType === 'auto') {
                data = await this.readFromAnyStorage(key);
            } else {
                data = await this.readFromStorage(config.storageType, key);
            }
            
            if (!data) {
                return config.defaultValue;
            }
            
            // Check expiration
            if (data._expires && data._expires < Date.now()) {
                if (!config.ignoreExpired) {
                    await this.remove(key);
                    return config.defaultValue;
                }
            }
            
            let processedData = data.data;
            
            // Decrypt if needed
            if (data._encrypted) {
                processedData = await this.decryptData(processedData);
            }
            
            // Decompress if needed
            if (data._compressed) {
                processedData = await this.decompressData(processedData);
            }
            
            return processedData;
            
        } catch (error) {
            console.error(`Storage get failed for key ${key}:`, error);
            return config.defaultValue;
        }
    }
    
    async remove(key, storageType = 'auto') {
        try {
            if (storageType === 'auto') {
                // Remove from all storage types
                await Promise.allSettled([
                    this.removeFromStorage('sync', key),
                    this.removeFromStorage('local', key),
                    this.removeFromStorage('session', key)
                ]);
            } else {
                await this.removeFromStorage(storageType, key);
            }
            
            return true;
            
        } catch (error) {
            console.error(`Storage remove failed for key ${key}:`, error);
            return false;
        }
    }
    
    async clear(storageType = 'all') {
        try {
            if (storageType === 'all') {
                await Promise.all([
                    chrome.storage.sync.clear(),
                    chrome.storage.local.clear(),
                    chrome.storage.session.clear()
                ]);
            } else {
                await chrome.storage[storageType].clear();
            }
            
            return true;
            
        } catch (error) {
            console.error(`Storage clear failed:`, error);
            return false;
        }
    }
    
    // ================== SPECIALIZED STORAGE METHODS ==================
    async setSettings(settings) {
        return this.set('settings', settings, {
            storageType: 'sync',
            compress: true
        });
    }
    
    async getSettings(defaults = {}) {
        const settings = await this.get('settings', { 
            defaultValue: defaults,
            storageType: 'sync'
        });
        
        return { ...defaults, ...settings };
    }
    
    async saveDownloadQueue(queue) {
        return this.set('downloadQueue', queue, {
            storageType: 'local',
            compress: true,
            expire: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
    }
    
    async getDownloadQueue() {
        return this.get('downloadQueue', {
            defaultValue: [],
            storageType: 'local'
        });
    }
    
    async addToDownloadHistory(entry) {
        try {
            const history = await this.getDownloadHistory();
            history.unshift(entry); // Add to beginning
            
            // Keep only last 1000 entries
            if (history.length > 1000) {
                history.splice(1000);
            }
            
            return this.saveDownloadHistory(history);
            
        } catch (error) {
            console.error('Failed to add to download history:', error);
            return false;
        }
    }
    
    async saveDownloadHistory(history) {
        return this.set('downloadHistory', history, {
            storageType: 'local',
            compress: true
        });
    }
    
    async getDownloadHistory(limit = 100) {
        const history = await this.get('downloadHistory', {
            defaultValue: [],
            storageType: 'local'
        });
        
        return history.slice(0, limit);
    }
    
    async saveSitePattern(domain, pattern) {
        try {
            const patterns = await this.getSitePatterns();
            const existingIndex = patterns.findIndex(p => p.domain === domain);
            
            const patternData = {
                domain,
                patterns: pattern,
                lastUsed: Date.now(),
                successRate: pattern.successRate || 0
            };
            
            if (existingIndex >= 0) {
                patterns[existingIndex] = patternData;
            } else {
                patterns.push(patternData);
            }
            
            // Keep only last 100 patterns
            if (patterns.length > 100) {
                patterns.sort((a, b) => b.lastUsed - a.lastUsed);
                patterns.splice(100);
            }
            
            return this.set('sitePatterns', patterns, {
                storageType: 'local',
                compress: true
            });
            
        } catch (error) {
            console.error('Failed to save site pattern:', error);
            return false;
        }
    }
    
    async getSitePatterns(domain = null) {
        const patterns = await this.get('sitePatterns', {
            defaultValue: [],
            storageType: 'local'
        });
        
        if (domain) {
            return patterns.find(p => p.domain === domain);
        }
        
        return patterns;
    }
    
    // ================== CACHING SYSTEM ==================
    async setCache(key, value, ttl = this.cacheTTL) {
        return this.set(`cache_${key}`, value, {
            storageType: 'session',
            expire: ttl
        });
    }
    
    async getCache(key) {
        return this.get(`cache_${key}`, {
            storageType: 'session'
        });
    }
    
    async invalidateCache(pattern = null) {
        try {
            const sessionData = await chrome.storage.session.get(null);
            const keysToRemove = [];
            
            for (const key of Object.keys(sessionData)) {
                if (key.startsWith('cache_')) {
                    if (!pattern || key.includes(pattern)) {
                        keysToRemove.push(key);
                    }
                }
            }
            
            if (keysToRemove.length > 0) {
                await chrome.storage.session.remove(keysToRemove);
            }
            
            return keysToRemove.length;
            
        } catch (error) {
            console.error('Cache invalidation failed:', error);
            return 0;
        }
    }
    
    // ================== BACKUP & RESTORE ==================
    async createBackup(includeCache = false) {
        try {
            const backup = {
                timestamp: Date.now(),
                version: this.getCurrentVersion(),
                data: {}
            };
            
            // Backup sync storage
            const syncData = await chrome.storage.sync.get(null);
            backup.data.sync = syncData;
            
            // Backup local storage
            const localData = await chrome.storage.local.get(null);
            backup.data.local = localData;
            
            // Optionally include session cache
            if (includeCache) {
                const sessionData = await chrome.storage.session.get(null);
                backup.data.session = sessionData;
            }
            
            return JSON.stringify(backup, null, 2);
            
        } catch (error) {
            throw new Error(`Backup creation failed: ${error.message}`);
        }
    }
    
    async restoreFromBackup(backupData, options = {}) {
        const config = {
            clearExisting: false,
            validateVersion: true,
            ...options
        };
        
        try {
            const backup = JSON.parse(backupData);
            
            if (config.validateVersion && backup.version !== this.getCurrentVersion()) {
                console.warn(`Version mismatch: backup v${backup.version}, current v${this.getCurrentVersion()}`);
                
                // Run migration if possible
                backup.data = await this.migrateData(backup.data, backup.version, this.getCurrentVersion());
            }
            
            if (config.clearExisting) {
                await this.clear('all');
            }
            
            // Restore data
            if (backup.data.sync) {
                await chrome.storage.sync.set(backup.data.sync);
            }
            
            if (backup.data.local) {
                await chrome.storage.local.set(backup.data.local);
            }
            
            if (backup.data.session) {
                await chrome.storage.session.set(backup.data.session);
            }
            
            return true;
            
        } catch (error) {
            throw new Error(`Backup restoration failed: ${error.message}`);
        }
    }
    
    // ================== MIGRATION SYSTEM ==================
    async runMigrations() {
        try {
            const currentVersion = await this.get('_version', { defaultValue: 1 });
            const targetVersion = this.getCurrentVersion();
            
            if (currentVersion === targetVersion) {
                return; // No migration needed
            }
            
            console.log(`🔄 Migrating storage from v${currentVersion} to v${targetVersion}`);
            
            // Get all data
            const allData = {
                sync: await chrome.storage.sync.get(null),
                local: await chrome.storage.local.get(null)
            };
            
            // Run migration
            const migratedData = await this.migrateData(allData, currentVersion, targetVersion);
            
            // Clear and restore
            await this.clear('all');
            
            if (migratedData.sync) {
                await chrome.storage.sync.set(migratedData.sync);
            }
            
            if (migratedData.local) {
                await chrome.storage.local.set(migratedData.local);
            }
            
            // Update version
            await this.set('_version', targetVersion);
            
            console.log(`✅ Migration completed: v${currentVersion} → v${targetVersion}`);
            
        } catch (error) {
            console.error('Migration failed:', error);
        }
    }
    
    async migrateData(data, fromVersion, toVersion) {
        let migratedData = { ...data };
        
        // Run migration handlers in sequence
        for (let version = fromVersion; version < toVersion; version++) {
            const migrationKey = `${version}->${version + 1}`;
            const migrationHandler = this.migrationHandlers[migrationKey];
            
            if (migrationHandler) {
                console.log(`Running migration: ${migrationKey}`);
                migratedData = await migrationHandler(migratedData);
            }
        }
        
        return migratedData;
    }
    
    // ================== QUOTA MANAGEMENT ==================
    async checkStorageQuota() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 0;
                
                const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
                
                if (usagePercent > 80) {
                    console.warn(`⚠️ Storage usage high: ${usagePercent.toFixed(1)}%`);
                    await this.cleanupOldData();
                }
                
                return { usage, quota, usagePercent };
            }
        } catch (error) {
            console.warn('Storage quota check failed:', error);
        }
        
        return null;
    }
    
    async handleQuotaExceeded(key, value, config) {
        console.warn('🚨 Storage quota exceeded, attempting cleanup...');
        
        // Strategy 1: Clean up expired data
        await this.cleanupExpiredData();
        
        // Strategy 2: Clean up old cache
        await this.invalidateCache();
        
        // Strategy 3: Compress the data
        if (!config.compress) {
            config.compress = true;
            return this.set(key, value, config);
        }
        
        // Strategy 4: Use local storage instead of sync
        if (config.storageType === 'sync') {
            config.storageType = 'local';
            return this.set(key, value, config);
        }
        
        // Strategy 5: Clean up old download history
        await this.cleanupDownloadHistory(500);
        
        throw new Error('Unable to free enough storage space');
    }
    
    async cleanupExpiredData() {
        try {
            const storageTypes = ['sync', 'local', 'session'];
            let cleanedCount = 0;
            
            for (const storageType of storageTypes) {
                const data = await chrome.storage[storageType].get(null);
                const keysToRemove = [];
                
                for (const [key, value] of Object.entries(data)) {
                    if (value && typeof value === 'object' && value._expires) {
                        if (value._expires < Date.now()) {
                            keysToRemove.push(key);
                        }
                    }
                }
                
                if (keysToRemove.length > 0) {
                    await chrome.storage[storageType].remove(keysToRemove);
                    cleanedCount += keysToRemove.length;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} expired items`);
            }
            
            return cleanedCount;
            
        } catch (error) {
            console.error('Cleanup failed:', error);
            return 0;
        }
    }
    
    async cleanupDownloadHistory(keepCount = 500) {
        try {
            const history = await this.getDownloadHistory(Infinity);
            
            if (history.length > keepCount) {
                const trimmedHistory = history
                    .sort((a, b) => b.downloadedAt - a.downloadedAt)
                    .slice(0, keepCount);
                
                await this.saveDownloadHistory(trimmedHistory);
                
                console.log(`📚 Trimmed download history: ${history.length} → ${keepCount}`);
                return history.length - keepCount;
            }
            
            return 0;
            
        } catch (error) {
            console.error('Download history cleanup failed:', error);
            return 0;
        }
    }
    
    async cleanupOldData() {
        const cleanupResults = await Promise.allSettled([
            this.cleanupExpiredData(),
            this.invalidateCache(),
            this.cleanupDownloadHistory(500)
        ]);
        
        const totalCleaned = cleanupResults
            .filter(result => result.status === 'fulfilled')
            .reduce((sum, result) => sum + result.value, 0);
        
        console.log(`🧹 Total cleanup: ${totalCleaned} items`);
        return totalCleaned;
    }
    
    // ================== UTILITY METHODS ==================
    selectOptimalStorage(data, preferredType) {
        const dataSize = this.estimateDataSize(data);
        
        // Size-based selection
        if (dataSize > 8192) { // 8KB
            return 'local';
        } else if (dataSize > 1024) { // 1KB
            return preferredType === 'sync' ? 'local' : preferredType;
        } else {
            return preferredType;
        }
    }
    
    shouldCompress(data) {
        const size = this.estimateDataSize(data);
        return size > this.compressionThreshold;
    }
    
    estimateDataSize(data) {
        try {
            return new Blob([JSON.stringify(data)]).size;
        } catch {
            return JSON.stringify(data).length * 2; // Rough estimate
        }
    }
    
    async writeToStorage(storageType, key, data) {
        const storage = chrome.storage[storageType];
        if (!storage) {
            throw new Error(`Invalid storage type: ${storageType}`);
        }
        
        return new Promise((resolve, reject) => {
            storage.set({ [key]: data }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }
    
    async readFromStorage(storageType, key) {
        const storage = chrome.storage[storageType];
        if (!storage) {
            throw new Error(`Invalid storage type: ${storageType}`);
        }
        
        return new Promise((resolve) => {
            storage.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    }
    
    async readFromAnyStorage(key) {
        // Try session first (fastest), then local, then sync
        const storageTypes = ['session', 'local', 'sync'];
        
        for (const storageType of storageTypes) {
            try {
                const data = await this.readFromStorage(storageType, key);
                if (data !== null) {
                    return data;
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }
    
    async removeFromStorage(storageType, key) {
        const storage = chrome.storage[storageType];
        if (!storage) {
            throw new Error(`Invalid storage type: ${storageType}`);
        }
        
        return new Promise((resolve, reject) => {
            storage.remove([key], () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }
    
    // ================== COMPRESSION & ENCRYPTION ==================
    async compressData(data) {
        try {
            const jsonString = JSON.stringify(data);
            
            // Simple compression using built-in methods
            if (typeof CompressionStream !== 'undefined') {
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(new TextEncoder().encode(jsonString));
                writer.close();
                
                const chunks = [];
                let done = false;
                
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
            } else {
                // Fallback: base64 encoding (not compression, but handles binary data)
                return btoa(jsonString);
            }
        } catch (error) {
            console.warn('Compression failed, storing uncompressed:', error);
            return data;
        }
    }
    
    async decompressData(compressedData) {
        try {
            if (Array.isArray(compressedData)) {
                // Decompress gzip
                if (typeof DecompressionStream !== 'undefined') {
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    
                    writer.write(new Uint8Array(compressedData));
                    writer.close();
                    
                    const chunks = [];
                    let done = false;
                    
                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) chunks.push(value);
                    }
                    
                    const decompressed = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
                    return JSON.parse(decompressed);
                }
            } else if (typeof compressedData === 'string') {
                // Fallback: base64 decode
                const decompressed = atob(compressedData);
                return JSON.parse(decompressed);
            }
            
            return compressedData;
        } catch (error) {
            console.warn('Decompression failed:', error);
            return compressedData;
        }
    }
    
    async encryptData(data) {
        // Simple encryption for sensitive data
        // In production, use proper encryption libraries
        console.warn('Encryption not implemented - storing as plaintext');
        return data;
    }
    
    async decryptData(encryptedData) {
        // Decrypt data
        console.warn('Decryption not implemented - returning as-is');
        return encryptedData;
    }
    
    getCurrentVersion() {
        return Math.max(...Object.values(this.schemas).map(s => s.version));
    }
    
    // ================== ANALYTICS & MONITORING ==================
    async getStorageStats() {
        try {
            const stats = {
                quotaInfo: await this.checkStorageQuota(),
                byStorageType: {},
                byDataType: {},
                totalItems: 0,
                oldestItem: null,
                newestItem: null
            };
            
            const storageTypes = ['sync', 'local', 'session'];
            
            for (const storageType of storageTypes) {
                const data = await chrome.storage[storageType].get(null);
                const items = Object.keys(data).length;
                const size = this.estimateDataSize(data);
                
                stats.byStorageType[storageType] = { items, size };
                stats.totalItems += items;
                
                // Analyze data types
                for (const [key, value] of Object.entries(data)) {
                    const dataType = this.getDataType(key, value);
                    if (!stats.byDataType[dataType]) {
                        stats.byDataType[dataType] = { items: 0, size: 0 };
                    }
                    stats.byDataType[dataType].items++;
                    stats.byDataType[dataType].size += this.estimateDataSize(value);
                    
                    // Track timestamps
                    if (value && typeof value === 'object' && value._timestamp) {
                        if (!stats.oldestItem || value._timestamp < stats.oldestItem) {
                            stats.oldestItem = value._timestamp;
                        }
                        if (!stats.newestItem || value._timestamp > stats.newestItem) {
                            stats.newestItem = value._timestamp;
                        }
                    }
                }
            }
            
            return stats;
            
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return null;
        }
    }
    
    getDataType(key, value) {
        if (key.startsWith('cache_')) return 'cache';
        if (key === 'settings') return 'settings';
        if (key === 'downloadHistory') return 'history';
        if (key === 'downloadQueue') return 'queue';
        if (key === 'sitePatterns') return 'patterns';
        if (key.startsWith('_')) return 'metadata';
        return 'other';
    }
}

// ================== GLOBAL INSTANCE ==================
window.advancedStorageManager = new AdvancedStorageManager();