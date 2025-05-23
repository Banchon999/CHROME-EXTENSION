/**
 * Advanced Image Downloader Pro - Enhanced Background Service Worker
 * ระบบ service worker ขั้นสูงที่รวม storage และ queue management
 */

// ================== ENHANCED SERVICE WORKER CLASS ==================
class EnhancedServiceWorker {
    constructor() {
        this.downloadManager = null;
        this.queueManager = null;
        this.storageManager = null;
        this.analyticsTracker = new AnalyticsTracker();
        this.errorHandler = new ErrorHandler();
        
        this.isInitialized = false;
        this.initializationPromise = null;
        
        this.performanceMetrics = {
            startTime: Date.now(),
            totalRequests: 0,
            successfulOperations: 0,
            failedOperations: 0,
            averageResponseTime: 0,
            memoryUsage: 0
        };
        
        this.init();
    }
    
    // ================== INITIALIZATION ==================
    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }
    
    async performInitialization() {
        try {
            // Initialize storage first
            this.storageManager = new AdvancedStorageManager();
            await this.storageManager.init();
            
            // Initialize queue manager
            this.queueManager = new IntelligentQueueManager();
            await this.queueManager.init();
            
            // Initialize enhanced download manager
            this.downloadManager = new EnhancedDownloadManager();
            await this.downloadManager.init();
            
            // Connect components
            this.connectComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start background tasks
            this.startBackgroundTasks();
            
            this.isInitialized = true;
            console.log('🚀 Enhanced Service Worker initialized successfully');
            
        } catch (error) {
            console.error('Service Worker initialization failed:', error);
            this.errorHandler.handleCriticalError(error);
            throw error;
        }
    }
    
    connectComponents() {
        // Connect queue manager to download manager
        this.queueManager.downloadExecutor = this.downloadManager;
        
        // Connect storage to queue for persistence
        this.queueManager.persistenceManager = this.storageManager;
        
        // Connect analytics
        this.downloadManager.analytics = this.analyticsTracker;
        this.queueManager.analytics = this.analyticsTracker;
    }
    
    setupEventListeners() {
        // Enhanced message handling
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep channel open for async responses
        });
        
        // Download event listeners
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            this.handleDownloadChanged(downloadDelta);
        });
        
        chrome.downloads.onCreated.addListener((downloadItem) => {
            this.handleDownloadCreated(downloadItem);
        });
        
        // Storage change listeners
        chrome.storage.onChanged.addListener((changes, namespace) => {
            this.handleStorageChanged(changes, namespace);
        });
        
        // Tab event listeners for cleanup
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabClosed(tabId);
        });
        
        // Alarm listeners for scheduled tasks
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
        
        // Install/update listeners
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstalled(details);
        });
    }
    
    startBackgroundTasks() {
        // Create periodic alarms
        chrome.alarms.create('cleanup', { delayInMinutes: 30, periodInMinutes: 30 });
        chrome.alarms.create('analytics', { delayInMinutes: 5, periodInMinutes: 5 });
        chrome.alarms.create('healthCheck', { delayInMinutes: 1, periodInMinutes: 1 });
        chrome.alarms.create('backup', { delayInMinutes: 60, periodInMinutes: 60 });
        
        console.log('⏰ Background tasks scheduled');
    }
    
    // ================== MESSAGE HANDLING ==================
    async handleMessage(message, sender, sendResponse) {
        const startTime = Date.now();
        this.performanceMetrics.totalRequests++;
        
        try {
            await this.ensureInitialized();
            
            let response;
            
            switch (message.action) {
                // Download operations
                case 'startDownload':
                    response = await this.handleStartDownload(message, sender);
                    break;
                
                case 'startAdvancedDownload':
                    response = await this.handleStartAdvancedDownload(message, sender);
                    break;
                
                case 'pauseDownload':
                    response = await this.handlePauseDownload(message);
                    break;
                
                case 'resumeDownload':
                    response = await this.handleResumeDownload(message);
                    break;
                
                case 'cancelDownload':
                    response = await this.handleCancelDownload(message);
                    break;
                
                // Queue operations
                case 'createQueue':
                    response = await this.handleCreateQueue(message);
                    break;
                
                case 'addToQueue':
                    response = await this.handleAddToQueue(message);
                    break;
                
                case 'getQueueStatus':
                    response = await this.handleGetQueueStatus(message);
                    break;
                
                case 'manageQueue':
                    response = await this.handleManageQueue(message);
                    break;
                
                // Storage operations
                case 'saveSettings':
                    response = await this.handleSaveSettings(message);
                    break;
                
                case 'getSettings':
                    response = await this.handleGetSettings(message);
                    break;
                
                case 'exportData':
                    response = await this.handleExportData(message);
                    break;
                
                case 'importData':
                    response = await this.handleImportData(message);
                    break;
                
                // Analytics and monitoring
                case 'getStatistics':
                    response = await this.handleGetStatistics(message);
                    break;
                
                case 'getPerformanceMetrics':
                    response = await this.handleGetPerformanceMetrics(message);
                    break;
                
                // Health and diagnostics
                case 'healthCheck':
                    response = await this.handleHealthCheck(message);
                    break;
                
                case 'diagnostics':
                    response = await this.handleDiagnostics(message);
                    break;
                
                default:
                    throw new Error(`Unknown action: ${message.action}`);
            }
            
            this.performanceMetrics.successfulOperations++;
            this.updateResponseTime(Date.now() - startTime);
            
            sendResponse(response);
            
        } catch (error) {
            this.performanceMetrics.failedOperations++;
            console.error(`Message handling error for ${message.action}:`, error);
            
            this.errorHandler.handleError(error, {
                action: message.action,
                message: message,
                sender: sender
            });
            
            sendResponse({
                success: false,
                error: error.message,
                errorCode: error.code || 'UNKNOWN_ERROR'
            });
        }
    }
    
    // ================== DOWNLOAD HANDLERS ==================
    async handleStartDownload(message, sender) {
        const { images, settings, tabId } = message;
        
        // Create a new queue for this download batch
        const queueId = `download_${Date.now()}_${tabId}`;
        
        this.queueManager.createQueue(queueId, {
            priority: 5,
            concurrentLimit: settings.concurrentDownloads || 3,
            retryAttempts: settings.retryAttempts || 3,
            autoStart: true,
            progressCallback: (progress, queue) => {
                this.notifyProgress('downloadProgress', progress, queue);
            },
            completionCallback: (item, queue) => {
                this.notifyProgress('downloadComplete', item, queue);
            },
            errorCallback: (item, queue, error) => {
                this.notifyProgress('downloadError', { item, error }, queue);
            }
        });
        
        // Add images to queue
        const itemIds = this.queueManager.addToQueue(queueId, images.map(img => ({
            url: img.url,
            filename: img.filename || this.generateFilename(img),
            estimatedSize: img.estimatedSize || 0,
            metadata: img,
            priority: img.priority || 3
        })));
        
        return {
            success: true,
            queueId: queueId,
            itemIds: itemIds,
            message: `Started download queue with ${images.length} items`
        };
    }
    
    async handleStartAdvancedDownload(message, sender) {
        // Enhanced download with advanced features
        const result = await this.handleStartDownload(message, sender);
        
        if (result.success) {
            // Apply advanced processing
            const queue = this.queueManager.getQueue(result.queueId);
            
            // Enable advanced features
            queue.options.enableQualityAnalysis = message.settings.enableQualityAnalysis;
            queue.options.enableConversion = message.settings.enableConversion;
            queue.options.enableMetadataExtraction = message.settings.enableMetadataExtraction;
            
            // Track analytics
            this.analyticsTracker.trackDownloadBatch({
                queueId: result.queueId,
                itemCount: message.images.length,
                settings: message.settings,
                tabId: message.tabId
            });
        }
        
        return result;
    }
    
    async handlePauseDownload(message) {
        const { queueId } = message;
        
        this.queueManager.pauseQueue(queueId, 'user_request');
        
        return {
            success: true,
            message: `Queue ${queueId} paused`
        };
    }
    
    async handleResumeDownload(message) {
        const { queueId } = message;
        
        this.queueManager.resumeQueue(queueId);
        
        return {
            success: true,
            message: `Queue ${queueId} resumed`
        };
    }
    
    async handleCancelDownload(message) {
        const { queueId } = message;
        
        this.queueManager.stopQueue(queueId);
        
        return {
            success: true,
            message: `Queue ${queueId} cancelled`
        };
    }
    
    // ================== QUEUE HANDLERS ==================
    async handleCreateQueue(message) {
        const { queueId, options } = message;
        
        const id = this.queueManager.createQueue(queueId || `queue_${Date.now()}`, options);
        
        return {
            success: true,
            queueId: id,
            message: `Queue ${id} created`
        };
    }
    
    async handleAddToQueue(message) {
        const { queueId, items } = message;
        
        const itemIds = this.queueManager.addToQueue(queueId, items);
        
        return {
            success: true,
            queueId: queueId,
            itemIds: itemIds,
            message: `Added ${items.length} items to queue ${queueId}`
        };
    }
    
    async handleGetQueueStatus(message) {
        const { queueId } = message;
        
        if (queueId) {
            const status = this.queueManager.getQueueStatus(queueId);
            return {
                success: true,
                status: status
            };
        } else {
            // Get all queues
            const allQueues = this.queueManager.getAllQueues().map(q => 
                this.queueManager.getQueueStatus(q.id)
            );
            
            return {
                success: true,
                queues: allQueues,
                statistics: this.queueManager.getOverallStatistics()
            };
        }
    }
    
    async handleManageQueue(message) {
        const { queueId, operation } = message;
        
        switch (operation) {
            case 'start':
                this.queueManager.startQueue(queueId);
                break;
            case 'pause':
                this.queueManager.pauseQueue(queueId, 'user_request');
                break;
            case 'resume':
                this.queueManager.resumeQueue(queueId);
                break;
            case 'stop':
                this.queueManager.stopQueue(queueId);
                break;
            case 'remove':
                this.queueManager.removeQueue(queueId);
                break;
            default:
                throw new Error(`Unknown queue operation: ${operation}`);
        }
        
        return {
            success: true,
            message: `Queue ${queueId} ${operation} completed`
        };
    }
    
    // ================== STORAGE HANDLERS ==================
    async handleSaveSettings(message) {
        const { settings } = message;
        
        await this.storageManager.setSettings(settings);
        
        return {
            success: true,
            message: 'Settings saved successfully'
        };
    }
    
    async handleGetSettings(message) {
        const { defaults } = message;
        
        const settings = await this.storageManager.getSettings(defaults);
        
        return {
            success: true,
            settings: settings
        };
    }
    
    async handleExportData(message) {
        const { includeCache, includeHistory } = message;
        
        const exportData = {
            timestamp: Date.now(),
            version: chrome.runtime.getManifest().version,
            settings: await this.storageManager.getSettings(),
            statistics: this.analyticsTracker.getStatistics()
        };
        
        if (includeHistory) {
            exportData.downloadHistory = await this.storageManager.getDownloadHistory();
            exportData.sitePatterns = await this.storageManager.getSitePatterns();
        }
        
        if (includeCache) {
            // Note: Cache is typically session-based and might not be meaningful to export
            exportData.note = 'Cache data not included as it is session-specific';
        }
        
        const exportString = JSON.stringify(exportData, null, 2);
        
        return {
            success: true,
            data: exportString,
            size: exportString.length
        };
    }
    
    async handleImportData(message) {
        const { data, options } = message;
        
        try {
            const importData = JSON.parse(data);
            
            // Validate import data
            if (!importData.version || !importData.settings) {
                throw new Error('Invalid import data format');
            }
            
            // Import settings
            await this.storageManager.setSettings(importData.settings);
            
            // Import history if available
            if (importData.downloadHistory && options.importHistory) {
                await this.storageManager.saveDownloadHistory(importData.downloadHistory);
            }
            
            // Import site patterns if available
            if (importData.sitePatterns && options.importPatterns) {
                for (const pattern of importData.sitePatterns) {
                    await this.storageManager.saveSitePattern(pattern.domain, pattern.patterns);
                }
            }
            
            return {
                success: true,
                message: 'Data imported successfully',
                imported: {
                    settings: true,
                    history: !!importData.downloadHistory,
                    patterns: !!importData.sitePatterns
                }
            };
            
        } catch (error) {
            throw new Error(`Import failed: ${error.message}`);
        }
    }
    
    // ================== ANALYTICS HANDLERS ==================
    async handleGetStatistics(message) {
        const { period, detailed } = message;
        
        const statistics = {
            overall: this.queueManager.getOverallStatistics(),
            performance: this.performanceMetrics,
            analytics: this.analyticsTracker.getStatistics(period),
            storage: await this.storageManager.getStorageStats()
        };
        
        if (detailed) {
            statistics.queues = this.queueManager.getAllQueues().map(q => ({
                id: q.id,
                status: q.status,
                progress: q.progress,
                statistics: q.statistics
            }));
        }
        
        return {
            success: true,
            statistics: statistics
        };
    }
    
    async handleGetPerformanceMetrics(message) {
        const metrics = {
            serviceWorker: this.performanceMetrics,
            queue: this.queueManager.getOverallStatistics(),
            bandwidth: this.queueManager.bandwidthMonitor.getSpeedHistory(),
            storage: await this.storageManager.getStorageStats(),
            memory: this.getMemoryUsage()
        };
        
        return {
            success: true,
            metrics: metrics
        };
    }
    
    // ================== HEALTH & DIAGNOSTICS ==================
    async handleHealthCheck(message) {
        const health = {
            status: 'healthy',
            timestamp: Date.now(),
            components: {},
            issues: []
        };
        
        // Check storage health
        try {
            const storageStats = await this.storageManager.getStorageStats();
            health.components.storage = {
                status: 'healthy',
                usage: storageStats.quotaInfo?.usagePercent || 0
            };
            
            if (storageStats.quotaInfo?.usagePercent > 90) {
                health.issues.push('Storage usage above 90%');
                health.status = 'warning';
            }
        } catch (error) {
            health.components.storage = { status: 'error', error: error.message };
            health.status = 'error';
        }
        
        // Check queue health
        const queueStats = this.queueManager.getOverallStatistics();
        health.components.queue = {
            status: 'healthy',
            activeQueues: queueStats.queues.active,
            activeDownloads: queueStats.items.active
        };
        
        // Check error rates
        const errorRate = this.performanceMetrics.totalRequests > 0 ? 
            (this.performanceMetrics.failedOperations / this.performanceMetrics.totalRequests) * 100 : 0;
        
        health.components.errorRate = {
            status: errorRate < 5 ? 'healthy' : errorRate < 15 ? 'warning' : 'error',
            rate: errorRate
        };
        
        if (errorRate > 5) {
            health.issues.push(`Error rate: ${errorRate.toFixed(1)}%`);
            if (health.status === 'healthy') health.status = 'warning';
        }
        
        return {
            success: true,
            health: health
        };
    }
    
    async handleDiagnostics(message) {
        const diagnostics = {
            timestamp: Date.now(),
            runtime: {
                uptime: Date.now() - this.performanceMetrics.startTime,
                version: chrome.runtime.getManifest().version,
                platform: navigator.platform,
                userAgent: navigator.userAgent
            },
            components: {
                downloadManager: !!this.downloadManager,
                queueManager: !!this.queueManager,
                storageManager: !!this.storageManager,
                analyticsTracker: !!this.analyticsTracker
            },
            performance: this.performanceMetrics,
            storage: await this.storageManager.getStorageStats(),
            queues: this.queueManager.getAllQueues().length,
            recentErrors: this.errorHandler.getRecentErrors(10)
        };
        
        return {
            success: true,
            diagnostics: diagnostics
        };
    }
    
    // ================== EVENT HANDLERS ==================
    handleDownloadChanged(downloadDelta) {
        // Forward to download manager
        if (this.downloadManager) {
            this.downloadManager.handleDownloadChanged(downloadDelta);
        }
    }
    
    handleDownloadCreated(downloadItem) {
        // Track new downloads
        this.analyticsTracker.trackDownloadCreated(downloadItem);
    }
    
    handleStorageChanged(changes, namespace) {
        // Handle storage changes
        console.log(`Storage changed in ${namespace}:`, Object.keys(changes));
    }
    
    handleTabClosed(tabId) {
        // Cleanup any tab-specific data
        this.analyticsTracker.cleanupTabData(tabId);
    }
    
    async handleAlarm(alarm) {
        try {
            switch (alarm.name) {
                case 'cleanup':
                    await this.performCleanup();
                    break;
                    
                case 'analytics':
                    await this.updateAnalytics();
                    break;
                    
                case 'healthCheck':
                    await this.performHealthCheck();
                    break;
                    
                case 'backup':
                    await this.performBackup();
                    break;
                    
                default:
                    console.log(`Unknown alarm: ${alarm.name}`);
            }
        } catch (error) {
            console.error(`Alarm handler error for ${alarm.name}:`, error);
        }
    }
    
    async handleInstalled(details) {
        if (details.reason === 'install') {
            console.log('🎉 Advanced Image Downloader Pro installed');
            
            // Initialize default settings
            await this.storageManager.setSettings({
                firstRun: false,
                version: chrome.runtime.getManifest().version,
                installDate: Date.now()
            });
            
            // Show welcome page
            chrome.tabs.create({
                url: chrome.runtime.getURL('welcome.html')
            });
            
        } else if (details.reason === 'update') {
            console.log(`🔄 Updated to version ${chrome.runtime.getManifest().version}`);
            
            // Handle any necessary migrations
            await this.storageManager.runMigrations();
        }
    }
    
    // ================== BACKGROUND TASKS ==================
    async performCleanup() {
        console.log('🧹 Performing scheduled cleanup...');
        
        // Storage cleanup
        const cleaned = await this.storageManager.cleanupOldData();
        
        // Queue cleanup
        this.queueManager.cleanupCompletedQueues();
        
        // Analytics cleanup
        this.analyticsTracker.cleanup();
        
        console.log(`✅ Cleanup completed: ${cleaned} items removed`);
    }
    
    async updateAnalytics() {
        this.analyticsTracker.updateMetrics();
        this.updateMemoryUsage();
    }
    
    async performHealthCheck() {
        const health = await this.handleHealthCheck({});
        
        if (health.health.status === 'error') {
            console.warn('🚨 Health check failed:', health.health.issues);
            
            // Attempt self-healing
            await this.attemptSelfHealing(health.health);
        }
    }
    
    async performBackup() {
        try {
            const backup = await this.storageManager.createBackup(false);
            console.log('💾 Backup created successfully');
            
            // Store backup in local storage with rotation
            const backups = await this.storageManager.get('backups', { defaultValue: [] });
            backups.unshift({
                timestamp: Date.now(),
                size: backup.length
            });
            
            // Keep only last 5 backups
            if (backups.length > 5) {
                backups.splice(5);
            }
            
            await this.storageManager.set('backups', backups);
            
        } catch (error) {
            console.error('Backup failed:', error);
        }
    }
    
    async attemptSelfHealing(healthData) {
        console.log('🔧 Attempting self-healing...');
        
        // Clear problematic data if storage is full
        if (healthData.issues.includes('Storage usage above 90%')) {
            await this.storageManager.cleanupOldData();
        }
        
        // Restart failed components
        if (healthData.components.storage?.status === 'error') {
            try {
                await this.storageManager.init();
            } catch (error) {
                console.error('Storage restart failed:', error);
            }
        }
    }
    
    // ================== UTILITY METHODS ==================
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }
    
    generateFilename(image) {
        try {
            const url = new URL(image.url);
            const pathParts = url.pathname.split('/');
            let filename = pathParts[pathParts.length - 1] || 'image';
            
            if (!filename.includes('.')) {
                filename += '.jpg'; // Default extension
            }
            
            return filename.replace(/[<>:"/\\|?*]/g, '_');
        } catch (error) {
            return `image_${Date.now()}.jpg`;
        }
    }
    
    notifyProgress(type, data, queue = null) {
        const message = {
            action: type,
            data: data,
            queue: queue ? {
                id: queue.id,
                progress: queue.progress,
                status: queue.status
            } : null,
            timestamp: Date.now()
        };
        
        // Send to all extension contexts
        chrome.runtime.sendMessage(message).catch(() => {
            // Ignore if no listeners
        });
    }
    
    updateResponseTime(responseTime) {
        const currentAvg = this.performanceMetrics.averageResponseTime;
        const totalRequests = this.performanceMetrics.totalRequests;
        
        this.performanceMetrics.averageResponseTime = 
            (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
    }
    
    updateMemoryUsage() {
        if (performance.memory) {
            this.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
        }
    }
    
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
            };
        }
        return null;
    }
}

