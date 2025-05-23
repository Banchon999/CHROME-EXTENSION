 // ================== INITIALIZATION ==================
    async init() {
        try {
            // Initialize persistence
            if (this.settings.persistQueue && window.advancedStorageManager) {
                this.persistenceManager = window.advancedStorageManager;
                await this.loadPersistedQueues();
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start background tasks
            this.startBackgroundProcessing();
            
            console.log('🎯 Intelligent Queue Manager initialized');
            
        } catch (error) {
            console.error('Queue Manager initialization failed:', error);
        }
    }
    
    setupEventListeners() {
        // Listen for network changes
        if (navigator.onLine !== undefined) {
            window.addEventListener('online', () => this.handleNetworkChange(true));
            window.addEventListener('offline', () => this.handleNetworkChange(false));
        }
        
        // Listen for visibility changes (pause when tab is hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAllQueues('visibility');
            } else {
                this.resumeAllQueues('visibility');
            }
        });
    }
    
    startBackgroundProcessing() {
        // Process queues every second
        setInterval(() => this.processQueues(), 1000);
        
        // Update statistics every 5 seconds
        setInterval(() => this.updateStatistics(), 5000);
        
        // Persist queues every 30 seconds
        if (this.persistenceManager) {
            setInterval(() => this.persistQueues(), 30000);
        }
        
        // Cleanup completed queues every minute
        setInterval(() => this.cleanupCompletedQueues(), 60000);
    }
    
    // ================== QUEUE MANAGEMENT ==================
    createQueue(queueId, options = {}) {
        if (this.queues.has(queueId)) {
            throw new Error(`Queue ${queueId} already exists`);
        }
        
        const defaultOptions = {
            priority: 3,
            concurrentLimit: this.settings.maxConcurrentDownloads,
            retryAttempts: this.settings.retryAttempts,
            retryDelay: this.settings.retryDelay,
            autoStart: true,
            persistToDisk: true,
            bandwidthLimit: 0,
            progressCallback: null,
            completionCallback: null,
            errorCallback: null
        };
        
        const queueOptions = { ...defaultOptions, ...options };
        
        const queue = {
            id: queueId,
            options: queueOptions,
            items: [],
            status: 'created',
            progress: {
                total: 0,
                completed: 0,
                failed: 0,
                inProgress: 0,
                percentage: 0
            },
            statistics: {
                createdAt: Date.now(),
                startedAt: null,
                completedAt: null,
                totalSize: 0,
                downloadedSize: 0,
                averageSpeed: 0,
                estimatedTimeRemaining: 0
            },
            activeDownloads: new Set(),
            failedItems: [],
            retryQueue: []
        };
        
        this.queues.set(queueId, queue);
        
        if (queueOptions.autoStart) {
            this.startQueue(queueId);
        }
        
        this.notifyQueueEvent('created', queueId, queue);
        
        return queueId;
    }
    
    addToQueue(queueId, items) {
        const queue = this.getQueue(queueId);
        if (!queue) {
            throw new Error(`Queue ${queueId} not found`);
        }
        
        // Process items
        const processedItems = Array.isArray(items) ? items : [items];
        const queueItems = processedItems.map((item, index) => ({
            id: `${queueId}_item_${Date.now()}_${index}`,
            queueId: queueId,
            ...item,
            status: 'pending',
            priority: item.priority || queue.options.priority,
            attempts: 0,
            addedAt: Date.now(),
            startedAt: null,
            completedAt: null,
            error: null,
            progress: {
                downloaded: 0,
                total: item.estimatedSize || 0,
                percentage: 0,
                speed: 0
            }
        }));
        
        // Check queue size limit
        if (queue.items.length + queueItems.length > this.settings.maxQueueSize) {
            throw new Error(`Queue size limit exceeded (${this.settings.maxQueueSize})`);
        }
        
        // Add items to queue
        queue.items.push(...queueItems);
        queue.progress.total += queueItems.length;
        queue.statistics.totalSize += queueItems.reduce((sum, item) => sum + (item.estimatedSize || 0), 0);
        
        // Sort by priority
        this.sortQueueByPriority(queue);
        
        this.statistics.totalQueued += queueItems.length;
        
        this.notifyQueueEvent('itemsAdded', queueId, { items: queueItems, queue });
        
        return queueItems.map(item => item.id);
    }
    
    startQueue(queueId) {
        const queue = this.getQueue(queueId);
        if (!queue) {
            throw new Error(`Queue ${queueId} not found`);
        }
        
        if (queue.status === 'running') {
            return; // Already running
        }
        
        queue.status = 'running';
        queue.statistics.startedAt = Date.now();
        
        this.pausedQueues.delete(queueId);
        
        this.notifyQueueEvent('started', queueId, queue);
        
        // Start processing immediately
        this.processQueue(queue);
    }
    
    pauseQueue(queueId, reason = 'manual') {
        const queue = this.getQueue(queueId);
        if (!queue) {
            throw new Error(`Queue ${queueId} not found`);
        }
        
        queue.status = 'paused';
        queue.pauseReason = reason;
        this.pausedQueues.add(queueId);
        
        // Cancel active downloads for this queue
        for (const downloadId of queue.activeDownloads) {
            this.cancelDownload(downloadId);
        }
        
        this.notifyQueueEvent('paused', queueId, { queue, reason });
    }
    
    resumeQueue(queueId) {
        const queue = this.getQueue(queueId);
        if (!queue) {
            throw new Error(`Queue ${queueId} not found`);
        }
        
        if (queue.status !== 'paused') {
            return; // Not paused
        }
        
        queue.status = 'running';
        delete queue.pauseReason;
        this.pausedQueues.delete(queueId);
        
        // Reset failed items to pending for retry
        queue.items.forEach(item => {
            if (item.status === 'downloading') {
                item.status = 'pending'; // Reset interrupted downloads
            }
        });
        
        this.notifyQueueEvent('resumed', queueId, queue);
    }
    
    stopQueue(queueId) {
        const queue = this.getQueue(queueId);
        if (!queue) {
            throw new Error(`Queue ${queueId} not found`);
        }
        
        queue.status = 'stopped';
        this.pausedQueues.delete(queueId);
        
        // Cancel all active downloads
        for (const downloadId of queue.activeDownloads) {
            this.cancelDownload(downloadId);
        }
        
        queue.activeDownloads.clear();
        
        this.notifyQueueEvent('stopped', queueId, queue);
    }
    
    removeQueue(queueId) {
        const queue = this.getQueue(queueId);
        if (!queue) {
            return false;
        }
        
        // Stop the queue first
        this.stopQueue(queueId);
        
        // Move to completed queues for history
        this.completedQueues.set(queueId, {
            ...queue,
            removedAt: Date.now()
        });
        
        // Remove from active queues
        this.queues.delete(queueId);
        this.pausedQueues.delete(queueId);
        
        this.notifyQueueEvent('removed', queueId, queue);
        
        return true;
    }
    
    // ================== QUEUE PROCESSING ==================
    async processQueues() {
        if (!navigator.onLine) {
            return; // Skip if offline
        }
        
        for (const [queueId, queue] of this.queues) {
            if (queue.status === 'running') {
                await this.processQueue(queue);
            }
        }
    }
    
    async processQueue(queue) {
        try {
            const availableSlots = queue.options.concurrentLimit - queue.activeDownloads.size;
            
            if (availableSlots <= 0) {
                return; // Queue is at capacity
            }
            
            // Get pending items
            const pendingItems = queue.items
                .filter(item => item.status === 'pending')
                .sort((a, b) => b.priority - a.priority)
                .slice(0, availableSlots);
            
            if (pendingItems.length === 0) {
                // Check if queue is complete
                if (queue.activeDownloads.size === 0 && queue.retryQueue.length === 0) {
                    this.completeQueue(queue);
                }
                return;
            }
            
            // Start downloads
            for (const item of pendingItems) {
                await this.startDownload(item, queue);
            }
            
        } catch (error) {
            console.error(`Queue processing error for ${queue.id}:`, error);
        }
    }
    
    async startDownload(item, queue) {
        try {
            item.status = 'downloading';
            item.startedAt = Date.now();
            item.attempts++;
            
            queue.activeDownloads.add(item.id);
            queue.progress.inProgress++;
            
            this.activeDownloads.set(item.id, { item, queue });
            
            // Update peak concurrency
            const totalActive = this.activeDownloads.size;
            if (totalActive > this.statistics.peakConcurrency) {
                this.statistics.peakConcurrency = totalActive;
            }
            
            this.notifyItemEvent('started', item, queue);
            
            // Execute the actual download
            const result = await this.executeDownload(item, queue);
            
            // Handle download completion
            await this.handleDownloadComplete(item, queue, result);
            
        } catch (error) {
            await this.handleDownloadError(item, queue, error);
        }
    }
    
    async executeDownload(item, queue) {
        // This method should be implemented by the specific download handler
        // For now, we'll simulate a download
        
        const progressCallback = (progress) => {
            this.updateItemProgress(item, queue, progress);
        };
        
        // Simulate download process
        return new Promise((resolve, reject) => {
            let progress = 0;
            const totalSize = item.estimatedSize || 1024 * 1024; // 1MB default
            
            const interval = setInterval(() => {
                progress += Math.random() * 0.1; // Random progress increment
                
                if (progress >= 1) {
                    clearInterval(interval);
                    resolve({
                        success: true,
                        downloadId: `download_${item.id}`,
                        finalSize: totalSize,
                        downloadPath: `downloads/${item.filename}`
                    });
                } else {
                    progressCallback({
                        downloaded: progress * totalSize,
                        total: totalSize,
                        percentage: progress * 100,
                        speed: Math.random() * 1024 * 1024 // Random speed
                    });
                }
            }, 100);
            
            // Simulate occasional failures
            setTimeout(() => {
                if (Math.random() < 0.1) { // 10% failure rate
                    clearInterval(interval);
                    reject(new Error('Simulated download failure'));
                }
            }, Math.random() * 5000);
        });
    }
    
    async handleDownloadComplete(item, queue, result) {
        try {
            item.status = 'completed';
            item.completedAt = Date.now();
            item.downloadResult = result;
            
            queue.activeDownloads.delete(item.id);
            queue.progress.inProgress--;
            queue.progress.completed++;
            
            this.activeDownloads.delete(item.id);
            this.statistics.totalCompleted++;
            
            // Update queue statistics
            const downloadTime = item.completedAt - item.startedAt;
            queue.statistics.downloadedSize += result.finalSize || 0;
            
            // Update average download time
            const completedItems = queue.items.filter(i => i.status === 'completed').length;
            queue.statistics.averageSpeed = queue.statistics.downloadedSize / 
                ((Date.now() - queue.statistics.startedAt) / 1000);
            
            this.notifyItemEvent('completed', item, queue);
            
            // Call completion callback if provided
            if (queue.options.completionCallback) {
                queue.options.completionCallback(item, queue);
            }
            
        } catch (error) {
            console.error('Error handling download completion:', error);
        }
    }
    
    async handleDownloadError(item, queue, error) {
        try {
            item.status = 'failed';
            item.error = error.message;
            item.failedAt = Date.now();
            
            queue.activeDownloads.delete(item.id);
            queue.progress.inProgress--;
            queue.progress.failed++;
            
            this.activeDownloads.delete(item.id);
            this.statistics.totalFailed++;
            
            // Add to failed items
            queue.failedItems.push({
                item: { ...item },
                error: error.message,
                timestamp: Date.now()
            });
            
            // Check if we should retry
            if (item.attempts < queue.options.retryAttempts) {
                this.scheduleRetry(item, queue);
            }
            
            this.notifyItemEvent('failed', item, queue);
            
            // Call error callback if provided
            if (queue.options.errorCallback) {
                queue.options.errorCallback(item, queue, error);
            }
            
        } catch (retryError) {
            console.error('Error handling download error:', retryError);
        }
    }
    
    scheduleRetry(item, queue) {
        const retryDelay = queue.options.retryDelay * Math.pow(2, item.attempts - 1); // Exponential backoff
        
        setTimeout(() => {
            if (queue.status === 'running') {
                item.status = 'pending';
                item.error = null;
                this.statistics.totalRetried++;
                
                this.notifyItemEvent('retrying', item, queue);
            }
        }, retryDelay);
    }
    
    // ================== PROGRESS TRACKING ==================
    updateItemProgress(item, queue, progress) {
        item.progress = { ...progress };
        
        // Update queue progress
        this.updateQueueProgress(queue);
        
        // Update bandwidth monitoring
        this.bandwidthMonitor.recordProgress(item.id, progress);
        
        this.notifyItemEvent('progress', item, queue);
    }
    
    updateQueueProgress(queue) {
        const totalItems = queue.items.length;
        const completedItems = queue.progress.completed;
        const failedItems = queue.progress.failed;
        
        queue.progress.percentage = totalItems > 0 ? 
            ((completedItems + failedItems) / totalItems) * 100 : 0;
        
        // Calculate ETA
        if (queue.statistics.averageSpeed > 0) {
            const remainingSize = queue.statistics.totalSize - queue.statistics.downloadedSize;
            queue.statistics.estimatedTimeRemaining = remainingSize / queue.statistics.averageSpeed;
        }
        
        // Call progress callback if provided
        if (queue.options.progressCallback) {
            queue.options.progressCallback(queue.progress, queue);
        }
    }
    
    completeQueue(queue) {
        if (queue.status === 'completed') {
            return; // Already completed
        }
        
        queue.status = 'completed';
        queue.statistics.completedAt = Date.now();
        
        this.notifyQueueEvent('completed', queue.id, queue);
        
        // Move to completed queues after delay
        setTimeout(() => {
            this.completedQueues.set(queue.id, queue);
            this.queues.delete(queue.id);
        }, 5000); // Keep in active queues for 5 seconds for UI updates
    }
    
    // ================== QUEUE UTILITIES ==================
    getQueue(queueId) {
        return this.queues.get(queueId) || null;
    }
    
    getQueueStatus(queueId) {
        const queue = this.getQueue(queueId);
        if (!queue) {
            return null;
        }
        
        return {
            id: queue.id,
            status: queue.status,
            progress: queue.progress,
            statistics: queue.statistics,
            itemCount: queue.items.length,
            activeDownloads: queue.activeDownloads.size,
            failedItems: queue.failedItems.length
        };
    }
    
    getAllQueues() {
        return Array.from(this.queues.values());
    }
    
    getActiveQueues() {
        return Array.from(this.queues.values()).filter(q => q.status === 'running');
    }
    
    getPausedQueues() {
        return Array.from(this.queues.values()).filter(q => q.status === 'paused');
    }
    
    getCompletedQueues() {
        return Array.from(this.completedQueues.values());
    }
    
    sortQueueByPriority(queue) {
        queue.items.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            return a.addedAt - b.addedAt; // FIFO for same priority
        });
    }
    
    // ================== BATCH OPERATIONS ==================
    pauseAllQueues(reason = 'batch') {
        for (const queueId of this.queues.keys()) {
            if (!this.pausedQueues.has(queueId)) {
                this.pauseQueue(queueId, reason);
            }
        }
    }
    
    resumeAllQueues(reason = 'batch') {
        for (const queueId of this.pausedQueues) {
            this.resumeQueue(queueId);
        }
    }
    
    stopAllQueues() {
        for (const queueId of this.queues.keys()) {
            this.stopQueue(queueId);
        }
    }
    
    clearCompletedQueues() {
        this.completedQueues.clear();
    }
    
    // ================== NETWORK HANDLING ==================
    handleNetworkChange(isOnline) {
        if (isOnline) {
            console.log('🌐 Network restored - resuming queues');
            if (this.settings.autoResume) {
                this.resumeAllQueues('network');
            }
        } else {
            console.log('📶 Network lost - pausing queues');
            this.pauseAllQueues('network');
        }
    }
    
    // ================== PERSISTENCE ==================
    async loadPersistedQueues() {
        if (!this.persistenceManager) return;
        
        try {
            const savedQueues = await this.persistenceManager.getDownloadQueue();
            
            for (const queueData of savedQueues) {
                // Restore queue state
                const queue = {
                    ...queueData,
                    activeDownloads: new Set(),
                    status: 'paused' // Always start paused after restore
                };
                
                // Reset downloading items to pending
                queue.items.forEach(item => {
                    if (item.status === 'downloading') {
                        item.status = 'pending';
                    }
                });
                
                this.queues.set(queue.id, queue);
                this.pausedQueues.add(queue.id);
            }
            
            console.log(`📥 Restored ${savedQueues.length} queues from storage`);
            
        } catch (error) {
            console.error('Failed to load persisted queues:', error);
        }
    }
    
    async persistQueues() {
        if (!this.persistenceManager) return;
        
        try {
            const queuesToSave = Array.from(this.queues.values()).map(queue => ({
                ...queue,
                activeDownloads: [] // Don't persist active downloads
            }));
            
            await this.persistenceManager.saveDownloadQueue(queuesToSave);
            
        } catch (error) {
            console.error('Failed to persist queues:', error);
        }
    }
    
    // ================== CLEANUP ==================
    cleanupCompletedQueues() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        for (const [queueId, queue] of this.completedQueues) {
            if (queue.statistics.completedAt < cutoffTime) {
                this.completedQueues.delete(queueId);
            }
        }
    }
    
    cancelDownload(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (download) {
            // Cancel the actual download operation
            // This would integrate with the download system
            console.log(`Cancelling download: ${downloadId}`);
        }
    }
    
    // ================== STATISTICS ==================
    updateStatistics() {
        const now = Date.now();
        const sessionDuration = (now - this.statistics.sessionStartTime) / 1000;
        
        // Update average download time
        const totalCompleted = this.statistics.totalCompleted;
        if (totalCompleted > 0) {
            this.statistics.averageDownloadTime = this.getTotalDownloadTime() / totalCompleted;
        }
        
        // Update bandwidth statistics
        this.statistics.totalBandwidthUsed = this.bandwidthMonitor.getTotalBandwidth();
    }
    
    getTotalDownloadTime() {
        let totalTime = 0;
        
        for (const queue of this.queues.values()) {
            for (const item of queue.items) {
                if (item.status === 'completed' && item.startedAt && item.completedAt) {
                    totalTime += item.completedAt - item.startedAt;
                }
            }
        }
        
        return totalTime;
    }
    
    getOverallStatistics() {
        const activeQueues = this.getActiveQueues().length;
        const pausedQueues = this.getPausedQueues().length;
        const completedQueues = this.completedQueues.size;
        
        const totalItems = Array.from(this.queues.values())
            .reduce((sum, queue) => sum + queue.items.length, 0);
            
        const totalProgress = Array.from(this.queues.values())
            .reduce((sum, queue) => sum + queue.progress.completed, 0);
        
        return {
            ...this.statistics,
            queues: {
                active: activeQueues,
                paused: pausedQueues,
                completed: completedQueues,
                total: activeQueues + pausedQueues + completedQueues
            },
            items: {
                total: totalItems,
                completed: totalProgress,
                active: this.activeDownloads.size,
                remaining: totalItems - totalProgress
            },
            performance: {
                averageSpeed: this.bandwidthMonitor.getAverageSpeed(),
                currentSpeed: this.bandwidthMonitor.getCurrentSpeed(),
                peakSpeed: this.bandwidthMonitor.getPeakSpeed()
            }
        };
    }
    
    // ================== EVENT SYSTEM ==================
    notifyQueueEvent(eventType, queueId, data) {
        const event = {
            type: `queue.${eventType}`,
            queueId,
            data,
            timestamp: Date.now()
        };
        
        // Send to extension popup/background
        chrome.runtime.sendMessage({
            action: 'queueEvent',
            event
        }).catch(() => {
            // Popup might be closed, ignore
        });
        
        // Custom event for internal listeners
        window.dispatchEvent(new CustomEvent('queueManagerEvent', { detail: event }));
    }
    
    notifyItemEvent(eventType, item, queue) {
        const event = {
            type: `item.${eventType}`,
            itemId: item.id,
            queueId: queue.id,
            item,
            queue: {
                id: queue.id,
                progress: queue.progress,
                status: queue.status
            },
            timestamp: Date.now()
        };
        
        chrome.runtime.sendMessage({
            action: 'itemEvent',
            event
        }).catch(() => {
            // Popup might be closed, ignore
        });
        
        window.dispatchEvent(new CustomEvent('queueItemEvent', { detail: event }));
    }
}

