/**
 * Advanced Image Downloader Pro - Main Content Script
 * ตัวประสานงานหลักระหว่าง popup กับ scanner engine
 */

class ContentScriptController {
    constructor() {
        this.isReady = false;
        this.scanResults = null;
        this.currentSettings = {};
        
        this.init();
    }
    
    // ================== INITIALIZATION ==================
    async init() {
        try {
            // Wait for dependencies to load
            await this.waitForDependencies();
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup message listeners
            this.setupMessageListeners();
            
            // Mark as ready
            this.isReady = true;
            
            console.log('🚀 Advanced Image Downloader Pro: Content script ready');
            
        } catch (error) {
            console.error('Content script initialization failed:', error);
        }
    }
    
    async waitForDependencies() {
        const maxWait = 5000; // 5 seconds
        const checkInterval = 100;
        let waited = 0;
        
        while (waited < maxWait) {
            if (window.sitePatternManager && window.contentScanner) {
                return true;
            }
            
            await this.delay(checkInterval);
            waited += checkInterval;
        }
        
        throw new Error('Dependencies not loaded within timeout');
    }
    
    async initializeComponents() {
        // Initialize site pattern detection
        if (window.sitePatternManager) {
            const siteInfo = window.sitePatternManager.detectSiteType();
            console.log('🎯 Detected site type:', siteInfo.type);
            
            if (siteInfo.pattern?.characteristics?.debugMode) {
                window.sitePatternManager.logDetectionResults();
            }
        }
        
        // Initialize content scanner
        if (window.contentScanner) {
            console.log('🔍 Content scanner initialized');
        }
    }
    
