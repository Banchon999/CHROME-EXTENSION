/**
 * Advanced Image Downloader Pro - Enhanced Download Manager
 * ระบบจัดการการดาวน์โหลดขั้นสูงสำหรับ background service worker
 */

class EnhancedDownloadManager extends DownloadManager {
    constructor() {
        super();
        
        // Enhanced properties
        this.streamProcessor = new StreamProcessor();
        this.corsHandler = new CorsHandler();
        this.conversionEngine = new ImageConversionEngine();
        this.qualityAnalyzer = new ImageQualityAnalyzer();
        
        // Advanced queue management
        this.priorityQueue = new PriorityQueue();
        this.failedQueue = new FailedDownloadQueue();
        this.streamQueue = new StreamDownloadQueue();
        
        // Performance tracking
        this.performanceMetrics = {
            averageSpeed: 0,
            totalBandwidth: 0,
            concurrentOptimal: 3,
            retrySuccess: 0,
            corsProxySuccess: {}
        };
        
        // Enhanced settings
        this.advancedSettings = {
            enableStreaming: true,
            enableConversion: true,
            enableQualityAnalysis: true,
            maxFileSize: 100 * 1024 * 1024, // 100MB
            streamThreshold: 10 * 1024 * 1024, // 10MB
            corsProxies: [
                'https://api.allorigins.win/raw?url=',
                'https://cors-anywhere.herokuapp.com/',
                'https://proxy.cors.sh/',
                'https://corsproxy.io/?'
            ],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        
        this.setupAdvancedListeners();
    }
    
    // ================== ENHANCED DOWNLOAD REQUEST HANDLING ==================
    async handleAdvancedDownloadRequest(message, sender, sendResponse) {
        try {
            const { images, settings, tabId } = message;
            
            if (!images || !Array.isArray(images) || images.length === 0) {
                sendResponse({ success: false, error: 'ไม่มีภาพให้ดาวน์โหลด' });
                return;
            }
            
            // Enhanced settings merge
            const enhancedSettings = { 
                ...this.advancedSettings, 
                ...settings,
                tabId: tabId 
            };
            
            // Initialize enhanced download stats
            this.downloadStats = {
                total: images.length,
                completed: 0,
                failed: 0,
                successful: 0,
                streamed: 0,
                converted: 0,
                corsProxied: 0,
                qualityEnhanced: 0,
                totalSize: 0,
                averageSpeed: 0,
                startTime: Date.now()
            };
            
            // Phase 1: Analyze and prioritize images
            const analyzedImages = await this.analyzeImageBatch(images, enhancedSettings);
            
            // Phase 2: Create optimized download strategy
            const downloadStrategy = await this.createDownloadStrategy(analyzedImages, enhancedSettings);
            
            // Phase 3: Prepare folder structure
            const folderStructure = await this.createAdvancedFolderStructure(enhancedSettings, tabId);
            
            // Phase 4: Execute downloads with advanced handling
            await this.executeAdvancedDownloadBatch(downloadStrategy, folderStructure, enhancedSettings);
            
            sendResponse({ 
                success: true, 
                message: `เริ่มดาวน์โหลดขั้นสูง ${images.length} ไฟล์`,
                strategy: downloadStrategy.summary,
                folderStructure: folderStructure
            });
            
        } catch (error) {
            console.error('Enhanced download request error:', error);
            sendResponse({ 
                success: false, 
                error: error.message || 'เกิดข้อผิดพลาดในการเริ่มดาวน์โหลด' 
            });
        }
    }
    
    // ================== IMAGE ANALYSIS ==================
    async analyzeImageBatch(images, settings) {
        const analyzedImages = [];
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            try {
                // Quality analysis
                const qualityScore = await this.qualityAnalyzer.analyzeImage(image);
                
                // Size estimation
                const estimatedSize = this.estimateAdvancedFileSize(image);
                
                // Download complexity assessment
                const complexity = this.assessDownloadComplexity(image);
                
                // Priority calculation
                const priority = this.calculateDownloadPriority(image, qualityScore, complexity);
                
                analyzedImages.push({
                    ...image,
                    id: `img_${Date.now()}_${i}`,
                    analysis: {
                        qualityScore,
                        estimatedSize,
                        complexity,
                        priority,
                        requiresStreaming: estimatedSize > settings.streamThreshold,
                        requiresCors: this.requiresCorsHandling(image.url),
                        requiresConversion: this.requiresConversion(image),
                        processingTime: Date.now()
                    }
                });
                
            } catch (error) {
                console.error(`Analysis failed for image ${i}:`, error);
                analyzedImages.push({
                    ...image,
                    id: `img_${Date.now()}_${i}`,
                    analysis: {
                        error: error.message,
                        priority: 50, // Default priority
                        complexity: 'unknown'
                    }
                });
            }
        }
        
        return analyzedImages;
    }
    