// ================== BANDWIDTH MONITORING ==================
class BandwidthMonitor {
    constructor() {
        this.measurements = [];
        this.maxMeasurements = 100;
        this.measurementInterval = 1000; // 1 second
        
        this.currentSpeeds = new Map();
        this.totalBandwidth = 0;
        this.peakSpeed = 0;
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        setInterval(() => {
            this.calculateCurrentSpeeds();
            this.updateMeasurements();
        }, this.measurementInterval);
    }
    
    recordProgress(downloadId, progress) {
        const now = Date.now();
        const speed = progress.speed || 0;
        
        this.currentSpeeds.set(downloadId, {
            speed,
            timestamp: now,
            downloaded: progress.downloaded
        });
        
        if (speed > this.peakSpeed) {
            this.peakSpeed = speed;
        }
        
        this.totalBandwidth += progress.downloaded;
    }
    
    calculateCurrentSpeeds() {
        const now = Date.now();
        const totalSpeed = Array.from(this.currentSpeeds.values())
            .filter(data => now - data.timestamp < 5000) // Only recent measurements
            .reduce((sum, data) => sum + data.speed, 0);
        
        this.measurements.push({
            timestamp: now,
            speed: totalSpeed,
            activeDDownloads: this.currentSpeeds.size
        });
        
        // Keep only recent measurements
        if (this.measurements.length > this.maxMeasurements) {
            this.measurements.shift();
        }
        
        // Clean up old speed records
        for (const [downloadId, data] of this.currentSpeeds) {
            if (now - data.timestamp > 10000) { // Remove data older than 10 seconds
                this.currentSpeeds.delete(downloadId);
            }
        }
    }
    