// ================== ANALYTICS TRACKER ==================
class AnalyticsTracker {
    constructor() {
        this.events = [];
        this.sessions = new Map();
        this.statistics = {
            totalDownloads: 0,
            totalSize: 0,
            successRate: 0,
            averageSpeed: 0,
            popularSites: new Map(),
            fileTypes: new Map(),
            errors: new Map()
        };
        
        this.maxEvents = 1000;
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    }
    
    trackDownloadBatch(data) {
        this.addEvent('download_batch_started', data);
        this.statistics.totalDownloads += data.itemCount;
        
        // Track popular sites
        if (data.domain) {
            const count = this.statistics.popularSites.get(data.domain) || 0;
            this.statistics.popularSites.set(data.domain, count + 1);
        }
    }
    
    trackDownloadCreated(downloadItem) {
        this.addEvent('download_created', {
            id: downloadItem.id,
            url: downloadItem.url,
            filename: downloadItem.filename,
            size: downloadItem.fileSize
        });
        
        if (downloadItem.fileSize) {
            this.statistics.totalSize += downloadItem.fileSize;
        }
        
        // Track file types
        const extension = downloadItem.filename?.split('.').pop()?.toLowerCase();
        if (extension) {
            const count = this.statistics.fileTypes.get(extension) || 0;
            this.statistics.fileTypes.set(extension, count + 1);
        }
    }
    