    // ================== DOWNLOAD STRATEGY ==================
    async createDownloadStrategy(analyzedImages, settings) {
        // Sort images by priority and complexity
        const sortedImages = [...analyzedImages].sort((a, b) => {
            if (a.analysis.priority !== b.analysis.priority) {
                return b.analysis.priority - a.analysis.priority;
            }
            return a.analysis.complexity === 'simple' ? -1 : 1;
        });
        
        const strategy = {
            simple: [],      // Direct downloads
            streaming: [],   // Large files requiring streaming
            cors: [],        // Files requiring CORS proxy
            conversion: [],  // Files requiring format conversion
            failed: [],      // Previously failed downloads
            
            batches: [],
            summary: {}
        };
        
        // Categorize images
        sortedImages.forEach(image => {
            const { analysis } = image;
            
            if (analysis.requiresStreaming) {
                strategy.streaming.push(image);
            } else if (analysis.requiresCors) {
                strategy.cors.push(image);
            } else if (analysis.requiresConversion) {
                strategy.conversion.push(image);
            } else {
                strategy.simple.push(image);
            }
        });
        
        // Create download batches
        const concurrentLimit = this.calculateOptimalConcurrency(strategy, settings);
        strategy.batches = this.createDownloadBatches(sortedImages, concurrentLimit);
        
        // Generate summary
        strategy.summary = {
            totalImages: analyzedImages.length,
            simple: strategy.simple.length,
            streaming: strategy.streaming.length,
            cors: strategy.cors.length,
            conversion: strategy.conversion.length,
            batches: strategy.batches.length,
            concurrentLimit: concurrentLimit,
            estimatedTime: this.estimateDownloadTime(strategy)
        };
        
        return strategy;
    }
    
    calculateOptimalConcurrency(strategy, settings) {
        const baseLimit = settings.concurrentDownloads || 3;
        
        // Adjust based on download types
        let adjustment = 0;
        
        if (strategy.streaming.length > strategy.simple.length) {
            adjustment -= 1; // Reduce for streaming downloads
        }
        
        if (strategy.cors.length > strategy.simple.length) {
            adjustment -= 1; // Reduce for CORS proxy downloads
        }
        
        const optimal = Math.max(1, Math.min(baseLimit + adjustment, 8));
        this.performanceMetrics.concurrentOptimal = optimal;
        
        return optimal;
    }
    
    createDownloadBatches(images, concurrentLimit) {
        const batches = [];
        
        for (let i = 0; i < images.length; i += concurrentLimit) {
            const batch = images.slice(i, i + concurrentLimit);
            batches.push({
                id: `batch_${batches.length + 1}`,
                images: batch,
                size: batch.length,
                estimatedTime: batch.reduce((sum, img) => 
                    sum + (img.analysis.estimatedSize / 1024 / 1024 * 2), 0) // 2 seconds per MB
            });
        }
        
        return batches;
    }
    