    updateMeasurements() {
        // Clean up old measurements
        const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
        this.measurements = this.measurements.filter(m => m.timestamp > cutoff);
    }
    
    getCurrentSpeed() {
        if (this.measurements.length === 0) return 0;
        return this.measurements[this.measurements.length - 1].speed;
    }
    
    getAverageSpeed() {
        if (this.measurements.length === 0) return 0;
        
        const totalSpeed = this.measurements.reduce((sum, m) => sum + m.speed, 0);
        return totalSpeed / this.measurements.length;
    }
    
    getPeakSpeed() {
        return this.peakSpeed;
    }
    
    getTotalBandwidth() {
        return this.totalBandwidth;
    }
    
    getSpeedHistory() {
        return this.measurements.slice();
    }
}

// ================== PROGRESS TRACKING ==================
class ProgressTracker {
    constructor() {
        this.trackedItems = new Map();
        this.milestones = [10, 25, 50, 75, 90, 100];
        this.callbacks = new Map();
    }
    
    trackItem(itemId, totalSize, callback) {
        this.trackedItems.set(itemId, {
            totalSize,
            downloaded: 0,
            percentage: 0,
            milestones: new Set(),
            startTime: Date.now(),
            callback
        });
        
        if (callback) {
            this.callbacks.set(itemId, callback);
        }
    }
    