    // ================== MESSAGE HANDLING ==================
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Handle async responses
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }
    
    async handleMessage(message, sender, sendResponse) {
        try {
            if (!this.isReady) {
                sendResponse({
                    success: false,
                    error: 'Content script not ready yet'
                });
                return;
            }
            
            switch (message.action) {
                case 'scanPage':
                    await this.handleScanPage(message, sendResponse);
                    break;
                    
                case 'deepScan':
                    await this.handleDeepScan(message, sendResponse);
                    break;
                    
                case 'getSiteInfo':
                    await this.handleGetSiteInfo(message, sendResponse);
                    break;
                    
                case 'testSelectors':
                    await this.handleTestSelectors(message, sendResponse);
                    break;
                    
                case 'getPageStructure':
                    await this.handleGetPageStructure(message, sendResponse);
                    break;
                    
                case 'ping':
                    sendResponse({ success: true, ready: this.isReady });
                    break;
                    
                default:
                    sendResponse({
                        success: false,
                        error: `Unknown action: ${message.action}`
                    });
            }
            
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({
                success: false,
                error: error.message || 'Content script error'
            });
        }
    }
    
    // ================== SCAN HANDLERS ==================
    async handleScanPage(message, sendResponse) {
        try {
            this.currentSettings = message.settings || {};
            
            console.log('🔍 Starting page scan with settings:', this.currentSettings);
            
            // Perform the scan
            const result = await window.contentScanner.scanCurrentPage(this.currentSettings);
            
            // Store results for potential follow-up operations
            this.scanResults = result;
            
            // Log scan results in debug mode
            if (this.currentSettings.debugMode) {
                console.group('📊 Scan Results');
                console.log('Success:', result.success);
                console.log('Images found:', result.images?.length || 0);
                console.log('Site info:', result.siteInfo);
                console.log('Stats:', result.stats);
                console.groupEnd();
            }
            
            sendResponse(result);
            
        } catch (error) {
            console.error('Page scan error:', error);
            sendResponse({
                success: false,
                error: error.message,
                images: []
            });
        }
    }
    
    async handleDeepScan(message, sendResponse) {
        try {
            this.currentSettings = message.settings || {};
            
            console.log('🚀 Starting deep scan with settings:', this.currentSettings);
            
            // Validate deep scan settings
            if (this.currentSettings.scanDepth < 1) {
                throw new Error('Scan depth must be at least 1');
            }
            
            // Check if site supports deep scanning
            const siteInfo = window.sitePatternManager.detectSiteType();
            if (!window.sitePatternManager.supportsDeepScanning()) {
                console.warn('⚠️ Site may not support deep scanning optimally');
            }
            
            // Perform deep scan
            const result = await window.contentScanner.performDeepScan(this.currentSettings);
            
            // Store results
            this.scanResults = result;
            
            // Enhanced logging for deep scan
            if (this.currentSettings.debugMode) {
                console.group('🎯 Deep Scan Results');
                console.log('Success:', result.success);
                console.log('Images found:', result.images?.length || 0);
                console.log('Pages scanned:', result.stats?.pagesScanned || 1);
                console.log('Scan depth:', result.stats?.depth || 1);
                console.log('Site characteristics:', siteInfo.pattern?.characteristics);
                console.groupEnd();
            }
            
            sendResponse(result);
            
        } catch (error) {
            console.error('Deep scan error:', error);
            sendResponse({
                success: false,
                error: error.message,
                images: []
            });
        }
    }
    
    // ================== INFO HANDLERS ==================
    async handleGetSiteInfo(message, sendResponse) {
        try {
            const siteInfo = window.sitePatternManager.getDetectionInfo();
            const pageStructure = await this.analyzePageStructure();
            
            const response = {
                success: true,
                siteInfo,
                pageStructure,
                capabilities: {
                    canScan: true,
                    supportsDeepScan: window.sitePatternManager.supportsDeepScanning(),
                    needsSpecialHandling: window.sitePatternManager.needsSpecialHandling(),
                    hasInfiniteScroll: siteInfo.characteristics?.hasInfiniteScroll || false,
                    hasLazyLoading: siteInfo.characteristics?.hasLazyLoading || false
                }
            };
            
            sendResponse(response);
            
        } catch (error) {
            console.error('Get site info error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }
    
    async handleTestSelectors(message, sendResponse) {
        try {
            const { selectors } = message;
            const results = {};
            
            // Test each selector type
            for (const [type, selectorList] of Object.entries(selectors)) {
                results[type] = [];
                
                for (const selector of selectorList) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        results[type].push({
                            selector,
                            found: elements.length,
                            valid: elements.length > 0
                        });
                    } catch (error) {
                        results[type].push({
                            selector,
                            found: 0,
                            valid: false,
                            error: error.message
                        });
                    }
                }
            }
            
            sendResponse({
                success: true,
                results
            });
            
        } catch (error) {
            console.error('Test selectors error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }
    
    async handleGetPageStructure(message, sendResponse) {
        try {
            const structure = await this.analyzePageStructure();
            
            sendResponse({
                success: true,
                structure
            });
            
        } catch (error) {
            console.error('Get page structure error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }
    
    // ================== PAGE ANALYSIS ==================
    async analyzePageStructure() {
        const structure = {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            
            // Basic stats
            totalImages: document.querySelectorAll('img').length,
            totalLinks: document.querySelectorAll('a[href]').length,
            totalCanvases: document.querySelectorAll('canvas').length,
            totalVideos: document.querySelectorAll('video').length,
            
            // Content structure
            hasInfiniteScroll: this.detectInfiniteScroll(),
            hasLazyLoading: this.detectLazyLoading(),
            hasPagination: this.detectPagination(),
            hasGallery: this.detectGallery(),
            
            // Framework detection
            frameworks: this.detectFrameworks(),
            
            // Image sources
            imageSources: this.analyzeImageSources(),
            
            // Page characteristics
            scrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
            hasIframes: document.querySelectorAll('iframe').length > 0
        };
        
        return structure;
    }
    
    detectInfiniteScroll() {
        const indicators = [
            '.infinite-scroll',
            '.lazy-load',
            '[data-infinite]',
            '.load-more',
            '.auto-load'
        ];
        
        return indicators.some(selector => document.querySelector(selector));
    }
    
    detectLazyLoading() {
        const lazyImages = document.querySelectorAll([
            'img[data-src]',
            'img[data-original]',
            'img[loading="lazy"]',
            '.lazyload',
            '.lazy'
        ].join(', '));
        
        return lazyImages.length > 0;
    }
    
    detectPagination() {
        const paginationSelectors = [
            '.pagination',
            '.pager',
            '.page-numbers',
            '.nav-links',
            'a[rel="next"]',
            'a[rel="prev"]'
        ];
        
        return paginationSelectors.some(selector => document.querySelector(selector));
    }
    
    detectGallery() {
        const galleryIndicators = [
            '.gallery',
            '.grid',
            '.masonry',
            '.photo-grid',
            '.image-grid',
            '.lightbox'
        ];
        
        return galleryIndicators.some(selector => document.querySelector(selector));
    }
    
    detectFrameworks() {
        const frameworks = {};
        
        // React
        frameworks.react = !!(window.React || document.querySelector('[data-reactroot], [data-react-]') || window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
        
        // Vue
        frameworks.vue = !!(window.Vue || document.querySelector('[data-v-]') || window.__VUE__);
        
        // Angular
        frameworks.angular = !!(window.angular || document.querySelector('[ng-app], [data-ng-app]') || window.getAllAngularRootElements);
        
        // jQuery
        frameworks.jquery = !!(window.jQuery || window.$);
        
        // Next.js
        frameworks.nextjs = !!(window.__NEXT_DATA__ || document.querySelector('#__next'));
        
        // Nuxt.js
        frameworks.nuxtjs = !!(window.__NUXT__ || document.querySelector('#__nuxt'));
        
        // SPA indicators
        frameworks.spa = !!(
            frameworks.react || frameworks.vue || frameworks.angular ||
            document.querySelector('[data-reactroot], [data-v-], [ng-app]') ||
            history.pushState
        );
        
        return frameworks;
    }
    
    analyzeImageSources() {
        const images = document.querySelectorAll('img');
        const sources = {
            total: images.length,
            types: {},
            domains: {},
            protocols: {},
            attributes: {
                src: 0,
                dataSrc: 0,
                dataOriginal: 0,
                srcset: 0,
                lazy: 0
            }
        };
        
        images.forEach(img => {
            // Analyze URLs
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
            if (src) {
                try {
                    const url = new URL(src, window.location.href);
                    
                    // Count by protocol
                    sources.protocols[url.protocol] = (sources.protocols[url.protocol] || 0) + 1;
                    
                    // Count by domain
                    sources.domains[url.hostname] = (sources.domains[url.hostname] || 0) + 1;
                    
                    // Count by file type
                    const extension = src.split('.').pop()?.split('?')[0]?.toLowerCase();
                    if (extension) {
                        sources.types[extension] = (sources.types[extension] || 0) + 1;
                    }
                } catch (error) {
                    // Handle blob/data URLs
                    if (src.startsWith('blob:')) {
                        sources.types.blob = (sources.types.blob || 0) + 1;
                    } else if (src.startsWith('data:')) {
                        sources.types.dataUrl = (sources.types.dataUrl || 0) + 1;
                    }
                }
            }
            
            // Count attributes
            if (img.src) sources.attributes.src++;
            if (img.getAttribute('data-src')) sources.attributes.dataSrc++;
            if (img.getAttribute('data-original')) sources.attributes.dataOriginal++;
            if (img.srcset) sources.attributes.srcset++;
            if (img.loading === 'lazy' || img.classList.contains('lazy') || img.classList.contains('lazyload')) {
                sources.attributes.lazy++;
            }
        });
        
        return sources;
    }
    
    // ================== UTILITY METHODS ==================
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ================== DEBUG UTILITIES ==================
    debugScan() {
        console.group('🐛 Debug Scan Information');
        
        // Site detection
        const siteInfo = window.sitePatternManager?.getDetectionInfo();
        console.log('Site Detection:', siteInfo);
        
        // Page structure
        this.analyzePageStructure().then(structure => {
            console.log('Page Structure:', structure);
        });
        
        // Test default selectors
        const selectors = window.sitePatternManager?.getOptimizedSelectors();
        if (selectors) {
            console.log('Optimized Selectors:', selectors);
            
            // Test image selectors
            selectors.images.forEach((selector, index) => {
                try {
                    const elements = document.querySelectorAll(selector);
                    console.log(`Image Selector ${index + 1}: "${selector}" -> ${elements.length} elements`);
                } catch (error) {
                    console.log(`Image Selector ${index + 1}: "${selector}" -> ERROR: ${error.message}`);
                }
            });
        }
        
        console.groupEnd();
    }
    
    // ================== PERFORMANCE MONITORING ==================
    monitorPerformance() {
        const startTime = performance.now();
        
        return {
            mark: (label) => {
                const currentTime = performance.now();
                console.log(`⏱️ ${label}: ${(currentTime - startTime).toFixed(2)}ms`);
                return currentTime;
            },
            
            end: (label = 'Total') => {
                const endTime = performance.now();
                console.log(`✅ ${label}: ${(endTime - startTime).toFixed(2)}ms`);
                return endTime - startTime;
            }
        };
    }
    
    // ================== ERROR HANDLING ==================
    handleError(error, context = 'Unknown') {
        console.error(`❌ Error in ${context}:`, error);
        
        // Send error report to background script
        chrome.runtime.sendMessage({
            action: 'errorReport',
            error: {
                message: error.message,
                stack: error.stack,
                context: context,
                url: window.location.href,
                timestamp: Date.now()
            }
        }).catch(() => {
            // Background script might not be available
        });
    }
}

// ================== CONTENT SCRIPT UTILITIES ==================
class ContentScriptUtils {
    static injectCSS(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    }
    
    static createOverlay(content, className = 'ads-pro-overlay') {
        const overlay = document.createElement('div');
        overlay.className = className;
        overlay.innerHTML = content;
        
        // Basic overlay styles
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: '999999',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontFamily: 'Arial, sans-serif'
        });
        
        document.body.appendChild(overlay);
        return overlay;
    }
    
    static removeOverlay(className = 'ads-pro-overlay') {
        const overlays = document.querySelectorAll(`.${className}`);
        overlays.forEach(overlay => overlay.remove());
    }
    
    static highlightElements(selector, color = '#ff0000') {
        const elements = document.querySelectorAll(selector);
        const originalStyles = [];
        
        elements.forEach((element, index) => {
            originalStyles[index] = element.style.outline;
            element.style.outline = `2px solid ${color}`;
            element.style.outlineOffset = '2px';
        });
        
        return () => {
            elements.forEach((element, index) => {
                element.style.outline = originalStyles[index] || '';
            });
        };
    }
    
    static showImagePreview(imageData) {
        const previewHTML = `
            <div style="background: white; color: black; padding: 20px; border-radius: 10px; max-width: 500px; text-align: center;">
                <h3>Image Preview</h3>
                <img src="${imageData.url}" style="max-width: 400px; max-height: 300px; border: 1px solid #ccc;" />
                <div style="margin-top: 10px;">
                    <strong>Dimensions:</strong> ${imageData.width} × ${imageData.height}<br>
                    <strong>Type:</strong> ${imageData.type}<br>
                    <strong>Size:</strong> ${imageData.sizeFormatted || 'Unknown'}<br>
                    <strong>URL:</strong> <small>${imageData.url.substring(0, 50)}...</small>
                </div>
                <button onclick="this.closest('.ads-pro-overlay').remove()" style="margin-top: 15px; padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        return ContentScriptUtils.createOverlay(previewHTML);
    }
}

// ================== INITIALIZATION ==================
let contentController;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

function initializeContentScript() {
    try {
        contentController = new ContentScriptController();
        
        // Add global utilities
        window.adsProUtils = ContentScriptUtils;
        
        // Debug mode detection
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ads_debug') === 'true') {
            setTimeout(() => {
                if (contentController.isReady) {
                    contentController.debugScan();
                }
            }, 1000);
        }
        
    } catch (error) {
        console.error('Failed to initialize content script:', error);
    }
}

// ================== GLOBAL ERROR HANDLER ==================
window.addEventListener('error', (event) => {
    if (contentController) {
        contentController.handleError(event.error, 'Global Error Handler');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (contentController) {
        contentController.handleError(event.reason, 'Unhandled Promise Rejection');
    }
});

// ================== CLEANUP ON UNLOAD ==================
window.addEventListener('beforeunload', () => {
    if (contentController && contentController.isScanning) {
        contentController.stopScanning();
    }
});

// ================== EXPOSE FOR DEBUGGING ==================
if (typeof window !== 'undefined') {
    window.adsProContentController = contentController;
}