    // ================== ADVANCED FOLDER STRUCTURE ==================
    async createAdvancedFolderStructure(settings, tabId) {
        const structure = {
            baseFolder: '',
            subFolders: {
                images: 'images',
                highQuality: 'high-quality',
                converted: 'converted',
                metadata: 'metadata'
            },
            organization: settings.organizationPattern || 'type'
        };
        
        // Generate base folder name
        try {
            const tab = await chrome.tabs.get(tabId);
            const url = new URL(tab.url);
            const siteName = url.hostname.replace(/^www\./, '');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            
            structure.baseFolder = settings.folderName || `${siteName}_${timestamp}`;
        } catch (error) {
            structure.baseFolder = `images_${Date.now()}`;
        }
        
        // Sanitize folder names
        Object.keys(structure.subFolders).forEach(key => {
            structure.subFolders[key] = structure.subFolders[key].replace(/[<>:"/\\|?*]/g, '_');
        });
        
        structure.baseFolder = structure.baseFolder.replace(/[<>:"/\\|?*]/g, '_');
        
        return structure;
    }
    
    // ================== ADVANCED DOWNLOAD EXECUTION ==================
    async executeAdvancedDownloadBatch(strategy, folderStructure, settings) {
        this.notifyProgress('info', `เริ่มการดาวน์โหลดขั้นสูง: ${strategy.summary.totalImages} ไฟล์ใน ${strategy.summary.batches} กลุ่ม`);
        
        // Process batches sequentially, images in batch concurrently
        for (let batchIndex = 0; batchIndex < strategy.batches.length; batchIndex++) {
            const batch = strategy.batches[batchIndex];
            
            this.notifyProgress('info', `กำลังประมวลผลกลุ่มที่ ${batchIndex + 1}/${strategy.batches.length}`);
            
            // Process batch images concurrently
            const batchPromises = batch.images.map(image => 
                this.downloadSingleImageAdvanced(image, folderStructure, settings)
            );
            
            await Promise.allSettled(batchPromises);
            
            // Small delay between batches to prevent overwhelming
            if (batchIndex < strategy.batches.length - 1) {
                await this.delay(200);
            }
        }
        
        // Handle failed downloads with retry logic
        await this.handleFailedDownloads(settings);
        
        // Generate download completion report
        await this.generateDownloadReport(strategy, folderStructure, settings);
        
        this.notifyDownloadComplete();
    }
    
    async downloadSingleImageAdvanced(image, folderStructure, settings) {
        const startTime = Date.now();
        
        try {
            this.downloadStats.attempted++;
            
            // Phase 1: Extract image with advanced techniques
            const extractedData = await this.extractImageAdvanced(image, settings);
            
            // Phase 2: Process image (conversion, quality enhancement)
            const processedData = await this.processImageAdvanced(extractedData, settings);
            
            // Phase 3: Determine download method
            const downloadMethod = this.selectDownloadMethod(processedData, image.analysis);
            
            // Phase 4: Execute download
            const downloadResult = await this.executeDownloadMethod(
                downloadMethod, 
                processedData, 
                image, 
                folderStructure, 
                settings
            );
            
            // Phase 5: Post-processing
            await this.postProcessDownload(downloadResult, image, settings);
            
            // Update statistics
            const downloadTime = Date.now() - startTime;
            this.updatePerformanceMetrics(downloadResult, downloadTime);
            
            this.downloadStats.successful++;
            this.notifyProgress('success', `ดาวน์โหลดสำเร็จ: ${image.filename || 'รูปภาพ'}`);
            
        } catch (error) {
            console.error(`Advanced download failed for ${image.url}:`, error);
            this.downloadStats.failed++;
            
            // Add to failed queue for retry
            this.failedQueue.add({
                image,
                error: error.message,
                attempt: 1,
                timestamp: Date.now()
            });
            
            this.notifyProgress('error', `ดาวน์โหลดล้มเหลว: ${error.message}`);
        } finally {
            this.downloadStats.completed++;
            this.notifyProgress('progress', null);
        }
    }
    
    async extractImageAdvanced(image, settings) {
        // Use the advanced extractor from extractor.js
        if (window.advancedImageExtractor) {
            return window.advancedImageExtractor.extractImageData(image.element, {
                preferHighQuality: true,
                enableConversion: settings.enableConversion,
                useCorsProxy: true,
                maxRetries: settings.retryAttempts,
                timeout: 30000
            });
        }
        
        // Fallback to basic extraction
        return this.basicImageExtraction(image);
    }
    
    async processImageAdvanced(extractedData, settings) {
        const processedData = { ...extractedData };
        
        try {
            // Quality enhancement
            if (settings.enableQualityAnalysis && extractedData.blob) {
                const qualityMetrics = await this.qualityAnalyzer.analyzeBlob(extractedData.blob);
                processedData.qualityMetrics = qualityMetrics;
                
                if (qualityMetrics.score < 70 && qualityMetrics.enhanceable) {
                    processedData.enhanced = await this.enhanceImageQuality(extractedData.blob);
                    this.downloadStats.qualityEnhanced++;
                }
            }
            
            // Format conversion
            if (settings.enableConversion && this.conversionEngine.needsConversion(extractedData)) {
                processedData.converted = await this.conversionEngine.convertImage(
                    extractedData.blob, 
                    settings.preferredFormat || 'png'
                );
                this.downloadStats.converted++;
            }
            
            // Metadata preservation
            if (settings.preserveMetadata && extractedData.metadata) {
                processedData.metadataFile = await this.createMetadataFile(extractedData.metadata);
            }
            
        } catch (error) {
            console.warn('Image processing failed:', error);
            // Continue with original data
        }
        
        return processedData;
    }
    
    selectDownloadMethod(processedData, analysis) {
        if (analysis.requiresStreaming) {
            return 'streaming';
        } else if (analysis.requiresCors) {
            return 'cors-proxy';
        } else if (processedData.blob) {
            return 'blob-download';
        } else {
            return 'direct-download';
        }
    }
    
    async executeDownloadMethod(method, processedData, image, folderStructure, settings) {
        switch (method) {
            case 'streaming':
                return this.streamProcessor.downloadLargeFile(
                    processedData.url, 
                    this.generateFileName(image, folderStructure, settings)
                );
                
            case 'cors-proxy':
                return this.corsHandler.downloadWithProxy(
                    processedData.url,
                    this.generateFileName(image, folderStructure, settings),
                    this.advancedSettings.corsProxies
                );
                
            case 'blob-download':
                return this.downloadBlobAdvanced(
                    processedData.blob || processedData.enhanced?.blob || processedData.converted?.blob,
                    this.generateFileName(image, folderStructure, settings)
                );
                
            default:
                return this.downloadDirectAdvanced(
                    processedData.url,
                    this.generateFileName(image, folderStructure, settings)
                );
        }
    }
    
    // ================== SPECIALIZED DOWNLOAD METHODS ==================
    async downloadBlobAdvanced(blob, filename) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            
            const downloadOptions = {
                url: url,
                filename: filename,
                saveAs: false,
                conflictAction: 'uniquify'
            };
            
            chrome.downloads.download(downloadOptions, (downloadId) => {
                if (chrome.runtime.lastError) {
                    URL.revokeObjectURL(url);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                // Track download completion
                const cleanup = () => URL.revokeObjectURL(url);
                this.trackDownloadCompletion(downloadId, resolve, reject, cleanup);
            });
        });
    }
    
    async downloadDirectAdvanced(url, filename) {
        return new Promise((resolve, reject) => {
            const downloadOptions = {
                url: url,
                filename: filename,
                saveAs: false,
                conflictAction: 'uniquify',
                headers: [{
                    name: 'User-Agent',
                    value: this.advancedSettings.userAgent
                }]
            };
            
            chrome.downloads.download(downloadOptions, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                this.trackDownloadCompletion(downloadId, resolve, reject);
            });
        });
    }
    
    trackDownloadCompletion(downloadId, resolve, reject, cleanup = null) {
        const listener = (downloadDelta) => {
            if (downloadDelta.id !== downloadId) return;
            
            if (downloadDelta.state?.current === 'complete') {
                chrome.downloads.onChanged.removeListener(listener);
                if (cleanup) cleanup();
                resolve({ downloadId, success: true });
            } else if (downloadDelta.state?.current === 'interrupted') {
                chrome.downloads.onChanged.removeListener(listener);
                if (cleanup) cleanup();
                reject(new Error(`Download interrupted: ${downloadDelta.error?.current || 'Unknown error'}`));
            }
        };
        
        chrome.downloads.onChanged.addListener(listener);
        
        // Timeout handling
        setTimeout(() => {
            chrome.downloads.onChanged.removeListener(listener);
            if (cleanup) cleanup();
            reject(new Error('Download timeout'));
        }, 300000); // 5 minutes timeout
    }
    
    // ================== UTILITY CLASSES ==================
    generateFileName(image, folderStructure, settings) {
        let filename = image.filename || this.extractFilenameFromUrl(image.url) || 'image';
        
        // Apply naming pattern
        switch (settings.namingPattern) {
            case 'numbered':
                const index = this.downloadStats.completed + 1;
                const extension = this.getFileExtension(filename);
                filename = `${index.toString().padStart(4, '0')}.${extension}`;
                break;
                
            case 'timestamp':
                const timestamp = Date.now();
                const ext = this.getFileExtension(filename);
                filename = `${timestamp}.${ext}`;
                break;
                
            case 'quality':
                const quality = image.analysis?.qualityScore || 50;
                const qualityLabel = quality > 80 ? 'high' : quality > 50 ? 'medium' : 'low';
                filename = `${qualityLabel}_${filename}`;
                break;
        }
        
        // Add folder structure
        let fullPath = filename;
        
        if (settings.createSubfolder && folderStructure.baseFolder) {
            // Organize by type/quality
            let subFolder = folderStructure.baseFolder;
            
            if (image.analysis?.qualityScore > 80) {
                subFolder += `/${folderStructure.subFolders.highQuality}`;
            } else {
                subFolder += `/${folderStructure.subFolders.images}`;
            }
            
            fullPath = `${subFolder}/${filename}`;
        }
        
        return fullPath.replace(/[<>:"/\\|?*]/g, '_');
    }
    
    extractFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            return pathParts[pathParts.length - 1] || 'image';
        } catch (error) {
            return 'image';
        }
    }
    
    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() : 'jpg';
    }
    