    updateProgress(itemId, downloaded) {
        const item = this.trackedItems.get(itemId);
        if (!item) return;
        
        item.downloaded = downloaded;
        item.percentage = item.totalSize > 0 ? (downloaded / item.totalSize) * 100 : 0;
        
        // Check milestones
        for (const milestone of this.milestones) {
            if (item.percentage >= milestone && !item.milestones.has(milestone)) {
                item.milestones.add(milestone);
                this.triggerMilestone(itemId, milestone, item);
            }
        }
        
        // Call progress callback
        const callback = this.callbacks.get(itemId);
        if (callback) {
            callback({
                downloaded,
                total: item.totalSize,
                percentage: item.percentage,
                elapsedTime: Date.now() - item.startTime
            });
        }
    }
    
    triggerMilestone(itemId, milestone, item) {
        console.log(`📊 Progress milestone: ${itemId} reached ${milestone}%`);
        
        // You could emit events here for UI updates
        window.dispatchEvent(new CustomEvent('progressMilestone', {
            detail: { itemId, milestone, item }
        }));
    }
    
    completeItem(itemId) {
        const item = this.trackedItems.get(itemId);
        if (item) {
            item.percentage = 100;
            item.completedAt = Date.now();
            
            // Trigger 100% milestone if not already triggered
            if (!item.milestones.has(100)) {
                this.triggerMilestone(itemId, 100, item);
            }
        }
        
        // Clean up tracking data after delay
        setTimeout(() => {
            this.trackedItems.delete(itemId);
            this.callbacks.delete(itemId);
        }, 5000);
    }
    
