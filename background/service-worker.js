/**
 * Advanced Image Downloader Pro - Background Service Worker
 * จัดการการดาวน์โหลด, การสื่อสาร และการประมวลผลในพื้นหลัง
 */

class DownloadManager {
    constructor() {
        this.downloadQueue = [];
        this.activeDownloads = new Map();
        this.downloadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            successful: 0
        };
        
        this.setupMessageListeners();
        this.setupDownloadListeners();
    }
    
    // ================== MESSAGE HANDLING ==================
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'startDownload':
                    this.handleDownloadRequest(message, sender, sendResponse);
                    return true; // Keep channel open for async response
                    
                case 'pauseDownload':
                    this.pauseDownloads();
                    sendResponse({ success: true });
                    break;
                    
                case 'resumeDownload':
                    this.resumeDownloads();
                    sendResponse({ success: true });
                    break;
                    
                case 'cancelDownload':
                    this.cancelDownloads();
                    sendResponse({ success: true });
                    break;
                    
                case 'getDownloadStatus':
                    sendResponse({ 
                        success: true, 
                        stats: this.downloadStats,
                        queueLength: this.downloadQueue.length
                    });
                    break;
            }
        });
    }
    
    // ================== DOWNLOAD REQUEST HANDLING ==================
    async handleDownloadRequest(message, sender, sendResponse) {
        try {
            const { images, settings, tabId } = message;
            
            if (!images || !Array.isArray(images) || images.length === 0) {
                sendResponse({ success: false, error: 'ไม่มีภาพให้ดาวน์โหลด' });
                return;
            }
            
            // Initialize download stats
            this.downloadStats = {
                total: images.length,
                completed: 0,
                failed: 0,
                successful: 0
            };
            
            // Prepare download folder
            const folderName = await this.prepareFolderName(settings, tabId);
            
            // Process images and add to queue
            const processedImages = await this.processImages(images, settings, folderName);
            
            // Start downloads
            await this.startBatchDownload(processedImages, settings);
            
            sendResponse({ 
                success: true, 
                message: `เริ่มดาวน์โหลด ${images.length} ไฟล์`,
                folderName: folderName
            });
            
        } catch (error) {
            console.error('Download request error:', error);
            sendResponse({ 
                success: false, 
                error: error.message || 'เกิดข้อผิดพลาดในการเริ่มดาวน์โหลด' 
            });
        }
    }
    
    // ================== FOLDER MANAGEMENT ==================
    async prepareFolderName(settings, tabId) {
        let folderName = settings.folderName;
        
        if (!folderName || folderName.trim() === '') {
            // Auto-generate folder name based on site
            try {
                const tab = await chrome.tabs.get(tabId);
                const url = new URL(tab.url);
                const siteName = url.hostname.replace(/^www\./, '');
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                folderName = `${siteName}_${timestamp}`;
            } catch (error) {
                folderName = `images_${Date.now()}`;
            }
        }
        
        // Sanitize folder name
        folderName = folderName.replace(/[<>:"/\\|?*]/g, '_');
        
        return settings.createSubfolder ? folderName : '';
    }
    
    // ================== IMAGE PROCESSING ==================
    async processImages(images, settings, folderName) {
        const processedImages = [];
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            try {
                // Generate filename
                const filename = this.generateFileName(image, i, settings, folderName);
                
                // Prepare download item
                const downloadItem = {
                    id: `img_${Date.now()}_${i}`,
                    url: image.url,
                    filename: filename,
                    originalImage: image,
                    retryCount: 0,
                    maxRetries: settings.retryAttempts || 3
                };
                
                processedImages.push(downloadItem);
                
            } catch (error) {
                console.error(`Error processing image ${i}:`, error);
                this.notifyProgress('error', `ข้อผิดพลาดในการประมวลผล: ${image.url}`);
            }
        }
        
        return processedImages;
    }
    
    generateFileName(image, index, settings, folderName) {
        const originalUrl = image.url || image.src;
        let filename;
        
        try {
            const url = new URL(originalUrl);
            const pathParts = url.pathname.split('/');
            const originalName = pathParts[pathParts.length - 1] || `image_${index + 1}`;
            
            // Extract extension
            let extension = 'jpg'; // default
            if (originalName.includes('.')) {
                extension = originalName.split('.').pop().toLowerCase();
            } else if (image.type) {
                extension = image.type.split('/')[1] || 'jpg';
            }
            
            // Generate name based on pattern
            switch (settings.namingPattern) {
                case 'numbered':
                    filename = `${(index + 1).toString().padStart(4, '0')}.${extension}`;
                    break;
                case 'timestamp':
                    filename = `${Date.now()}_${index + 1}.${extension}`;
                    break;
                case 'custom':
                    const customBase = settings.customName || 'image';
                    filename = `${customBase}_${(index + 1).toString().padStart(3, '0')}.${extension}`;
                    break;
                default: // 'original'
                    filename = originalName.includes('.') ? originalName : `${originalName}.${extension}`;
            }
            
        } catch (error) {
            filename = `image_${index + 1}.jpg`;
        }
        
        // Add folder path if needed
        if (folderName) {
            filename = `${folderName}/${filename}`;
        }
        
        return filename;
    }
    
    // ================== BATCH DOWNLOAD MANAGEMENT ==================
    async startBatchDownload(images, settings) {
        this.downloadQueue = [...images];
        const concurrentLimit = settings.concurrentDownloads || 3;
        
        this.notifyProgress('info', `เริ่มดาวน์โหลด ${images.length} ไฟล์ (${concurrentLimit} ไฟล์พร้อมกัน)`);
        
        // Start concurrent downloads
        const downloadPromises = [];
        for (let i = 0; i < Math.min(concurrentLimit, this.downloadQueue.length); i++) {
            downloadPromises.push(this.processNextDownload(settings));
        }
        
        await Promise.all(downloadPromises);
        
        // Send completion notification
        this.notifyDownloadComplete();
    }
    
    async processNextDownload(settings) {
        while (this.downloadQueue.length > 0) {
            const downloadItem = this.downloadQueue.shift();
            
            if (!downloadItem) break;
            
            try {
                await this.downloadSingleImage(downloadItem, settings);
                this.downloadStats.successful++;
            } catch (error) {
                console.error(`Download failed for ${downloadItem.url}:`, error);
                this.downloadStats.failed++;
                
                // Retry logic
                if (downloadItem.retryCount < downloadItem.maxRetries) {
                    downloadItem.retryCount++;
                    this.downloadQueue.push(downloadItem);
                    this.notifyProgress('info', `Retry ${downloadItem.retryCount}/${downloadItem.maxRetries}: ${downloadItem.filename}`);
                } else {
                    this.notifyProgress('error', `ดาวน์โหลดล้มเหลว: ${downloadItem.filename}`);
                }
            } finally {
                this.downloadStats.completed++;
                this.notifyProgress('progress', null);
            }
            
            // Small delay to prevent overwhelming the browser
            await this.delay(100);
        }
    }
    
    // ================== INDIVIDUAL DOWNLOAD ==================
    async downloadSingleImage(downloadItem, settings) {
        return new Promise((resolve, reject) => {
            const downloadOptions = {
                url: downloadItem.url,
                filename: downloadItem.filename,
                saveAs: false,
                conflictAction: 'uniquify'
            };
            
            // Handle special URLs
            if (downloadItem.url.startsWith('blob:') || downloadItem.url.startsWith('data:')) {
                // For blob and data URLs, we need special handling
                this.downloadBlobOrDataUrl(downloadItem, resolve, reject);
                return;
            }
            
            chrome.downloads.download(downloadOptions, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                this.activeDownloads.set(downloadId, downloadItem);
                this.notifyProgress('info', `กำลังดาวน์โหลด: ${downloadItem.filename}`);
                
                // The actual resolution will happen in the download listener
                downloadItem.resolve = resolve;
                downloadItem.reject = reject;
            });
        });
    }
    
    async downloadBlobOrDataUrl(downloadItem, resolve, reject) {
        try {
            // Convert blob/data URL to downloadable format
            const response = await fetch(downloadItem.url);
            const blob = await response.blob();
            
            // Create object URL for download
            const objectUrl = URL.createObjectURL(blob);
            
            const downloadOptions = {
                url: objectUrl,
                filename: downloadItem.filename,
                saveAs: false,
                conflictAction: 'uniquify'
            };
            
            chrome.downloads.download(downloadOptions, (downloadId) => {
                if (chrome.runtime.lastError) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                this.activeDownloads.set(downloadId, downloadItem);
                this.notifyProgress('info', `กำลังดาวน์โหลด Blob: ${downloadItem.filename}`);
                
                downloadItem.resolve = resolve;
                downloadItem.reject = reject;
                downloadItem.objectUrl = objectUrl; // Clean up later
            });
            
        } catch (error) {
            reject(error);
        }
    }
    
    // ================== DOWNLOAD EVENT LISTENERS ==================
    setupDownloadListeners() {
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            const downloadItem = this.activeDownloads.get(downloadDelta.id);
            if (!downloadItem) return;
            
            if (downloadDelta.state && downloadDelta.state.current === 'complete') {
                // Download completed successfully
                if (downloadItem.resolve) {
                    downloadItem.resolve();
                }
                
                // Clean up
                this.activeDownloads.delete(downloadDelta.id);
                if (downloadItem.objectUrl) {
                    URL.revokeObjectURL(downloadItem.objectUrl);
                }
                
            } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
                // Download failed
                if (downloadItem.reject) {
                    downloadItem.reject(new Error(`Download interrupted: ${downloadDelta.error}`));
                }
                
                // Clean up
                this.activeDownloads.delete(downloadDelta.id);
                if (downloadItem.objectUrl) {
                    URL.revokeObjectURL(downloadItem.objectUrl);
                }
            }
        });
    }
    
    // ================== PROGRESS NOTIFICATION ==================
    notifyProgress(type, message) {
        const progressData = {
            action: 'downloadProgress',
            type: type,
            current: this.downloadStats.completed,
            total: this.downloadStats.total,
            successful: this.downloadStats.successful,
            failed: this.downloadStats.failed,
            message: message
        };
        
        // Send to all popup windows
        chrome.runtime.sendMessage(progressData).catch(() => {
            // Popup might be closed, ignore error
        });
    }
    
    notifyDownloadComplete() {
        const completeData = {
            action: 'downloadComplete',
            total: this.downloadStats.total,
            successful: this.downloadStats.successful,
            failed: this.downloadStats.failed
        };
        
        chrome.runtime.sendMessage(completeData).catch(() => {
            // Popup might be closed, ignore error
        });
        
        // Show notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: 'Advanced Image Downloader Pro',
            message: `ดาวน์โหลดเสร็จสิ้น: ${this.downloadStats.successful}/${this.downloadStats.total} ไฟล์`
        });
    }
    
    // ================== DOWNLOAD CONTROL ==================
    pauseDownloads() {
        // Implement pause logic
        this.notifyProgress('info', 'หยุดการดาวน์โหลดชั่วคราว');
    }
    
    resumeDownloads() {
        // Implement resume logic
        this.notifyProgress('info', 'เริ่มการดาวน์โหลดต่อ');
    }
    
    cancelDownloads() {
        // Cancel all active downloads
        this.activeDownloads.forEach((item, downloadId) => {
            chrome.downloads.cancel(downloadId);
        });
        
        this.downloadQueue = [];
        this.activeDownloads.clear();
        
        this.notifyProgress('info', 'ยกเลิกการดาวน์โหลดทั้งหมด');
    }
    
    // ================== UTILITY METHODS ==================
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ================== INITIALIZATION ==================
const downloadManager = new DownloadManager();

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Advanced Image Downloader Pro installed');
        
        // Set default settings
        chrome.storage.sync.set({
            settings: {
                firstRun: false,
                version: chrome.runtime.getManifest().version
            }
        });
        
    } else if (details.reason === 'update') {
        console.log('Advanced Image Downloader Pro updated');
    }
});

// Keep service worker alive
chrome.runtime.onConnect.addListener((port) => {
    // Handle long-lived connections if needed
});

// Global error handler
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});