    // ================== PERFORMANCE TRACKING ==================
    updatePerformanceMetrics(downloadResult, downloadTime) {
        // Update average speed calculation
        if (downloadResult.size && downloadTime) {
            const speed = downloadResult.size / (downloadTime / 1000); // bytes per second
            this.performanceMetrics.averageSpeed = 
                (this.performanceMetrics.averageSpeed + speed) / 2;
            this.performanceMetrics.totalBandwidth += downloadResult.size;
        }
    }
    
    // ================== ENHANCED HELPERS ==================
    assessDownloadComplexity(image) {
        let complexity = 'simple';
        
        if (image.url.startsWith('blob:') || image.url.startsWith('data:')) {
            complexity = 'blob';
        } else if (this.requiresCorsHandling(image.url)) {
            complexity = 'cors';
        } else if (image.estimatedSize > 10 * 1024 * 1024) {
            complexity = 'large';
        }
        
        return complexity;
    }
    
    calculateDownloadPriority(image, qualityScore, complexity) {
        let priority = 50; // Base priority
        
        // Quality bonus
        priority += qualityScore * 0.3;
        
        // Size factor
        if (image.estimatedSize > 1024 * 1024) {
            priority += 10; // Larger images get higher priority
        }
        
        // Complexity penalty
        switch (complexity) {
            case 'cors': priority -= 5; break;
            case 'large': priority -= 10; break;
            case 'blob': priority += 5; break;
        }
        
        return Math.max(0, Math.min(100, priority));
    }
    