    trackError(error, context) {
        this.addEvent('error', { error: error.message, context });
        
        const errorType = error.constructor.name;
        const count = this.statistics.errors.get(errorType) || 0;
        this.statistics.errors.set(errorType, count + 1);
    }
    
    addEvent(type, data) {
        const event = {
            type,
            data,
            timestamp: Date.now()
        };
        
        this.events.push(event);
        
        // Cleanup old events
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
    }
    
    getStatistics(period = null) {
        let filteredEvents = this.events;
        
        if (period) {
            const cutoff = Date.now() - period;
            filteredEvents = this.events.filter(e => e.timestamp > cutoff);
        }
        
        return {
            ...this.statistics,
            eventCount: filteredEvents.length,
            recentEvents: filteredEvents.slice(-10),
            popularSites: Array.from(this.statistics.popularSites.entries())
            sort((a, b) => b[1] - a[1])
            .slice(0, 10),
        fileTypes: Array.from(this.statistics.fileTypes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10),
        errors: Array.from(this.statistics.errors.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
        };
    }
    
    cleanupTabData(tabId) {
        // Remove events related to specific tab
        this.events = this.events.filter(event => 
            !event.data || event.data.tabId !== tabId
        );
    }
    
    cleanup() {
        // Clean up old events (keep only last 7 days)
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
        this.events = this.events.filter(event => event.timestamp > cutoff);
        
        // Clean up old sessions
        for (const [sessionId, session] of this.sessions) {
            if (Date.now() - session.lastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
            }
        }
    }
}

// ================== ERROR HANDLER ==================
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.errorCounts = new Map();
        this.criticalErrors = [];
    }
    
    handleError(error, context = {}) {
        const errorRecord = {
            message: error.message,
            stack: error.stack,
            context: context,
            timestamp: Date.now(),
            severity: this.determineSeverity(error, context)
        };
        
        this.errors.push(errorRecord);
        
        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        // Count error types
        const errorType = error.constructor.name;
        const count = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, count + 1);
        
        // Handle critical errors
        if (errorRecord.severity === 'critical') {
            this.handleCriticalError(error, context);
        }
        
        console.error('🚨 Error handled:', errorRecord);
    }
    
    handleCriticalError(error, context = {}) {
        const criticalError = {
            error: error.message,
            context: context,
            timestamp: Date.now(),
            handled: false
        };
        
        this.criticalErrors.push(criticalError);
        
        // Try to recover
        this.attemptRecovery(error, context);
        
        // Notify user if possible
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: 'Advanced Image Downloader - Critical Error',
            message: 'A critical error occurred. Please check the extension settings.'
        });
    }
    
    determineSeverity(error, context) {
        // Network errors are usually recoverable
        if (error.message.includes('network') || error.message.includes('fetch')) {
            return 'warning';
        }
        
        // Storage errors can be critical
        if (error.message.includes('storage') || error.message.includes('quota')) {
            return 'critical';
        }
        
        // Permission errors are critical
        if (error.message.includes('permission') || error.message.includes('unauthorized')) {
            return 'critical';
        }
        
        return 'error';
    }
    
    attemptRecovery(error, context) {
        // Basic recovery strategies
        if (error.message.includes('storage')) {
            // Clear some storage space
            console.log('🔧 Attempting storage recovery...');
        }
        
        if (error.message.includes('network')) {
            // Retry network operations
            console.log('🔧 Attempting network recovery...');
        }
    }
    
    getRecentErrors(count = 10) {
        return this.errors.slice(-count);
    }
    
    getErrorStatistics() {
        return {
            totalErrors: this.errors.length,
            criticalErrors: this.criticalErrors.length,
            errorTypes: Array.from(this.errorCounts.entries()),
            recentErrors: this.getRecentErrors(5)
        };
    }
}

