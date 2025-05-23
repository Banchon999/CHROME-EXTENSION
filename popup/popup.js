/**
 * Advanced Image Downloader Pro - Popup Controller
 * สำหรับการควบคุม UI และการสื่อสารกับ content scripts
 */

class PopupController {
    constructor() {
        this.currentTab = null;
        this.scanResults = [];
        this.settings = {};
        this.isScanning = false;
        
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        await this.getCurrentTab();
        this.setupEventListeners();
        this.setupRangeSliders();
        this.updateUI();
        this.checkTabCompatibility();
    }
    
    // ================== TAB MANAGEMENT ==================
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
        return tab;
    }
    
    checkTabCompatibility() {
        if (!this.currentTab || this.currentTab.url.startsWith('chrome://')) {
            this.showStatus('ไม่สามารถใช้งานได้กับหน้านี้', 'error');
            this.disableMainActions();
        } else {
            this.showStatus('พร้อมใช้งาน', 'success');
        }
    }
    
    // ================== SETTINGS MANAGEMENT ==================
    async loadSettings() {
        const defaultSettings = {
            fileTypes: {
                jpg: true, png: true, webp: true, gif: true, svg: false, blob: true
            },
            minWidth: 100,
            minHeight: 100,
            scanDepth: 2,
            followPagination: true,
            followGallery: true,
            infiniteScroll: true,
            createSubfolder: true,
            folderName: '',
            namingPattern: 'original',
            concurrentDownloads: 3,
            retryAttempts: 3,
            customPatterns: '',
            debugMode: false,
            showProgress: true
        };
        
        const stored = await chrome.storage.sync.get('settings');
        this.settings = { ...defaultSettings, ...stored.settings };
        this.applySettingsToUI();
    }
    
    async saveSettings() {
        await chrome.storage.sync.set({ settings: this.settings });
        this.showStatus('บันทึกการตั้งค่าแล้ว', 'success');
    }
    
    applySettingsToUI() {
        // File types
        Object.keys(this.settings.fileTypes).forEach(type => {
            const checkbox = document.getElementById(type);
            if (checkbox) checkbox.checked = this.settings.fileTypes[type];
        });
        
        // Size filters
        document.getElementById('minWidth').value = this.settings.minWidth;
        document.getElementById('minHeight').value = this.settings.minHeight;
        
        // Deep scan settings
        document.getElementById('scanDepth').value = this.settings.scanDepth;
        document.getElementById('depthValue').textContent = this.settings.scanDepth;
        document.getElementById('followPagination').checked = this.settings.followPagination;
        document.getElementById('followGallery').checked = this.settings.followGallery;
        document.getElementById('infiniteScroll').checked = this.settings.infiniteScroll;
        
        // Download settings
        document.getElementById('createSubfolder').checked = this.settings.createSubfolder;
        document.getElementById('folderName').value = this.settings.folderName;
        document.getElementById('namingPattern').value = this.settings.namingPattern;
        
        // Advanced settings
        document.getElementById('concurrentDownloads').value = this.settings.concurrentDownloads;
        document.getElementById('concurrentValue').textContent = this.settings.concurrentDownloads;
        document.getElementById('retryAttempts').value = this.settings.retryAttempts;
        document.getElementById('retryValue').textContent = this.settings.retryAttempts;
        document.getElementById('customPatterns').value = this.settings.customPatterns;
        document.getElementById('debugMode').checked = this.settings.debugMode;
        document.getElementById('showProgress').checked = this.settings.showProgress;
    }
    
    collectSettingsFromUI() {
        // File types
        Object.keys(this.settings.fileTypes).forEach(type => {
            const checkbox = document.getElementById(type);
            if (checkbox) this.settings.fileTypes[type] = checkbox.checked;
        });
        
        // Size filters
        this.settings.minWidth = parseInt(document.getElementById('minWidth').value) || 100;
        this.settings.minHeight = parseInt(document.getElementById('minHeight').value) || 100;
        
        // Deep scan settings
        this.settings.scanDepth = parseInt(document.getElementById('scanDepth').value);
        this.settings.followPagination = document.getElementById('followPagination').checked;
        this.settings.followGallery = document.getElementById('followGallery').checked;
        this.settings.infiniteScroll = document.getElementById('infiniteScroll').checked;
        
        // Download settings
        this.settings.createSubfolder = document.getElementById('createSubfolder').checked;
        this.settings.folderName = document.getElementById('folderName').value.trim();
        this.settings.namingPattern = document.getElementById('namingPattern').value;
        
        // Advanced settings
        this.settings.concurrentDownloads = parseInt(document.getElementById('concurrentDownloads').value);
        this.settings.retryAttempts = parseInt(document.getElementById('retryAttempts').value);
        this.settings.customPatterns = document.getElementById('customPatterns').value.trim();
        this.settings.debugMode = document.getElementById('debugMode').checked;
        this.settings.showProgress = document.getElementById('showProgress').checked;
    }
    
    // ================== EVENT LISTENERS ==================
    setupEventListeners() {
        // Main action buttons
        document.getElementById('scanPage').addEventListener('click', () => this.scanCurrentPage());
        document.getElementById('deepScan').addEventListener('click', () => this.performDeepScan());
        document.getElementById('downloadAll').addEventListener('click', () => this.downloadAllImages());
        
        // Settings buttons
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.collectSettingsFromUI();
            this.saveSettings();
        });
        
        document.getElementById('resetSettings').addEventListener('click', () => this.resetSettings());
        document.getElementById('exportResults').addEventListener('click', () => this.exportResults());
        
        // Collapsible sections
        document.querySelectorAll('.collapsible h3').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
        
        // Auto-save on input changes
        this.setupAutoSave();
    }
    
    setupRangeSliders() {
        // Scan depth slider
        const depthSlider = document.getElementById('scanDepth');
        const depthValue = document.getElementById('depthValue');
        depthSlider.addEventListener('input', (e) => {
            depthValue.textContent = e.target.value;
        });
        
        // Concurrent downloads slider
        const concurrentSlider = document.getElementById('concurrentDownloads');
        const concurrentValue = document.getElementById('concurrentValue');
        concurrentSlider.addEventListener('input', (e) => {
            concurrentValue.textContent = e.target.value;
        });
        
        // Retry attempts slider
        const retrySlider = document.getElementById('retryAttempts');
        const retryValue = document.getElementById('retryValue');
        retrySlider.addEventListener('input', (e) => {
            retryValue.textContent = e.target.value;
        });
    }
    
    setupAutoSave() {
        // Auto-save settings on change with debounce
        let saveTimeout;
        const autoSaveElements = [
            'minWidth', 'minHeight', 'folderName', 'customPatterns'
        ];
        
        autoSaveElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        this.collectSettingsFromUI();
                        this.saveSettings();
                    }, 1000);
                });
            }
        });
        
        // Checkbox auto-save
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.collectSettingsFromUI();
                this.saveSettings();
            });
        });
    }
    
    // ================== MAIN ACTIONS ==================
    async scanCurrentPage() {
        if (this.isScanning) return;
        
        this.startScanning();
        this.collectSettingsFromUI();
        
        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'scanPage',
                settings: this.settings
            });
            
            if (response && response.success) {
                this.scanResults = response.images || [];
                this.updateStats();
                this.showStatus(`พบภาพ ${this.scanResults.length} รูป`, 'success');
            } else {
                throw new Error(response?.error || 'ไม่สามารถสแกนหน้าเว็บได้');
            }
        } catch (error) {
            console.error('Scan error:', error);
            this.showStatus('เกิดข้อผิดพลาดในการสแกน', 'error');
            this.logMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.stopScanning();
        }
    }
    
    async performDeepScan() {
        if (this.isScanning) return;
        
        this.startScanning();
        this.collectSettingsFromUI();
        
        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'deepScan',
                settings: this.settings
            });
            
            if (response && response.success) {
                this.scanResults = response.images || [];
                this.updateStats();
                this.showStatus(`Deep Scan เสร็จสิ้น: พบภาพ ${this.scanResults.length} รูป`, 'success');
            } else {
                throw new Error(response?.error || 'ไม่สามารถทำ Deep Scan ได้');
            }
        } catch (error) {
            console.error('Deep scan error:', error);
            this.showStatus('เกิดข้อผิดพลาดใน Deep Scan', 'error');
            this.logMessage(`Deep Scan Error: ${error.message}`, 'error');
        } finally {
            this.stopScanning();
        }
    }
    
    async downloadAllImages() {
        if (this.scanResults.length === 0) {
            this.showStatus('ไม่มีภาพให้ดาวน์โหลด กรุณาสแกนหน้าเว็บก่อน', 'error');
            return;
        }
        
        this.collectSettingsFromUI();
        this.showProgressSection(true);
        
        try {
            // Send download request to background script
            const response = await chrome.runtime.sendMessage({
                action: 'startDownload',
                images: this.scanResults,
                settings: this.settings,
                tabId: this.currentTab.id
            });
            
            if (response && response.success) {
                this.showStatus(`เริ่มดาวน์โหลด ${this.scanResults.length} ไฟล์`, 'success');
                this.logMessage(`Starting download of ${this.scanResults.length} images`, 'info');
            } else {
                throw new Error(response?.error || 'ไม่สามารถเริ่มดาวน์โหลดได้');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showStatus('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
            this.logMessage(`Download Error: ${error.message}`, 'error');
        }
    }
    
    // ================== UI MANAGEMENT ==================
    updateUI() {
        this.updateStats();
        this.updateStatus();
    }
    
    updateStats() {
        document.getElementById('imageCount').textContent = this.scanResults.length;
        document.getElementById('pageCount').textContent = '1'; // Will be dynamic in Project 2
        
        // Calculate total size (estimate)
        let totalSize = 0;
        this.scanResults.forEach(img => {
            totalSize += img.estimatedSize || 0;
        });
        
        const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
        document.getElementById('totalSize').textContent = `${sizeInMB} MB`;
    }
    
    updateStatus() {
        // Status updates are handled by showStatus method
    }
    
    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        
        // Auto-clear status after 5 seconds
        setTimeout(() => {
            if (statusElement.textContent === message) {
                statusElement.textContent = 'พร้อมใช้งาน';
                statusElement.className = 'status';
            }
        }, 5000);
    }
    
    showProgressSection(show) {
        const progressSection = document.getElementById('progressSection');
        progressSection.style.display = show ? 'block' : 'none';
        
        if (show) {
            progressSection.classList.add('fade-in');
        }
    }
    
    updateProgress(current, total, message = '') {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${current} / ${total}`;
        
        if (message) {
            this.logMessage(message, 'info');
        }
    }
    
    logMessage(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Keep only last 50 log entries
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }
    
    startScanning() {
        this.isScanning = true;
        document.getElementById('scanPage').disabled = true;
        document.getElementById('deepScan').disabled = true;
        document.getElementById('scanPage').classList.add('scanning');
        document.getElementById('deepScan').classList.add('scanning');
        this.showStatus('กำลังสแกน...', 'info');
    }
    
    stopScanning() {
        this.isScanning = false;
        document.getElementById('scanPage').disabled = false;
        document.getElementById('deepScan').disabled = false;
        document.getElementById('scanPage').classList.remove('scanning');
        document.getElementById('deepScan').classList.remove('scanning');
    }
    
    disableMainActions() {
        document.getElementById('scanPage').disabled = true;
        document.getElementById('deepScan').disabled = true;
        document.getElementById('downloadAll').disabled = true;
    }
    
    // ================== UTILITY METHODS ==================
    async resetSettings() {
        if (confirm('ต้องการรีเซ็ตการตั้งค่าทั้งหมดหรือไม่?')) {
            await chrome.storage.sync.clear();
            await this.loadSettings();
            this.showStatus('รีเซ็ตการตั้งค่าแล้ว', 'success');
        }
    }
    
    async exportResults() {
        if (this.scanResults.length === 0) {
            this.showStatus('ไม่มีผลลัพธ์ให้ส่งออก', 'error');
            return;
        }
        
        const exportData = {
            url: this.currentTab.url,
            timestamp: new Date().toISOString(),
            settings: this.settings,
            images: this.scanResults.map(img => ({
                url: img.url,
                src: img.src,
                alt: img.alt,
                width: img.width,
                height: img.height,
                type: img.type,
                estimatedSize: img.estimatedSize
            }))
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-scan-results-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showStatus('ส่งออกผลลัพธ์แล้ว', 'success');
    }
    
    // ================== MESSAGE HANDLING ==================
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'downloadProgress':
                    this.updateProgress(message.current, message.total, message.message);
                    break;
                    
                case 'downloadComplete':
                    this.showStatus(`ดาวน์โหลดเสร็จสิ้น: ${message.successful}/${message.total} ไฟล์`, 'success');
                    this.logMessage(`Download completed: ${message.successful} successful, ${message.failed} failed`, 'success');
                    break;
                    
                case 'downloadError':
                    this.logMessage(`Download error: ${message.error}`, 'error');
                    break;
                    
                case 'scanProgress':
                    this.showStatus(message.message, 'info');
                    break;
            }
        });
    }
}

// ================== INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupController();
    popup.setupMessageListener();
    
    // Global error handler
    window.addEventListener('error', (event) => {
        console.error('Popup error:', event.error);
        popup.showStatus('เกิดข้อผิดพลาดในระบบ', 'error');
    });
});

// ================== UTILITY FUNCTIONS ==================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateFileName(originalUrl, index, pattern, customName = '') {
    const url = new URL(originalUrl);
    const pathParts = url.pathname.split('/');
    const originalName = pathParts[pathParts.length - 1] || `image_${index}`;
    const extension = originalName.split('.').pop() || 'jpg';
    const nameWithoutExt = originalName.replace(`.${extension}`, '');
    
    switch (pattern) {
        case 'numbered':
            return `${index.toString().padStart(4, '0')}.${extension}`;
        case 'timestamp':
            return `${Date.now()}_${index}.${extension}`;
        case 'custom':
            return customName ? `${customName}_${index}.${extension}` : originalName;
        default:
            return originalName;
    }
}

function isValidImageUrl(url) {
    try {
        new URL(url);
        return /\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff)(\?.*)?$/i.test(url) || 
               url.includes('blob:') || 
               url.startsWith('data:image/');
    } catch {
        return false;
    }
}