    estimateAdvancedFileSize(image) {
        if (image.estimatedSize) return image.estimatedSize;
        
        const { width, height } = image;
        if (!width || !height) return 1024 * 1024; // 1MB default
        
        const pixels = width * height;
        
        // Advanced estimation based on image characteristics
        let bytesPerPixel = 3; // Default for JPEG
        
        if (image.type === 'png') bytesPerPixel = 4;
        else if (image.type === 'webp') bytesPerPixel = 2;
        else if (image.type === 'gif') bytesPerPixel = 1;
        
        return pixels * bytesPerPixel;
    }
    
    requiresCorsHandling(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.origin !== window.location.origin;
        } catch (error) {
            return false;
        }
    }
    
    requiresConversion(image) {
        const unsupportedFormats = ['webp', 'avif', 'heic'];
        return unsupportedFormats.includes(image.type);
    }
    
    estimateDownloadTime(strategy) {
        const { simple, streaming, cors, conversion } = strategy;
        
        // Base time estimates (seconds)
        const timeEstimates = {
            simple: simple.length * 2,
            streaming: streaming.length * 10,
            cors: cors.length * 5,
            conversion: conversion.length * 3
        };
        
        return Object.values(timeEstimates).reduce((sum, time) => sum + time, 0);
    }
    
    setupAdvancedListeners() {
        // Enhanced message handling
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'startAdvancedDownload') {
                this.handleAdvancedDownloadRequest(message, sender, sendResponse);
                return true;
            }
        });
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ================== SPECIALIZED UTILITY CLASSES ==================