// ================== QUEUE MANAGER COMPLETION ==================
// ต่อจาก queue-manager.js

window.intelligentQueueManager = new IntelligentQueueManager();

// ================== GLOBAL INITIALIZATION ==================
const enhancedServiceWorker = new EnhancedServiceWorker();

// ================== UTILITY FUNCTIONS ==================
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ================== GLOBAL ERROR HANDLERS ==================
self.addEventListener('error', (event) => {
    if (enhancedServiceWorker.errorHandler) {
        enhancedServiceWorker.errorHandler.handleError(event.error, {
            type: 'global_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }
});

self.addEventListener('unhandledrejection', (event) => {
    if (enhancedServiceWorker.errorHandler) {
        enhancedServiceWorker.errorHandler.handleError(event.reason, {
            type: 'unhandled_promise_rejection'
        });
    }
});

// ================== KEEP ALIVE MECHANISM ==================
// Keep service worker alive
let keepAliveInterval;

function startKeepAlive() {
    keepAliveInterval = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {
            // This API call keeps the service worker alive
        });
    }, 20000); // Every 20 seconds
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Start keep alive mechanism
startKeepAlive();

// ================== PERFORMANCE MONITORING ==================
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            startTime: Date.now(),
            apiCalls: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            networkRequests: 0
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        setInterval(() => {
            this.updateMetrics();
        }, 5000); // Update every 5 seconds
    }
    
    updateMetrics() {
        if (performance.memory) {
            this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
        }
        
        // Log performance data periodically
        if (this.metrics.apiCalls % 100 === 0) {
            console.log('📊 Performance Metrics:', this.getMetrics());
        }
    }
    
    recordApiCall() {
        this.metrics.apiCalls++;
    }
    
    recordNetworkRequest() {
        this.metrics.networkRequests++;
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            memoryFormatted: formatBytes(this.metrics.memoryUsage)
        };
    }
}

