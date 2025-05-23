// Advanced Image Downloader - Background Service Worker
class BackgroundService {
    constructor() {
        this.downloadQueue = [];
        this.activeDownloads = new Map();
        this.downloadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            totalSize: 0
        };
        
        this.init();
    }

    init() {
        // ฟังการติดตั้ง Extension
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // ฟังข้อความจาก popup และ content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // สำหรับ async response
        });

        // ฟังการเปลี่ยนแปลงของ tab
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // ฟังการปิด tab
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoved(tabId);
        });

        // ฟังการเปลี่ยนแปลงของการดาวน์โหลด
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            this.handleDownloadChange(downloadDelta);
        });

        // ตั้งค่า context menu (ถ้าทำได้)
        this.setupContextMenu();

        console.log('Advanced Image Downloader Background Service Started');
    }

    // จัดการการติดตั้ง
    handleInstall(details) {
        console.log('Extension installed/updated:', details.reason);
        
        if (details.reason === 'install') {
            // ติดตั้งใหม่
            this.setDefaultSettings();
            this.showWelcomeNotification();
        } else if (details.reason === 'update') {
            // อัปเดต
            this.handleUpdate(details);
        }
    }

    // แสดงการแจ้งเตือนต้อนรับ
    showWelcomeNotification() {
        try {
            if (chrome.notifications && chrome.notifications.create) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9InVybCgjZ3JhZGllbnQwX2xpbmVhcl8xXzEpIi8+CjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjgiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjQiIGZpbGw9IiM0ZmFjZmUiLz4KPGRHZWY+CjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZGllbnQwX2xpbmVhcl8xXzEiIHgxPSIwIiB5MT0iMCIgeDI9IjQ4IiB5Mj0iNDgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzRmYWNmZSIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMGYyZmUiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K',
                    title: 'Advanced Image Downloader ติดตั้งเสร็จสิ้น!',
                    message: 'คลิกที่ไอคอน Extension เพื่อเริ่มใช้งาน'
                });
            }
        } catch (error) {
            console.log('Notification not available:', error);
        }
    }

    // ตั้งค่าเริ่มต้น
    async setDefaultSettings() {
        try {
            const defaultSettings = {
                minWidth: 100,
                minHeight: 100,
                minFileSize: 10,
                fileFormats: ['jpg', 'png', 'gif', 'webp', 'svg'],
                urlContains: '',
                urlExcludes: '',
                namingPattern: 'original',
                customPattern: '{site}_{index}_{date}',
                filePrefix: '',
                downloadConcurrency: 3,
                downloadDelay: 500,
                thumbnailSize: 'medium',
                showImageInfo: true,
                enableHotkeys: true,
                multiPageMode: false,
                startPage: 1,
                endPage: 10,
                autoScan: false,
                showNotifications: true,
                darkMode: false
            };

            await chrome.storage.sync.set({ settings: defaultSettings });
            console.log('Default settings saved');
        } catch (error) {
            console.error('Failed to save default settings:', error);
        }
    }

    // จัดการการอัปเดต
    handleUpdate(details) {
        const currentVersion = chrome.runtime.getManifest().version;
        console.log(`Updated from ${details.previousVersion} to ${currentVersion}`);
        
        // Migration logic ถ้าจำเป็น
        this.migrateSettings(details.previousVersion, currentVersion);
    }

    // ย้ายการตั้งค่าเก่า
    async migrateSettings(oldVersion, newVersion) {
        try {
            const result = await chrome.storage.sync.get('settings');
            if (result.settings) {
                // เพิ่มการตั้งค่าใหม่ถ้าไม่มี
                const updatedSettings = {
                    ...result.settings,
                    // เพิ่มการตั้งค่าใหม่ในเวอร์ชันใหม่
                    autoScan: result.settings.autoScan ?? false,
                    showNotifications: result.settings.showNotifications ?? true,
                    darkMode: result.settings.darkMode ?? false
                };
                
                await chrome.storage.sync.set({ settings: updatedSettings });
            }
        } catch (error) {
            console.error('Migration failed:', error);
        }
    }

    // จัดการข้อความ
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'scanPage':
                    const result = await this.scanPage(sender.tab, request.options);
                    sendResponse({ success: true, result });
                    break;

                case 'downloadImages':
                    await this.downloadImages(request.images, request.options);
                    sendResponse({ success: true });
                    break;

                case 'downloadSingle':
                    const downloadId = await this.downloadSingleImage(request.image, request.options);
                    sendResponse({ success: true, downloadId });
                    break;

                case 'getDownloadStats':
                    sendResponse(this.downloadStats);
                    break;

                case 'clearStats':
                    this.clearStats();
                    sendResponse({ success: true });
                    break;

                case 'cancelDownloads':
                    await this.cancelAllDownloads();
                    sendResponse({ success: true });
                    break;

                case 'getActiveDownloads':
                    sendResponse(Array.from(this.activeDownloads.values()));
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    // ดาวน์โหลดภาพหลายรูป
    async downloadImages(images, options = {}) {
        const { concurrency = 3, delay = 500, folder = '' } = options;
        
        this.downloadStats.total += images.length;
        
        // แบ่งเป็น batches
        for (let i = 0; i < images.length; i += concurrency) {
            const batch = images.slice(i, i + concurrency);
            
            // ดาวน์โหลดแบบ parallel
            const promises = batch.map(async (image, index) => {
                try {
                    const filename = this.generateFilename(image, i + index + 1, options);
                    const fullPath = folder ? `${folder}/${filename}` : filename;
                    
                    return await this.downloadSingleImage(image, { 
                        ...options, 
                        filename: fullPath 
                    });
                } catch (error) {
                    console.error(`Download failed for ${image.url}:`, error);
                    this.downloadStats.failed++;
                    throw error;
                }
            });

            await Promise.allSettled(promises);

            // หน่วงเวลาระหว่าง batch
            if (i + concurrency < images.length && delay > 0) {
                await this.sleep(delay);
            }
        }
    }

    // ดาวน์โหลดภาพเดี่ยว
    async downloadSingleImage(image, options = {}) {
        return new Promise((resolve, reject) => {
            const downloadId = Date.now() + Math.random();
            const filename = options.filename || this.generateFilename(image, 1, options);

            // เก็บข้อมูลการดาวน์โหลด
            this.activeDownloads.set(downloadId, {
                id: downloadId,
                url: image.url,
                filename: filename,
                status: 'starting',
                startTime: Date.now()
            });

            try {
                chrome.downloads.download({
                    url: image.url,
                    filename: filename,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (chromeDownloadId) => {
                    if (chrome.runtime.lastError) {
                        this.activeDownloads.delete(downloadId);
                        this.downloadStats.failed++;
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        // อัปเดตข้อมูลการดาวน์โหลด
                        const downloadInfo = this.activeDownloads.get(downloadId);
                        if (downloadInfo) {
                            downloadInfo.chromeDownloadId = chromeDownloadId;
                            downloadInfo.status = 'downloading';
                        }
                        
                        resolve(chromeDownloadId);
                    }
                });
            } catch (error) {
                this.activeDownloads.delete(downloadId);
                this.downloadStats.failed++;
                reject(error);
            }
        });
    }

    // สร้างชื่อไฟล์
    generateFilename(image, index, options = {}) {
        const { namingPattern = 'original', customPattern = '', filePrefix = '' } = options;
        const now = new Date();
        const extension = this.getFileExtension(image.url) || 'jpg';
        
        let filename = '';
        
        switch (namingPattern) {
            case 'numbered':
                filename = `${index.toString().padStart(3, '0')}.${extension}`;
                break;
                
            case 'timestamp':
                const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                filename = `${timestamp}.${extension}`;
                break;
                
            case 'site-numbered':
                const site = image.site || this.extractSiteFromUrl(image.url);
                filename = `${site}_${index.toString().padStart(3, '0')}.${extension}`;
                break;
                
            case 'custom':
                filename = this.applyCustomPattern(image, index, extension, customPattern);
                break;
                
            default: // original
                filename = this.getOriginalFilename(image.url) || `image_${index}.${extension}`;
        }

        // เพิ่มคำนำหน้า
        if (filePrefix) {
            filename = filePrefix + filename;
        }

        // ทำความสะอาดชื่อไฟล์
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        return filename;
    }

    // ดึงชื่อเว็บไซต์จาก URL
    extractSiteFromUrl(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }

    // ใช้รูปแบบกำหนดเอง
    applyCustomPattern(image, index, extension, pattern) {
        const now = new Date();
        const site = image.site || this.extractSiteFromUrl(image.url);
        
        const replacements = {
            '{site}': site,
            '{index}': index.toString().padStart(3, '0'),
            '{date}': now.toISOString().slice(0, 10),
            '{time}': now.toTimeString().slice(0, 8).replace(/:/g, '-'),
            '{width}': (image.width || 0).toString(),
            '{height}': (image.height || 0).toString(),
            '{page}': (image.page || 1).toString().padStart(3, '0'),
            '{timestamp}': now.getTime().toString()
        };

        let result = pattern;
        Object.entries(replacements).forEach(([key, value]) => {
            result = result.replace(new RegExp(key.replace(/[{}]/g, '\\// Advanced Image Downloader - Background Service Worker
class BackgroundService {
    constructor() {
        this.downloadQueue = [];
        this.activeDownloads = new Map();
        this.downloadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            totalSize: 0
        };
        
        this.init();
    }

    init() {
        // ฟังการติดตั้ง Extension
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // ฟังข้อความจาก popup และ content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // สำหรับ async response
        });

        // ฟังการเปลี่ยนแปลงของ tab
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // ฟังการปิด tab
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoved(tabId);
        });

        // ฟังการเปลี่ยนแปลงของการดาวน์โหลด
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            this.handleDownloadChange(downloadDelta);
        });

        // ฟังการจบการดาวน์โหลด
        chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
            this.handleFilenameRequest(downloadItem, suggest);
        });

        // ตั้งค่า context menu
        this.setupContextMenu();

        // ตั้งค่า alarms สำหรับการทำความสะอาด
        this.setupCleanupAlarms();
    }

    // จัดการการติดตั้ง
    handleInstall(details) {
        if (details.reason === 'install') {
            // ติดตั้งใหม่
            this.showWelcomeNotification();
            this.setDefaultSettings();
        } else if (details.reason === 'update') {
            // อัปเดต
            this.handleUpdate(details);
        }
    }

    // แสดงการแจ้งเตือนต้อนรับ
    showWelcomeNotification() {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Advanced Image Downloader ติดตั้งเสร็จสิ้น!',
            message: 'คลิกที่ไอคอน Extension เพื่อเริ่มใช้งาน'
        });
    }

    // ตั้งค่าเริ่มต้น
    async setDefaultSettings() {
        const defaultSettings = {
            minWidth: 100,
            minHeight: 100,
            minFileSize: 10,
            fileFormats: ['jpg', 'png', 'gif', 'webp', 'svg'],
            urlContains: '',
            urlExcludes: '',
            namingPattern: 'original',
            customPattern: '{site}_{index}_{date}',
            filePrefix: '',
            downloadConcurrency: 3,
            downloadDelay: 500,
            thumbnailSize: 'medium',
            showImageInfo: true,
            enableHotkeys: true,
            multiPageMode: false,
            startPage: 1,
            endPage: 10,
            autoScan: false,
            showNotifications: true,
            darkMode: false
        };

        await chrome.storage.sync.set({ settings: defaultSettings });
    }

    // จัดการการอัปเดต
    handleUpdate(details) {
        const currentVersion = chrome.runtime.getManifest().version;
        console.log(`Updated from ${details.previousVersion} to ${currentVersion}`);
        
        // Migration logic ถ้าจำเป็น
        this.migrateSettings(details.previousVersion, currentVersion);
    }

    // ย้ายการตั้งค่าเก่า
    async migrateSettings(oldVersion, newVersion) {
        try {
            const result = await chrome.storage.sync.get('settings');
            if (result.settings) {
                // เพิ่มการตั้งค่าใหม่ถ้าไม่มี
                const updatedSettings = {
                    ...result.settings,
                    // เพิ่มการตั้งค่าใหม่ในเวอร์ชันใหม่
                    autoScan: result.settings.autoScan ?? false,
                    showNotifications: result.settings.showNotifications ?? true,
                    darkMode: result.settings.darkMode ?? false
                };
                
                await chrome.storage.sync.set({ settings: updatedSettings });
            }
        } catch (error) {
            console.error('Migration failed:', error);
        }
    }

    // จัดการข้อความ
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'scanPage':
                    await this.scanPage(sender.tab, request.options);
                    sendResponse({ success: true });
                    break;

                case 'downloadImages':
                    await this.downloadImages(request.images, request.options);
                    sendResponse({ success: true });
                    break;

                case 'downloadSingle':
                    await this.downloadSingleImage(request.image, request.options);
                    sendResponse({ success: true });
                    break;

                case 'getDownloadStats':
                    sendResponse(this.downloadStats);
                    break;

                case 'clearStats':
                    this.clearStats();
                    sendResponse({ success: true });
                    break;

                case 'cancelDownloads':
                    await this.cancelAllDownloads();
                    sendResponse({ success: true });
                    break;

                case 'getActiveDownloads':
                    sendResponse(Array.from(this.activeDownloads.values()));
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    // สแกนหน้าเว็บ
    async scanPage(tab, options = {}) {
        try {
            // ส่งข้อความไปยัง content script
            const result = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractImages',
                options: options
            });

            return result;
        } catch (error) {
            console.error('Page scan error:', error);
            throw error;
        }
    }

    // ดาวน์โหลดภาพหลายรูป
    async downloadImages(images, options = {}) {
        const { concurrency = 3, delay = 500, folder = '' } = options;
        
        this.downloadStats.total += images.length;
        
        // แบ่งเป็น batches
        for (let i = 0; i < images.length; i += concurrency) {
            const batch = images.slice(i, i + concurrency);
            
            // ดาวน์โหลดแบบ parallel
            const promises = batch.map(async (image, index) => {
                try {
                    const filename = this.generateFilename(image, i + index + 1, options);
                    const fullPath = folder ? `${folder}/${filename}` : filename;
                    
                    return await this.downloadSingleImage(image, { 
                        ...options, 
                        filename: fullPath 
                    });
                } catch (error) {
                    console.error(`Download failed for ${image.'), 'g'), value);
        });

        return `${result}.${extension}`;
    }

    // ดึงชื่อไฟล์เดิม
    getOriginalFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename && filename.includes('.') ? filename : null;
        } catch {
            return null;
        }
    }

    // ดึงนามสกุลไฟล์
    getFileExtension(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const match = pathname.match(/\.([a-z0-9]+)$/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    // จัดการการเปลี่ยนแปลงของ tab
    handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
            // หน้าโหลดเสร็จแล้ว สามารถสแกนภาพได้
            this.checkAutoScan(tab);
        }
    }

    // ตรวจสอบการสแกนอัตโนมัติ
    async checkAutoScan(tab) {
        try {
            const result = await chrome.storage.sync.get('settings');
            if (result.settings && result.settings.autoScan) {
                // สแกนอัตโนมัติถ้าเปิดใช้งาน (อาจทำในอนาคต)
                console.log('Auto scan enabled for:', tab.url);
            }
        } catch (error) {
            console.error('Auto scan error:', error);
        }
    }

    // จัดการการปิด tab
    handleTabRemoved(tabId) {
        // ยกเลิกการดาวน์โหลดที่เกี่ยวข้องกับ tab นี้
        this.activeDownloads.forEach((download, id) => {
            if (download.tabId === tabId) {
                this.cancelDownload(id);
            }
        });
    }

    // จัดการการเปลี่ยนแปลงของการดาวน์โหลด
    handleDownloadChange(downloadDelta) {
        const { id, state, filename, totalBytes, bytesReceived } = downloadDelta;
        
        // หาข้อมูลการดาวน์โหลดที่ตรงกัน
        let downloadInfo = null;
        for (const [key, info] of this.activeDownloads.entries()) {
            if (info.chromeDownloadId === id) {
                downloadInfo = info;
                break;
            }
        }

        if (!downloadInfo) return;

        // อัปเดตสถานะ
        if (state) {
            if (state.current === 'complete') {
                downloadInfo.status = 'completed';
                downloadInfo.endTime = Date.now();
                this.downloadStats.completed++;
                this.downloadStats.totalSize += totalBytes || 0;
                
                // ลบออกจาก active downloads
                setTimeout(() => {
                    this.activeDownloads.delete(downloadInfo.id);
                }, 5000); // เก็บไว้ 5 วินาทีเพื่อแสดงสถานะ
                
            } else if (state.current === 'interrupted') {
                downloadInfo.status = 'failed';
                downloadInfo.error = state.current;
                this.downloadStats.failed++;
                this.activeDownloads.delete(downloadInfo.id);
            }
        }

        // อัปเดต progress
        if (totalBytes && bytesReceived) {
            downloadInfo.progress = (bytesReceived / totalBytes) * 100;
            downloadInfo.bytesReceived = bytesReceived;
            downloadInfo.totalBytes = totalBytes;
        }

        // ส่งข้อมูลอัปเดตไปยัง popup ถ้าเปิดอยู่
        this.notifyPopupUpdate(downloadInfo);
    }

    // ตั้งค่า context menu
    setupContextMenu() {
        try {
            if (chrome.contextMenus && chrome.contextMenus.create) {
                chrome.contextMenus.create({
                    id: 'download-image',
                    title: 'ดาวน์โหลดภาพนี้',
                    contexts: ['image'],
                    documentUrlPatterns: ['http://*/*', 'https://*/*']
                });

                chrome.contextMenus.create({
                    id: 'scan-page',
                    title: 'สแกนภาพในหน้านี้',
                    contexts: ['page'],
                    documentUrlPatterns: ['http://*/*', 'https://*/*']
                });

                chrome.contextMenus.onClicked.addListener((info, tab) => {
                    this.handleContextMenuClick(info, tab);
                });
            }
        } catch (error) {
            console.log('Context menu not available:', error);
        }
    }

    // จัดการ context menu click
    async handleContextMenuClick(info, tab) {
        try {
            if (info.menuItemId === 'download-image') {
                const image = {
                    url: info.srcUrl,
                    site: new URL(tab.url).hostname
                };
                await this.downloadSingleImage(image);
                
            } else if (info.menuItemId === 'scan-page') {
                // ส่งข้อความไปยัง popup หรือ content script
                console.log('Scan page requested');
            }
        } catch (error) {
            console.error('Context menu action failed:', error);
        }
    }

    // ยกเลิกการดาวน์โหลดทั้งหมด
    async cancelAllDownloads() {
        const promises = Array.from(this.activeDownloads.values()).map(download => {
            if (download.chromeDownloadId) {
                return chrome.downloads.cancel(download.chromeDownloadId).catch(() => {});
            }
        });

        await Promise.allSettled(promises);
        this.activeDownloads.clear();
    }

    // ยกเลิกการดาวน์โหลดเดี่ยว
    async cancelDownload(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (download && download.chromeDownloadId) {
            try {
                await chrome.downloads.cancel(download.chromeDownloadId);
            } catch (error) {
                console.error('Cancel download error:', error);
            }
        }
        this.activeDownloads.delete(downloadId);
    }

    // ล้างสถิติ
    clearStats() {
        this.downloadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            totalSize: 0
        };
    }

    // แจ้งเตือน popup ว่ามีการอัปเดต
    notifyPopupUpdate(downloadInfo) {
        // ส่งข้อความไปยัง popup ถ้าเปิดอยู่
        try {
            chrome.runtime.sendMessage({
                action: 'downloadUpdate',
                download: downloadInfo
            }).catch(() => {
                // Popup ไม่ได้เปิดอยู่
            });
        } catch (error) {
            // Ignore errors when popup is not open
        }
    }

    // หน่วงเวลา
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// เริ่มต้นการทำงาน
const backgroundService = new BackgroundService();url}:`, error);
                    this.downloadStats.failed++;
                    throw error;
                }
            });

            await Promise.allSettled(promises);

            // หน่วงเวลาระหว่าง batch
            if (i + concurrency < images.length && delay > 0) {
                await this.sleep(delay);
            }
        }
    }

    // ดาวน์โหลดภาพเดี่ยว
    async downloadSingleImage(image, options = {}) {
        return new Promise((resolve, reject) => {
            const downloadId = Date.now() + Math.random();
            const filename = options.filename || this.generateFilename(image, 1, options);

            // เก็บข้อมูลการดาวน์โหลด
            this.activeDownloads.set(downloadId, {
                id: downloadId,
                url: image.url,
                filename: filename,
                status: 'starting',
                startTime: Date.now()
            });

            chrome.downloads.download({
                url: image.url,
                filename: filename,
                conflictAction: 'uniquify',
                saveAs: false
            }, (chromeDownloadId) => {
                if (chrome.runtime.lastError) {
                    this.activeDownloads.delete(downloadId);
                    this.downloadStats.failed++;
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // อัปเดตข้อมูลการดาวน์โหลด
                    const downloadInfo = this.activeDownloads.get(downloadId);
                    if (downloadInfo) {
                        downloadInfo.chromeDownloadId = chromeDownloadId;
                        downloadInfo.status = 'downloading';
                    }
                    
                    resolve(chromeDownloadId);
                }
            });
        });
    }

    // สร้างชื่อไฟล์
    generateFilename(image, index, options = {}) {
        const { namingPattern = 'original', customPattern = '', filePrefix = '' } = options;
        const now = new Date();
        const extension = this.getFileExtension(image.url) || 'jpg';
        
        let filename = '';
        
        switch (namingPattern) {
            case 'numbered':
                filename = `${index.toString().padStart(3, '0')}.${extension}`;
                break;
                
            case 'timestamp':
                const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                filename = `${timestamp}.${extension}`;
                break;
                
            case 'site-numbered':
                const site = image.site || new URL(image.url).hostname;
                filename = `${site}_${index.toString().padStart(3, '0')}.${extension}`;
                break;
                
            case 'custom':
                filename = this.applyCustomPattern(image, index, extension, customPattern);
                break;
                
            default: // original
                filename = this.getOriginalFilename(image.url) || `image_${index}.${extension}`;
        }

        // เพิ่มคำนำหน้า
        if (filePrefix) {
            filename = filePrefix + filename;
        }

        // ทำความสะอาดชื่อไฟล์
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        return filename;
    }

    // ใช้รูปแบบกำหนดเอง
    applyCustomPattern(image, index, extension, pattern) {
        const now = new Date();
        const site = image.site || new URL(image.url).hostname;
        
        const replacements = {
            '{site}': site,
            '{index}': index.toString().padStart(3, '0'),
            '{date}': now.toISOString().slice(0, 10),
            '{time}': now.toTimeString().slice(0, 8).replace(/:/g, '-'),
            '{width}': (image.width || 0).toString(),
            '{height}': (image.height || 0).toString(),
            '{page}': (image.page || 1).toString().padStart(3, '0'),
            '{timestamp}': now.getTime().toString()
        };

        let result = pattern;
        Object.entries(replacements).forEach(([key, value]) => {
            result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        });

        return `${result}.${extension}`;
    }

    // ดึงชื่อไฟล์เดิม
    getOriginalFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename && filename.includes('.') ? filename : null;
        } catch {
            return null;
        }
    }

    // ดึงนามสกุลไฟล์
    getFileExtension(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const match = pathname.match(/\.([a-z0-9]+)$/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    // จัดการการเปลี่ยนแปลงของ tab
    handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
            // หน้าโหลดเสร็จแล้ว สามารถสแกนภาพได้
            this.checkAutoScan(tab);
        }
    }

    // ตรวจสอบการสแกนอัตโนมัติ
    async checkAutoScan(tab) {
        try {
            const result = await chrome.storage.sync.get('settings');
            if (result.settings && result.settings.autoScan) {
                // สแกนอัตโนมัติถ้าเปิดใช้งาน
                await this.scanPage(tab);
            }
        } catch (error) {
            console.error('Auto scan error:', error);
        }
    }

    // จัดการการปิด tab
    handleTabRemoved(tabId) {
        // ยกเลิกการดาวน์โหลดที่เกี่ยวข้องกับ tab นี้
        this.activeDownloads.forEach((download, id) => {
            if (download.tabId === tabId) {
                this.cancelDownload(id);
            }
        });
    }

    // จัดการการเปลี่ยนแปลงของการดาวน์โหลด
    handleDownloadChange(downloadDelta) {
        const { id, state, filename, totalBytes, bytesReceived } = downloadDelta;
        
        // หาข้อมูลการดาวน์โหลดที่ตรงกัน
        let downloadInfo = null;
        for (const [key, info] of this.activeDownloads.entries()) {
            if (info.chromeDownloadId === id) {
                downloadInfo = info;
                break;
            }
        }

        if (!downloadInfo) return;

        // อัปเดตสถานะ
        if (state) {
            if (state.current === 'complete') {
                downloadInfo.status = 'completed';
                downloadInfo.endTime = Date.now();
                this.downloadStats.completed++;
                this.downloadStats.totalSize += totalBytes || 0;
                
                // ลบออกจาก active downloads
                setTimeout(() => {
                    this.activeDownloads.delete(downloadInfo.id);
                }, 5000); // เก็บไว้ 5 วินาทีเพื่อแสดงสถานะ
                
            } else if (state.current === 'interrupted') {
                downloadInfo.status = 'failed';
                downloadInfo.error = state.current;
                this.downloadStats.failed++;
                this.activeDownloads.delete(downloadInfo.id);
            }
        }

        // อัปเดต progress
        if (totalBytes && bytesReceived) {
            downloadInfo.progress = (bytesReceived / totalBytes) * 100;
            downloadInfo.bytesReceived = bytesReceived;
            downloadInfo.totalBytes = totalBytes;
        }

        // ส่งข้อมูลอัปเดตไปยัง popup ถ้าเปิดอยู่
        this.notifyPopupUpdate(downloadInfo);
    }

    // จัดการคำขอชื่อไฟล์
    handleFilenameRequest(downloadItem, suggest) {
        // ใช้ชื่อไฟล์ที่กำหนดไว้
        suggest({});
    }

    // ตั้งค่า context menu
    setupContextMenu() {
        chrome.contextMenus.create({
            id: 'download-image',
            title: 'ดาวน์โหลดภาพนี้',
            contexts: ['image'],
            documentUrlPatterns: ['http://*/*', 'https://*/*']
        });

        chrome.contextMenus.create({
            id: 'scan-page',
            title: 'สแกนภาพในหน้านี้',
            contexts: ['page'],
            documentUrlPatterns: ['http://*/*', 'https://*/*']
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    // จัดการ context menu click
    async handleContextMenuClick(info, tab) {
        try {
            if (info.menuItemId === 'download-image') {
                const image = {
                    url: info.srcUrl,
                    site: new URL(tab.url).hostname
                };
                await this.downloadSingleImage(image);
                
            } else if (info.menuItemId === 'scan-page') {
                await this.scanPage(tab);
            }
        } catch (error) {
            console.error('Context menu action failed:', error);
        }
    }

    // ตั้งค่า alarms สำหรับการทำความสะอาด
    setupCleanupAlarms() {
        // ทำความสะอาดทุก 1 ชั่วโมง
        chrome.alarms.create('cleanup', { periodInMinutes: 60 });
        
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'cleanup') {
                this.cleanupOldDownloads();
            }
        });
    }

    // ทำความสะอาดการดาวน์โหลดเก่า
    cleanupOldDownloads() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

        for (const [id, download] of this.activeDownloads.entries()) {
            if (download.endTime && (now - download.endTime) > maxAge) {
                this.activeDownloads.delete(id);
            }
        }
    }

    // ยกเลิกการดาวน์โหลดทั้งหมด
    async cancelAllDownloads() {
        const promises = Array.from(this.activeDownloads.values()).map(download => {
            if (download.chromeDownloadId) {
                return chrome.downloads.cancel(download.chromeDownloadId);
            }
        });

        await Promise.allSettled(promises);
        this.activeDownloads.clear();
    }

    // ยกเลิกการดาวน์โหลดเดี่ยว
    async cancelDownload(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (download && download.chromeDownloadId) {
            await chrome.downloads.cancel(download.chromeDownloadId);
        }
        this.activeDownloads.delete(downloadId);
    }

    // ล้างสถิติ
    clearStats() {
        this.downloadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            totalSize: 0
        };
    }

    // แจ้งเตือน popup ว่ามีการอัปเดต
    notifyPopupUpdate(downloadInfo) {
        // ส่งข้อความไปยัง popup ถ้าเปิดอยู่
        chrome.runtime.sendMessage({
            action: 'downloadUpdate',
            download: downloadInfo
        }).catch(() => {
            // Popup ไม่ได้เปิดอยู่
        });
    }

    // หน่วงเวลา
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// เริ่มต้นการทำงาน
const backgroundService = new BackgroundService();