class StreamProcessor {
    async downloadLargeFile(url, filename) {
        // Implementation for streaming large files
        throw new Error('Streaming downloads not yet implemented');
    }
}

class CorsHandler {
    async downloadWithProxy(url, filename, proxies) {
        // Implementation for CORS proxy downloads
        throw new Error('CORS proxy downloads not yet implemented');
    }
}

class ImageConversionEngine {
    needsConversion(extractedData) {
        const unsupportedFormats = ['image/webp', 'image/avif', 'image/heic'];
        return unsupportedFormats.includes(extractedData.mimeType);
    }
    
    async convertImage(blob, targetFormat) {
        // Implementation for image conversion
        throw new Error('Image conversion not yet implemented');
    }
}

class ImageQualityAnalyzer {
    async analyzeImage(image) {
        // Basic quality analysis based on dimensions and URL patterns
        const { width, height, url } = image;
        let score = 50; // Base score
        
        // Size factor
        const pixels = width * height;
        if (pixels > 2000000) score += 20; // >2MP
        else if (pixels > 500000) score += 10; // >0.5MP
        
        // URL quality indicators
        const qualityIndicators = ['hd', 'high', 'large', 'full', 'original', '1080', '4k'];
        const lowQualityIndicators = ['thumb', 'small', 'preview', 'low'];
        
        const urlLower = url.toLowerCase();
        
        qualityIndicators.forEach(indicator => {
            if (urlLower.includes(indicator)) score += 15;
        });
        
        lowQualityIndicators.forEach(indicator => {
            if (urlLower.includes(indicator)) score -= 20;
        });
        
        return Math.max(0, Math.min(100, score));
    }
    
    async analyzeBlob(blob) {
        return {
            score: 70, // Default score
            enhanceable: false,
            issues: []
        };
    }
}

class PriorityQueue {
    constructor() {
        this.items = [];
    }
    
    add(item) {
        this.items.push(item);
        this.items.sort((a, b) => b.priority - a.priority);
    }
    
    next() {
        return this.items.shift();
    }
    
    isEmpty() {
        return this.items.length === 0;
    }
}

class FailedDownloadQueue {
    constructor() {
        this.items = [];
    }
    
    add(item) {
        this.items.push(item);
    }
    
    getRetryable() {
        return this.items.filter(item => item.attempt < 3);
    }
    
    clear() {
        this.items = [];
    }
}

class StreamDownloadQueue {
    constructor() {
        this.items = [];
    }
    
    add(item) {
        this.items.push(item);
    }
    
    next() {
        return this.items.shift();
    }
}

// ================== GLOBAL REPLACEMENT ==================
// Replace the original DownloadManager with enhanced version
if (typeof window !== 'undefined') {
    window.EnhancedDownloadManager = EnhancedDownloadManager;
}