    getProgress(itemId) {
        return this.trackedItems.get(itemId) || null;
    }
    
    getAllProgress() {
        return Array.from(this.trackedItems.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }
}

// ================== GLOBAL INSTANCE ==================
window.intelligentQueueManager = new IntelligentQueueManager();/**
 * Advanced Image Downloader Pro - Intelligent Queue Management System
 * ระบบจัดการคิวการดาวน์โหลดอัจฉริยะ
 */

class IntelligentQueueManager {
    constructor() {
        this.queues = new Map();
        this.activeDownloads = new Map();
        this.pausedQueues = new Set();
        this.completedQueues = new Map();
        
        this.settings = {
            maxConcurrentDownloads: 3,
            maxQueueSize: 1000,
            priorityLevels: 5,
            retryAttempts: 3,
            retryDelay: 1000,
            autoResume: true,
            persistQueue: true,
            bandwidthThrottling: false,
            maxBandwidth: 0 // 0 = unlimited
        };
        
        this.statistics = {
            totalQueued: 0,
            totalCompleted: 0,
            totalFailed: 0,
            totalRetried: 0,
			totalRetried: 0,
            averageDownloadTime: 0,
            totalBandwidthUsed: 0,
            peakConcurrency: 0,
            sessionStartTime: Date.now()
        };
        
        this.bandwidthMonitor = new BandwidthMonitor();
        this.progressTracker = new ProgressTracker();
        this.persistenceManager = null;
        
        this.init();
    }