const performanceMonitor = new PerformanceMonitor();

// ================== DEBUG UTILITIES ==================
class DebugManager {
    constructor() {
        this.debugEnabled = false;
        this.logLevel = 'info'; // error, warn, info, debug
        this.logs = [];
        this.maxLogs = 500;
    }
    
    enable(level = 'info') {
        this.debugEnabled = true;
        this.logLevel = level;
        console.log('🐛 Debug mode enabled');
    }
    
    disable() {
        this.debugEnabled = false;
        console.log('🐛 Debug mode disabled');
    }
    
    log(level, message, data = null) {
        if (!this.debugEnabled) return;
        
        const logEntry = {
            level,
            message,
            data,
            timestamp: Date.now(),
            stack: new Error().stack
        };
        
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Console output
        const consoleMethods = {
            error: console.error,
            warn: console.warn,
            info: console.log,
            debug: console.log
        };
        
        const method = consoleMethods[level] || console.log;
        method(`[${level.toUpperCase()}] ${message}`, data || '');
    }
    
    error(message, data) {
        this.log('error', message, data);
    }
    
    warn(message, data) {
        this.log('warn', message, data);
    }
    
    info(message, data) {
        this.log('info', message, data);
    }
    
    debug(message, data) {
        this.log('debug', message, data);
    }
    
    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }
    
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
    
    clearLogs() {
        this.logs = [];
    }
}

const debugManager = new DebugManager();

// Enable debug mode in development
if (chrome.runtime.getManifest().name.includes('Dev')) {
    debugManager.enable('debug');
}

// ================== EXTENSION LIFECYCLE ==================
chrome.runtime.onSuspend.addListener(() => {
    console.log('🔄 Service worker suspending...');
    stopKeepAlive();
    
    // Save critical data
    enhancedServiceWorker.queueManager?.persistQueues();
});

chrome.runtime.onSuspendCanceled.addListener(() => {
    console.log('🔄 Service worker suspend canceled');
    startKeepAlive();
});

// ================== EXPORT GLOBALS ==================
globalThis.enhancedServiceWorker = enhancedServiceWorker;
globalThis.performanceMonitor = performanceMonitor;
globalThis.debugManager = debugManager;

console.log('🚀 Enhanced Service Worker fully loaded and ready');

// ================== FINAL INITIALIZATION CHECK ==================
enhancedServiceWorker.init().then(() => {
    console.log('✅ All systems initialized successfully');
    
    // Send ready signal
    chrome.runtime.sendMessage({
        action: 'serviceWorkerReady',
        timestamp: Date.now()
    }).catch(() => {
        // No listeners, that's fine
    });
    
}).catch((error) => {
    console.error('❌ Service Worker initialization failed:', error);
    
    // Show error notification
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon48.png',
        title: 'Advanced Image Downloader - Initialization Failed',
        message: 'Please restart the extension or check the console for details.'
    });
});