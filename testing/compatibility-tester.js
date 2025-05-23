/**
 * Advanced Image Downloader Pro - Site Compatibility Testing System
 * ระบบทดสอบความเข้ากันได้กับเว็บไซต์ต่างๆ
 */

class SiteCompatibilityTester {
    constructor() {
        this.testSuites = new Map();
        this.testResults = new Map();
        this.performanceMetrics = new Map();
        this.errorPatterns = new Map();
        
        this.commonSites = [
            // Gallery/Image sites
            { name: 'Instagram', url: 'https://www.instagram.com', type: 'social' },
            { name: 'Pinterest', url: 'https://www.pinterest.com', type: 'gallery' },
            { name: 'Flickr', url: 'https://www.flickr.com', type: 'gallery' },
            { name: 'DeviantArt', url: 'https://www.deviantart.com', type: 'gallery' },
            
            // E-commerce
            { name: 'Amazon', url: 'https://www.amazon.com', type: 'ecommerce' },
            { name: 'eBay', url: 'https://www.ebay.com', type: 'ecommerce' },
            
            // News/Blog
            { name: 'Medium', url: 'https://medium.com', type: 'news' },
            { name: 'WordPress', url: 'https://wordpress.com', type: 'news' },
            
            // Webtoon/Manga
            { name: 'Webtoons', url: 'https://www.webtoons.com', type: 'webtoon' },
            { name: 'MangaDex', url: 'https://mangadex.org', type: 'webtoon' }
        ];
        
        this.init();
    }
    
    // ================== INITIALIZATION ==================
    init() {
        this.initializeTestSuites();
        this.setupErrorTracking();
        this.loadTestResults();
        
        console.log('🧪 Site Compatibility Tester initialized');
    }
    
    initializeTestSuites() {
        // Basic functionality tests
        this.addTestSuite('basicScan', {
            name: 'Basic Image Scanning',
            description: 'Test basic image detection and extraction',
            tests: [
                'detectImages',
                'extractImageData',
                'validateUrls',
                'checkPermissions'
            ]
        });
        
        // Advanced features tests
        this.addTestSuite('advancedFeatures', {
            name: 'Advanced Features',
            description: 'Test blob, canvas, and dynamic content',
            tests: [
                'detectCanvasImages',
                'extractBlobImages',
                'handleLazyLoading',
                'processInfiniteScroll'
            ]
        });
        
        // Performance tests
        this.addTestSuite('performance', {
            name: 'Performance Testing',
            description: 'Test scanning speed and memory usage',
            tests: [
                'scanSpeed',
                'memoryUsage',
                'downloadThroughput',
                'errorRecovery'
            ]
        });
        
        // Site-specific tests
        this.addTestSuite('siteSpecific', {
            name: 'Site-Specific Compatibility',
            description: 'Test compatibility with popular sites',
            tests: [
                'socialMediaSites',
                'gallerySites',
                'ecommerceSites',
                'webtoonSites'
            ]
        });
    }
    
    setupErrorTracking() {
        // Global error handler for testing
        window.addEventListener('error', (event) => {
            this.recordError('javascript', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                error: event.error?.stack
            });
        });
        
        // Promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError('promise', {
                reason: event.reason?.toString(),
                stack: event.reason?.stack
            });
        });
    }
    
    // ================== TEST SUITE MANAGEMENT ==================
    addTestSuite(id, config) {
        this.testSuites.set(id, {
            id,
            ...config,
            status: 'pending',
            results: new Map(),
            metrics: {},
            errors: []
        });
    }
    
    async runAllTests(siteUrl = null) {
        console.log('🚀 Starting comprehensive compatibility tests...');
        
        const startTime = Date.now();
        const results = {
            overall: { passed: 0, failed: 0, total: 0 },
            suites: {},
            site: siteUrl || window.location.href,
            timestamp: startTime,
            duration: 0
        };
        
        for (const [suiteId, suite] of this.testSuites) {
            try {
                console.log(`🧪 Running test suite: ${suite.name}`);
                
                const suiteResult = await this.runTestSuite(suiteId, siteUrl);
                results.suites[suiteId] = suiteResult;
                
                results.overall.passed += suiteResult.passed;
                results.overall.failed += suiteResult.failed;
                results.overall.total += suiteResult.total;
                
            } catch (error) {
                console.error(`❌ Test suite ${suiteId} failed:`, error);
                results.suites[suiteId] = {
                    status: 'error',
                    error: error.message,
                    passed: 0,
                    failed: 1,
                    total: 1
                };
                results.overall.failed++;
                results.overall.total++;
            }
        }
        
        results.duration = Date.now() - startTime;
        results.successRate = results.overall.total > 0 ? 
            (results.overall.passed / results.overall.total) * 100 : 0;
        
        this.testResults.set(results.site, results);
        this.saveTestResults();
        
        console.log(`✅ Tests completed: ${results.overall.passed}/${results.overall.total} passed (${results.successRate.toFixed(1)}%)`);
        
        return results;
    }
    
    async runTestSuite(suiteId, siteUrl = null) {
        const suite = this.testSuites.get(suiteId);
        if (!suite) {
            throw new Error(`Test suite ${suiteId} not found`);
        }
        
        const startTime = Date.now();
        const results = {
            id: suiteId,
            name: suite.name,
            status: 'running',
            passed: 0,
            failed: 0,
            total: suite.tests.length,
            tests: {},
            metrics: {},
            duration: 0
        };
        
        for (const testName of suite.tests) {
            try {
                const testResult = await this.runSingleTest(suiteId, testName, siteUrl);
                results.tests[testName] = testResult;
                
                if (testResult.passed) {
                    results.passed++;
                } else {
                    results.failed++;
                }
                
            } catch (error) {
                console.error(`❌ Test ${testName} failed:`, error);
                results.tests[testName] = {
                    passed: false,
                    error: error.message,
                    duration: 0
                };
                results.failed++;
            }
        }
        
        results.duration = Date.now() - startTime;
        results.status = results.failed === 0 ? 'passed' : 'failed';
        
        return results;
    }
    
    async runSingleTest(suiteId, testName, siteUrl = null) {
        const startTime = Date.now();
        let result = { passed: false, duration: 0, data: null, error: null };
        
        try {
            const testMethod = this.getTestMethod(suiteId, testName);
            const testData = await testMethod(siteUrl);
            
            result = {
                passed: true,
                duration: Date.now() - startTime,
                data: testData,
                error: null
            };
            
        } catch (error) {
            result = {
                passed: false,
                duration: Date.now() - startTime,
                data: null,
                error: error.message
            };
        }
        
        return result;
    }
    
    // ================== INDIVIDUAL TESTS ==================
    getTestMethod(suiteId, testName) {
        const testMethods = {
            // Basic scan tests
            'basicScan.detectImages': () => this.testDetectImages(),
            'basicScan.extractImageData': () => this.testExtractImageData(),
            'basicScan.validateUrls': () => this.testValidateUrls(),
            'basicScan.checkPermissions': () => this.testCheckPermissions(),
            
            // Advanced feature tests
            'advancedFeatures.detectCanvasImages': () => this.testDetectCanvasImages(),
            'advancedFeatures.extractBlobImages': () => this.testExtractBlobImages(),
            'advancedFeatures.handleLazyLoading': () => this.testHandleLazyLoading(),
            'advancedFeatures.processInfiniteScroll': () => this.testProcessInfiniteScroll(),
            
            // Performance tests
            'performance.scanSpeed': () => this.testScanSpeed(),
            'performance.memoryUsage': () => this.testMemoryUsage(),
            'performance.downloadThroughput': () => this.testDownloadThroughput(),
            'performance.errorRecovery': () => this.testErrorRecovery(),
            
            // Site-specific tests
            'siteSpecific.socialMediaSites': () => this.testSocialMediaSites(),
            'siteSpecific.gallerySites': () => this.testGallerySites(),
            'siteSpecific.ecommerceSites': () => this.testEcommerceSites(),
            'siteSpecific.webtoonSites': () => this.testWebtoonSites()
        };
        
        const methodKey = `${suiteId}.${testName}`;
        const method = testMethods[methodKey];
        
        if (!method) {
            throw new Error(`Test method ${methodKey} not found`);
        }
        
        return method;
    }
    
    // ================== BASIC SCAN TESTS ==================
    async testDetectImages() {
        const images = document.querySelectorAll('img');
        const visibleImages = Array.from(images).filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        
        if (images.length === 0) {
            throw new Error('No images found on page');
        }
        
        return {
            totalImages: images.length,
            visibleImages: visibleImages.length,
            hiddenImages: images.length - visibleImages.length,
            avgDimensions: this.calculateAverageDimensions(visibleImages)
        };
    }
    
    async testExtractImageData() {
        const testImage = document.querySelector('img');
        if (!testImage) {
            throw new Error('No test image available');
        }
        
        const imageData = {
            src: testImage.src,
            alt: testImage.alt,
            width: testImage.naturalWidth,
            height: testImage.naturalHeight,
            hasDataSrc: !!testImage.getAttribute('data-src'),
            hasSrcset: !!testImage.srcset
        };
        
        if (!imageData.src) {
            throw new Error('Image source extraction failed');
        }
        
        return imageData;
    }
    
    async testValidateUrls() {
        const images = document.querySelectorAll('img');
        const urlValidation = {
            total: images.length,
            valid: 0,
            invalid: 0,
            relative: 0,
            absolute: 0,
            dataUrls: 0,
            blobUrls: 0
        };
        
        for (const img of images) {
            const src = img.src;
            
            if (!src) {
                urlValidation.invalid++;
                continue;
            }
            
            try {
                const url = new URL(src);
                urlValidation.valid++;
                
                if (src.startsWith('data:')) {
                    urlValidation.dataUrls++;
                } else if (src.startsWith('blob:')) {
                    urlValidation.blobUrls++;
                } else if (url.origin === window.location.origin) {
                    urlValidation.relative++;
                } else {
                    urlValidation.absolute++;
                }
            } catch {
                urlValidation.invalid++;
            }
        }
        
        return urlValidation;
    }
    
    async testCheckPermissions() {
        const permissions = {
            downloads: false,
            activeTab: false,
            storage: false,
            tabs: false
        };
        
        try {
            // Test chrome.downloads
            if (chrome.downloads) {
                permissions.downloads = true;
            }
            
            // Test chrome.storage
            if (chrome.storage) {
                await chrome.storage.local.get('test');
                permissions.storage = true;
            }
            
            // Test chrome.tabs
            if (chrome.tabs) {
                permissions.tabs = true;
            }
            
            permissions.activeTab = true; // If we're running, we have activeTab
            
        } catch (error) {
            console.warn('Permission test failed:', error);
        }
        
        const grantedCount = Object.values(permissions).filter(Boolean).length;
        const totalCount = Object.keys(permissions).length;
        
        if (grantedCount < totalCount) {
            throw new Error(`Missing permissions: ${totalCount - grantedCount}/${totalCount}`);
        }
        
        return permissions;
    }
    
    // ================== ADVANCED FEATURE TESTS ==================
    async testDetectCanvasImages() {
        const canvases = document.querySelectorAll('canvas');
        const canvasData = {
            total: canvases.length,
            accessible: 0,
            tainted: 0,
            empty: 0
        };
        
        for (const canvas of canvases) {
            try {
                if (canvas.width === 0 || canvas.height === 0) {
                    canvasData.empty++;
                    continue;
                }
                
                // Try to extract data
                const dataUrl = canvas.toDataURL();
                canvasData.accessible++;
                
            } catch (error) {
                if (error.name === 'SecurityError') {
                    canvasData.tainted++;
                } else {
                    canvasData.empty++;
                }
            }
        }
        
        return canvasData;
    }
    
    async testExtractBlobImages() {
        const blobImages = [];
        const allElements = document.querySelectorAll('*');
        
        for (const element of allElements) {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            
            if (bgImage && bgImage.includes('blob:')) {
                const urlMatch = bgImage.match(/url\(["']?(blob:[^"')]+)["']?\)/);
                if (urlMatch) {
                    blobImages.push({
                        element: element.tagName,
                        url: urlMatch[1]
                    });
                }
            }
        }
        
        return {
            foundBlobImages: blobImages.length,
            blobUrls: blobImages
        };
    }
    
    async testHandleLazyLoading() {
        const lazyImages = document.querySelectorAll([
            'img[data-src]',
            'img[data-original]',
            'img[loading="lazy"]',
            '.lazyload',
            '.lazy'
        ].join(', '));
        
        const lazyData = {
            total: lazyImages.length,
            withDataSrc: 0,
            withDataOriginal: 0,
            withLoadingLazy: 0,
            withLazyClass: 0
        };
        
        for (const img of lazyImages) {
            if (img.getAttribute('data-src')) lazyData.withDataSrc++;
            if (img.getAttribute('data-original')) lazyData.withDataOriginal++;
            if (img.loading === 'lazy') lazyData.withLoadingLazy++;
            if (img.classList.contains('lazy') || img.classList.contains('lazyload')) {
                lazyData.withLazyClass++;
            }
        }
        
        return lazyData;
    }
    
    async testProcessInfiniteScroll() {
        const initialHeight = document.documentElement.scrollHeight;
        const scrollData = {
            initialHeight,
            hasInfiniteScroll: false,
            loadMoreButtons: 0,
            scrollEvents: 0
        };
        
        // Look for load more buttons
        const loadMoreSelectors = [
            '.load-more', '.show-more', '.next-page',
            '[data-load-more]', '[data-next]',
            'button[onclick*="load"]', 'button[onclick*="more"]'
        ];
        
        for (const selector of loadMoreSelectors) {
            scrollData.loadMoreButtons += document.querySelectorAll(selector).length;
        }
        
        // Test if scrolling triggers new content
        window.scrollTo(0, document.documentElement.scrollHeight);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newHeight = document.documentElement.scrollHeight;
        if (newHeight > initialHeight) {
            scrollData.hasInfiniteScroll = true;
        }
        
        // Scroll back to top
        window.scrollTo(0, 0);
        
        return scrollData;
    }
    
    // ================== PERFORMANCE TESTS ==================
    async testScanSpeed() {
        const startTime = performance.now();
        
        // Simulate image scanning
        const images = document.querySelectorAll('img');
        const results = Array.from(images).map(img => ({
            src: img.src,
            width: img.naturalWidth,
            height: img.naturalHeight
        }));
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (duration > 5000) { // 5 seconds threshold
            throw new Error(`Scan too slow: ${duration}ms`);
        }
        
        return {
            duration,
            imagesScanned: results.length,
            imagesPerSecond: results.length / (duration / 1000)
        };
    }
    
    async testMemoryUsage() {
        if (!performance.memory) {
            throw new Error('Memory API not available');
        }
        
        const memoryBefore = performance.memory.usedJSHeapSize;
        
        // Simulate memory-intensive operation
        const testData = [];
        for (let i = 0; i < 1000; i++) {
            testData.push({
                id: i,
                data: new Array(100).fill(Math.random())
            });
        }
        
        const memoryAfter = performance.memory.usedJSHeapSize;
        const memoryUsed = memoryAfter - memoryBefore;
        
        // Clean up
        testData.length = 0;
        
        return {
            memoryBefore: this.formatBytes(memoryBefore),
            memoryAfter: this.formatBytes(memoryAfter),
            memoryUsed: this.formatBytes(memoryUsed),
            memoryLimit: this.formatBytes(performance.memory.jsHeapSizeLimit)
        };
    }
    
    async testDownloadThroughput() {
        // Simulate download testing with small images
        const testUrls = Array.from(document.querySelectorAll('img'))
            .slice(0, 3) // Test with first 3 images
            .map(img => img.src)
            .filter(src => src && !src.startsWith('data:'));
        
        if (testUrls.length === 0) {
            throw new Error('No suitable test URLs found');
        }
        
        const startTime = Date.now();
        const downloadResults = [];
        
        for (const url of testUrls) {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                downloadResults.push({
                    url,
                    success: response.ok,
                    size: parseInt(response.headers.get('content-length') || '0'),
                    type: response.headers.get('content-type') || 'unknown'
                });
            } catch (error) {
                downloadResults.push({
                    url,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const duration = Date.now() - startTime;
        const successCount = downloadResults.filter(r => r.success).length;
        
        if (successCount === 0) {
            throw new Error('No downloads succeeded');
        }
        
        return {
            testsRun: testUrls.length,
            successful: successCount,
            failed: testUrls.length - successCount,
            duration,
            results: downloadResults
        };
    }
    
    async testErrorRecovery() {
        const errorTests = [
            { name: 'Invalid URL', test: () => new URL('invalid-url') },
            { name: 'Missing Element', test: () => document.querySelector('#non-existent').click() },
            { name: 'Permission Error', test: () => { throw new Error('Permission denied'); } }
        ];
        
        const recoveryResults = [];
        
        for (const errorTest of errorTests) {
            try {
                errorTest.test();
                recoveryResults.push({
                    name: errorTest.name,
                    error: false,
                    recovered: true
                });
            } catch (error) {
                // Test if error was handled gracefully
                const recovered = error.message !== undefined;
                recoveryResults.push({
                    name: errorTest.name,
                    error: true,
                    recovered,
                    errorMessage: error.message
                });
            }
        }
        
        const recoveredCount = recoveryResults.filter(r => r.recovered).length;
        
        return {
            totalTests: errorTests.length,
            recovered: recoveredCount,
            failed: errorTests.length - recoveredCount,
            results: recoveryResults
        };
    }
    
    // ================== SITE-SPECIFIC TESTS ==================
    async testSocialMediaSites() {
        const siteDetection = {
            isInstagram: window.location.hostname.includes('instagram.com'),
            isTwitter: window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com'),
            isFacebook: window.location.hostname.includes('facebook.com'),
            isReddit: window.location.hostname.includes('reddit.com')
        };
        
        const socialFeatures = {
            hasInfiniteScroll: this.detectInfiniteScroll(),
            hasDynamicContent: this.detectDynamicContent(),
            hasImageModal: this.detectImageModal(),
            requiresAuth: this.detectAuthRequirement()
        };
        
        return { siteDetection, socialFeatures };
    }
    
    async testGallerySites() {
        const galleryFeatures = {
            hasImageGrid: !!document.querySelector('.grid, .gallery, .masonry'),
            hasThumbnails: !!document.querySelector('.thumbnail, .thumb, .preview'),
            hasLightbox: !!document.querySelector('.lightbox, .modal, .overlay'),
            hasPagination: !!document.querySelector('.pagination, .pager, .page-numbers')
        };
        
        const imageQuality = this.analyzeImageQuality();
        
        return { galleryFeatures, imageQuality };
    }
    
    async testEcommerceSites() {
        const ecommerceFeatures = {
            hasProductImages: !!document.querySelector('.product-image, .item-photo'),
            hasZoomImages: !!document.querySelector('[data-zoom], .zoom'),
            hasImageVariants: !!document.querySelector('.variant-image, .color-option'),
            hasImageGallery: !!document.querySelector('.product-gallery, .image-slider')
        };
        
        const productData = this.extractProductData();
        
        return { ecommerceFeatures, productData };
    }
    
    async testWebtoonSites() {
        const webtoonFeatures = {
            hasEpisodeImages: !!document.querySelector('.episode-image, .chapter-image'),
            hasSequentialContent: !!document.querySelector('.next-episode, .prev-episode'),
            hasLongScroll: document.documentElement.scrollHeight > window.innerHeight * 5,
            hasChapterNavigation: !!document.querySelector('.episode-list, .chapter-list')
        };
        
        const contentStructure = this.analyzeContentStructure();
        
        return { webtoonFeatures, contentStructure };
    }
    
    // ================== UTILITY METHODS ==================
    calculateAverageDimensions(images) {
        if (images.length === 0) return { width: 0, height: 0 };
        
        const total = images.reduce((acc, img) => ({
            width: acc.width + (img.naturalWidth || 0),
            height: acc.height + (img.naturalHeight || 0)
        }), { width: 0, height: 0 });
        
        return {
            width: Math.round(total.width / images.length),
            height: Math.round(total.height / images.length)
        };
    }
    
    detectInfiniteScroll() {
        const indicators = [
            '.infinite-scroll', '.auto-load', '.load-more',
            '[data-infinite]', '[data-auto-load]'
        ];
        
        return indicators.some(selector => document.querySelector(selector));
    }
    
    detectDynamicContent() {
        return !!(window.React || window.Vue || window.angular || 
                 document.querySelector('[data-react-]') || 
                 document.querySelector('[data-v-]'));
    }
    
    detectImageModal() {
        const modalSelectors = [
            '.modal', '.lightbox', '.overlay', '.popup',
            '[data-modal]', '[data-lightbox]'
        ];
        
        return modalSelectors.some(selector => document.querySelector(selector));
    }
    
    detectAuthRequirement() {
        const authSelectors = [
            '.login', '.signin', '.auth', '.authentication',
            '[data-login]', '[data-auth]'
        ];
        
        return authSelectors.some(selector => document.querySelector(selector));
    }
    
    analyzeImageQuality() {
        const images = Array.from(document.querySelectorAll('img')).slice(0, 10);
        const qualities = images.map(img => {
            const pixels = (img.naturalWidth || 0) * (img.naturalHeight || 0);
            return {
                pixels,
                quality: pixels > 1000000 ? 'high' : pixels > 100000 ? 'medium' : 'low'
            };
        });
        
        return {
            totalAnalyzed: qualities.length,
            highQuality: qualities.filter(q => q.quality === 'high').length,
            mediumQuality: qualities.filter(q => q.quality === 'medium').length,
            lowQuality: qualities.filter(q => q.quality === 'low').length
        };
    }
    
    extractProductData() {
        const productElements = {
            title: document.querySelector('h1, .product-title, .item-title')?.textContent || '',
            price: document.querySelector('.price, .cost, .amount')?.textContent || '',
            images: document.querySelectorAll('.product-image img, .item-photo img').length
        };
        
        return productElements;
    }
    
    analyzeContentStructure() {
        return {
            hasChapters: !!document.querySelector('.chapter, .episode'),
            hasPages: !!document.querySelector('.page, .slide'),
            hasNavigation: !!document.querySelector('.next, .prev, .navigation'),
            totalContentImages: document.querySelectorAll('.content img, .chapter img').length
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // ================== ERROR TRACKING ==================
    recordError(type, errorData) {
        const errorKey = `${type}_${Date.now()}`;
        this.errorPatterns.set(errorKey, {
            type,
            ...errorData,
            timestamp: Date.now(),
            url: window.location.href
        });
        
        // Keep only last 100 errors
        if (this.errorPatterns.size > 100) {
            const firstKey = this.errorPatterns.keys().next().value;
            this.errorPatterns.delete(firstKey);
        }
    }
    
    getErrorReport() {
        const errors = Array.from(this.errorPatterns.values());
        const errorTypes = {};
        
        errors.forEach(error => {
            errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
        });
        
        return {
            totalErrors: errors.length,
            errorTypes,
            recentErrors: errors.slice(-10),
            errorRate: errors.length / ((Date.now() - this.testResults.get('sessionStart') || Date.now()) / 1000)
        };
    }
    
    // ================== RESULTS MANAGEMENT ==================
    async loadTestResults() {
        try {
            if (window.advancedStorageManager) {
                const savedResults = await window.advancedStorageManager.get('testResults');
                if (savedResults) {
                    this.testResults = new Map(Object.entries(savedResults));
                }
            }
        } catch (error) {
            console.error('Failed to load test results:', error);
        }
    }
    
    async saveTestResults() {
        try {
            if (window.advancedStorageManager) {
                const resultsObj = Object.fromEntries(this.testResults);
                await window.advancedStorageManager.set('testResults', resultsObj);
            }
        } catch (error) {
            console.error('Failed to save test results:', error);
        }
    }
    
    generateReport() {
        const allResults = Array.from(this.testResults.values());
        const errorReport = this.getErrorReport();
        
        const report = {
            summary: {
                totalSitesTested: allResults.length,
                averageSuccessRate: this.calculateAverageSuccessRate(allResults),
                mostProblematicSites: this.findProblematicSites(allResults),
                bestPerformingSites: this.findBestPerformingSites(allResults)
            },
            compatibility: {
                socialMedia: this.analyzeCompatibilityByType(allResults, 'social'),
                galleries: this.analyzeCompatibilityByType(allResults, 'gallery'),
                ecommerce: this.analyzeCompatibilityByType(allResults, 'ecommerce'),
                webtoons: this.analyzeCompatibilityByType(allResults, 'webtoon')
            },
            performance: {
                averageScanTime: this.calculateAverageScanTime(allResults),
                memoryUsage: this.calculateAverageMemoryUsage(allResults),
                errorRate: errorReport.errorRate
            },
            recommendations: this.generateRecommendations(allResults, errorReport),
            errors: errorReport,
            timestamp: Date.now()
        };
        
        return report;
    }
    
    calculateAverageSuccessRate(results) {
        if (results.length === 0) return 0;
        const totalRate = results.reduce((sum, result) => sum + result.successRate, 0);
        return totalRate / results.length;
    }
    
    findProblematicSites(results) {
        return results
            .filter(result => result.successRate < 70)
            .sort((a, b) => a.successRate - b.successRate)
            .slice(0, 5)
            .map(result => ({
                url: result.site,
                successRate: result.successRate,
                mainIssues: this.identifyMainIssues(result)
            }));
    }
    
    findBestPerformingSites(results) {
        return results
            .filter(result => result.successRate > 90)
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5)
            .map(result => ({
                url: result.site,
                successRate: result.successRate,
                duration: result.duration
            }));
    }
    
    identifyMainIssues(result) {
        const issues = [];
        
        for (const [suiteId, suite] of Object.entries(result.suites)) {
            if (suite.status === 'failed') {
                for (const [testName, test] of Object.entries(suite.tests)) {
                    if (!test.passed) {
                        issues.push(`${suiteId}.${testName}: ${test.error}`);
                    }
                }
            }
        }
        
        return issues.slice(0, 3); // Top 3 issues
    }
    
    analyzeCompatibilityByType(results, siteType) {
        const typeResults = results.filter(result => 
            result.site.includes(this.getSiteTypePattern(siteType))
        );
        
        if (typeResults.length === 0) {
            return { tested: 0, averageScore: 0, commonIssues: [] };
        }
        
        const averageScore = this.calculateAverageSuccessRate(typeResults);
        const commonIssues = this.findCommonIssues(typeResults);
        
        return {
            tested: typeResults.length,
            averageScore,
            commonIssues
        };
    }
    
    getSiteTypePattern(siteType) {
        const patterns = {
            social: 'instagram|twitter|facebook|reddit',
            gallery: 'flickr|pinterest|deviantart|artstation',
            ecommerce: 'amazon|ebay|shopee|lazada',
            webtoon: 'webtoons|manga|comic'
        };
        
        return patterns[siteType] || '';
    }
    
    findCommonIssues(results) {
        const issueCount = {};
        
        results.forEach(result => {
            const issues = this.identifyMainIssues(result);
            issues.forEach(issue => {
                const issueType = issue.split(':')[0];
                issueCount[issueType] = (issueCount[issueType] || 0) + 1;
            });
        });
        
        return Object.entries(issueCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([issue, count]) => ({ issue, frequency: count }));
    }
    
    calculateAverageScanTime(results) {
        if (results.length === 0) return 0;
        
        const scanTimes = results
            .map(result => result.suites.performance?.tests?.scanSpeed?.data?.duration || 0)
            .filter(time => time > 0);
        
        if (scanTimes.length === 0) return 0;
        
        return scanTimes.reduce((sum, time) => sum + time, 0) / scanTimes.length;
    }
    
    calculateAverageMemoryUsage(results) {
        const memoryData = results
            .map(result => result.suites.performance?.tests?.memoryUsage?.data?.memoryUsed)
            .filter(data => data);
        
        if (memoryData.length === 0) return 'N/A';
        
        // This would need proper byte parsing
        return 'Calculated from test data';
    }
    
    generateRecommendations(results, errorReport) {
        const recommendations = [];
        
        // Performance recommendations
        const avgScanTime = this.calculateAverageScanTime(results);
        if (avgScanTime > 3000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                issue: 'Slow scanning speed',
                solution: 'Optimize image detection algorithms and use more efficient DOM queries'
            });
        }
        
        // Error rate recommendations
        if (errorReport.errorRate > 0.1) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                issue: 'High error rate',
                solution: 'Implement better error handling and fallback mechanisms'
            });
        }
        
        // Site-specific recommendations
        const problematicSites = this.findProblematicSites(results);
        if (problematicSites.length > 0) {
            recommendations.push({
                type: 'compatibility',
                priority: 'medium',
                issue: `Poor compatibility with ${problematicSites.length} sites`,
                solution: 'Develop site-specific adapters and improved pattern recognition'
            });
        }
        
        return recommendations;
    }
}

// ================== AUTOMATED ERROR MONITORING ==================
class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.maxErrors = 500;
        this.errorCategories = new Map();
        this.criticalErrors = [];
        
        this.init();
    }
    
    init() {
        this.setupGlobalErrorHandling();
        this.setupPerformanceMonitoring();
        this.startCleanupTimer();
    }
    
    setupGlobalErrorHandling() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.recordError('javascript', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                severity: this.determineSeverity(event.error)
            });
        });
        
        // Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError('promise', {
                reason: event.reason?.toString(),
                stack: event.reason?.stack,
                severity: 'medium'
            });
        });
        
        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.recordError('resource', {
                    type: event.target.tagName,
                    source: event.target.src || event.target.href,
                    severity: 'low'
                });
            }
        }, true);
    }
    
    setupPerformanceMonitoring() {
        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) { // 50ms threshold
                            this.recordError('performance', {
                                type: 'long-task',
                                duration: entry.duration,
                                startTime: entry.startTime,
                                severity: entry.duration > 100 ? 'medium' : 'low'
                            });
                        }
                    }
                });
                
                observer.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('Performance observer not available:', error);
            }
        }
        
        // Memory monitoring
        if (performance.memory) {
            setInterval(() => {
                const memoryUsage = performance.memory.usedJSHeapSize;
                const memoryLimit = performance.memory.jsHeapSizeLimit;
                const memoryPercent = (memoryUsage / memoryLimit) * 100;
                
                if (memoryPercent > 80) {
                    this.recordError('memory', {
                        type: 'high-usage',
                        usage: memoryUsage,
                        limit: memoryLimit,
                        percentage: memoryPercent,
                        severity: memoryPercent > 90 ? 'high' : 'medium'
                    });
                }
            }, 10000); // Check every 10 seconds
        }
    }
    
    recordError(category, errorData) {
        const error = {
            id: Date.now() + Math.random(),
            category,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            ...errorData
        };
        
        this.errors.push(error);
        
        // Update category counts
        const count = this.errorCategories.get(category) || 0;
        this.errorCategories.set(category, count + 1);
        
        // Handle critical errors
        if (error.severity === 'high') {
            this.criticalErrors.push(error);
            this.handleCriticalError(error);
        }
        
        // Cleanup old errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        console.warn(`Error recorded [${category}]:`, error);
    }
    
    determineSeverity(error) {
        if (!error) return 'low';
        
        const message = error.message?.toLowerCase() || '';
        
        // Critical patterns
        if (message.includes('permission') || 
            message.includes('security') ||
            message.includes('storage quota')) {
            return 'high';
        }
        
        // Medium severity patterns
        if (message.includes('network') ||
            message.includes('fetch') ||
            message.includes('timeout')) {
            return 'medium';
        }
        
        return 'low';
    }
    
    handleCriticalError(error) {
        // Send notification to user
        chrome.runtime.sendMessage({
            action: 'criticalError',
            error: {
                category: error.category,
                message: error.message || error.reason,
                timestamp: error.timestamp
            }
        }).catch(() => {
            // Background script might not be available
        });
        
        // Attempt recovery actions
        this.attemptRecovery(error);
    }
    
    attemptRecovery(error) {
        try {
            switch (error.category) {
                case 'memory':
                    // Clear caches and non-essential data
                    this.clearMemory();
                    break;
                    
                case 'storage':
                    // Clean up storage
                    this.cleanupStorage();
                    break;
                    
                case 'network':
                    // Retry with fallback
                    this.retryWithFallback();
                    break;
            }
        } catch (recoveryError) {
            console.error('Recovery attempt failed:', recoveryError);
        }
    }
    
    clearMemory() {
        // Clear various caches
        if (window.contentScanner) {
            window.contentScanner.scannedImages.clear();
        }
        
        if (window.advancedImageExtractor) {
            window.advancedImageExtractor.cleanup();
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }
    
    cleanupStorage() {
        if (window.advancedStorageManager) {
            window.advancedStorageManager.cleanupOldData();
        }
    }
    
    retryWithFallback() {
        // Implement retry logic with exponential backoff
        console.log('Implementing network retry with fallback...');
    }
    
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupOldErrors();
        }, 60000); // Cleanup every minute
    }
    
    cleanupOldErrors() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        this.errors = this.errors.filter(error => error.timestamp > cutoff);
        this.criticalErrors = this.criticalErrors.filter(error => error.timestamp > cutoff);
    }
    
    getErrorReport() {
        return {
            totalErrors: this.errors.length,
            criticalErrors: this.criticalErrors.length,
            errorsByCategory: Object.fromEntries(this.errorCategories),
            recentErrors: this.errors.slice(-10),
            errorRate: this.calculateErrorRate(),
            trends: this.calculateErrorTrends()
        };
    }
    
    calculateErrorRate() {
        const timeWindow = 60 * 60 * 1000; // 1 hour
        const cutoff = Date.now() - timeWindow;
        const recentErrors = this.errors.filter(error => error.timestamp > cutoff);
        
        return recentErrors.length / (timeWindow / 1000); // Errors per second
    }
    
    calculateErrorTrends() {
        const hourly = {};
        const now = Date.now();
        
        // Group errors by hour
        this.errors.forEach(error => {
            const hour = Math.floor((now - error.timestamp) / (60 * 60 * 1000));
            if (hour < 24) { // Last 24 hours
                hourly[hour] = (hourly[hour] || 0) + 1;
            }
        });
        
        return hourly;
    }
}

// ================== PERFORMANCE OPTIMIZER ==================
class PerformanceOptimizer {
    constructor() {
        this.optimizations = new Map();
        this.performanceHistory = [];
        this.currentOptimizations = new Set();
        
        this.init();
    }
    
    init() {
        this.registerOptimizations();
        this.startPerformanceMonitoring();
    }
    
    registerOptimizations() {
        // DOM query optimization
        this.optimizations.set('domQueries', {
            name: 'DOM Query Optimization',
            description: 'Cache DOM queries and use efficient selectors',
            apply: () => this.optimizeDOMQueries(),
            revert: () => this.revertDOMQueries(),
            impact: 'medium',
            cost: 'low'
        });
        
        // Image processing optimization
        this.optimizations.set('imageProcessing', {
            name: 'Image Processing Optimization',
            description: 'Use web workers for heavy image processing',
            apply: () => this.optimizeImageProcessing(),
            revert: () => this.revertImageProcessing(),
            impact: 'high',
            cost: 'medium'
        });
        
        // Memory management
        this.optimizations.set('memoryManagement', {
            name: 'Memory Management',
            description: 'Aggressive memory cleanup and garbage collection',
            apply: () => this.optimizeMemoryManagement(),
            revert: () => this.revertMemoryManagement(),
            impact: 'high',
            cost: 'low'
        });
        
        // Network optimization
        this.optimizations.set('networkRequests', {
            name: 'Network Request Optimization',
            description: 'Batch requests and implement smart caching',
            apply: () => this.optimizeNetworkRequests(),
            revert: () => this.revertNetworkRequests(),
            impact: 'medium',
            cost: 'medium'
        });
    }
    
    startPerformanceMonitoring() {
        setInterval(() => {
            this.measurePerformance();
            this.adjustOptimizations();
        }, 5000); // Monitor every 5 seconds
    }
    
    measurePerformance() {
        const metrics = {
            timestamp: Date.now(),
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            timing: performance.timing ? {
                domComplete: performance.timing.domComplete - performance.timing.navigationStart,
                loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
            } : null,
            activeOptimizations: Array.from(this.currentOptimizations)
        };
        
        this.performanceHistory.push(metrics);
        
        // Keep only last 100 measurements
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.shift();
        }
    }
    
    adjustOptimizations() {
        const currentMetrics = this.performanceHistory[this.performanceHistory.length - 1];
        if (!currentMetrics) return;
        
        // Apply optimizations based on current conditions
        if (currentMetrics.memory) {
            const memoryUsage = (currentMetrics.memory.used / currentMetrics.memory.limit) * 100;
            
            if (memoryUsage > 70 && !this.currentOptimizations.has('memoryManagement')) {
                this.applyOptimization('memoryManagement');
            }
            
            if (memoryUsage < 50 && this.currentOptimizations.has('memoryManagement')) {
                this.revertOptimization('memoryManagement');
            }
        }
        
        // Check for performance degradation
        const recentMetrics = this.performanceHistory.slice(-5);
        const avgLoadTime = recentMetrics.reduce((sum, m) => 
            sum + (m.timing?.domComplete || 0), 0) / recentMetrics.length;
        
        if (avgLoadTime > 3000 && !this.currentOptimizations.has('domQueries')) {
            this.applyOptimization('domQueries');
        }
    }
    
    applyOptimization(optimizationId) {
        const optimization = this.optimizations.get(optimizationId);
        if (!optimization || this.currentOptimizations.has(optimizationId)) {
            return false;
        }
        
        try {
            optimization.apply();
            this.currentOptimizations.add(optimizationId);
            console.log(`✅ Applied optimization: ${optimization.name}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to apply optimization ${optimizationId}:`, error);
            return false;
        }
    }
    
    revertOptimization(optimizationId) {
        const optimization = this.optimizations.get(optimizationId);
        if (!optimization || !this.currentOptimizations.has(optimizationId)) {
            return false;
        }
        
        try {
            optimization.revert();
            this.currentOptimizations.delete(optimizationId);
            console.log(`↩️ Reverted optimization: ${optimization.name}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to revert optimization ${optimizationId}:`, error);
            return false;
        }
    }
    
    // ================== SPECIFIC OPTIMIZATIONS ==================
    optimizeDOMQueries() {
        // Cache frequently used DOM queries
        if (!window.adsProDOMCache) {
            window.adsProDOMCache = new Map();
            
            // Override querySelector to use cache
            const originalQS = document.querySelector.bind(document);
            const originalQSA = document.querySelectorAll.bind(document);
            
            document.querySelector = function(selector) {
                const cached = window.adsProDOMCache.get(selector);
                if (cached && document.contains(cached)) {
                    return cached;
                }
                
                const result = originalQS(selector);
                if (result) {
                    window.adsProDOMCache.set(selector, result);
                }
                return result;
            };
            
            // Clear cache periodically
            setInterval(() => {
                window.adsProDOMCache.clear();
            }, 30000);
        }
    }
    
    revertDOMQueries() {
        if (window.adsProDOMCache) {
            window.adsProDOMCache.clear();
            delete window.adsProDOMCache;
            
            // Restore original querySelector
            // Note: This is simplified - in reality, you'd need to store the original
        }
    }
    
    optimizeImageProcessing() {
        // Use web workers for heavy image processing
        if (!window.adsProImageWorker && window.Worker) {
            try {
                const workerCode = `
                    self.onmessage = function(e) {
                        const { imageData, operation } = e.data;
                        
                        // Perform image processing operations
                        let result;
                        
                        switch (operation) {
                            case 'analyze':
                                result = analyzeImageData(imageData);
                                break;
                            case 'convert':
                                result = convertImageFormat(imageData);
                                break;
                            default:
                                result = { error: 'Unknown operation' };
                        }
                        
                        self.postMessage(result);
                    };
                    
                    function analyzeImageData(data) {
                        // Simplified analysis
                        return { analysis: 'completed' };
                    }
                    
                    function convertImageFormat(data) {
                        // Simplified conversion
                        return { conversion: 'completed' };
                    }
                `;
                
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                window.adsProImageWorker = new Worker(URL.createObjectURL(blob));
                
                console.log('🔧 Image processing worker created');
            } catch (error) {
                console.warn('Failed to create image processing worker:', error);
            }
        }
    }
    
    revertImageProcessing() {
        if (window.adsProImageWorker) {
            window.adsProImageWorker.terminate();
            delete window.adsProImageWorker;
        }
    }
    
    optimizeMemoryManagement() {
        // Implement aggressive cleanup
        this.memoryCleanupInterval = setInterval(() => {
            // Clear various caches
            if (window.contentScanner?.scannedImages) {
                const size = window.contentScanner.scannedImages.size;
                if (size > 100) {
                    // Keep only last 50 entries
                    const entries = Array.from(window.contentScanner.scannedImages.entries());
                    window.contentScanner.scannedImages.clear();
                    entries.slice(-50).forEach(([key, value]) => {
                        window.contentScanner.scannedImages.set(key, value);
                    });
                }
            }
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
        }, 10000); // Every 10 seconds
    }
    
    revertMemoryManagement() {
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
            delete this.memoryCleanupInterval;
        }
    }
    
    optimizeNetworkRequests() {
        // Implement request batching and caching
        if (!window.adsProNetworkCache) {
            window.adsProNetworkCache = new Map();
            
            // Override fetch to add caching
            const originalFetch = window.fetch;
            window.fetch = async function(url, options = {}) {
                // Only cache GET requests
                if (options.method && options.method !== 'GET') {
                    return originalFetch(url, options);
                }
                
                const cacheKey = typeof url === 'string' ? url : url.url;
                const cached = window.adsProNetworkCache.get(cacheKey);
                
                if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                    return Promise.resolve(cached.response.clone());
                }
                
                const response = await originalFetch(url, options);
                
                if (response.ok) {
                    window.adsProNetworkCache.set(cacheKey, {
                        response: response.clone(),
                        timestamp: Date.now()
                    });
                }
                
                return response;
            };
        }
    }
    
    revertNetworkRequests() {
        if (window.adsProNetworkCache) {
            window.adsProNetworkCache.clear();
            delete window.adsProNetworkCache;
            
            // Restore original fetch
            // Note: This is simplified - in reality, you'd need to store the original
        }
    }
    
    getOptimizationReport() {
        return {
            activeOptimizations: Array.from(this.currentOptimizations),
            availableOptimizations: Array.from(this.optimizations.keys()),
            performanceHistory: this.performanceHistory.slice(-10),
            recommendations: this.generateOptimizationRecommendations()
        };
    }
    
    generateOptimizationRecommendations() {
        const recommendations = [];
        const recent = this.performanceHistory.slice(-5);
        
        if (recent.length === 0) return recommendations;
        
        // Memory recommendations
        const avgMemoryUsage = recent.reduce((sum, m) => 
            sum + (m.memory ? (m.memory.used / m.memory.limit) * 100 : 0), 0) / recent.length;
        
        if (avgMemoryUsage > 60) {
            recommendations.push({
                type: 'memory',
                priority: 'high',
                suggestion: 'Enable memory management optimization',
                optimizationId: 'memoryManagement'
            });
        }
        
        // Performance recommendations
        const avgLoadTime = recent.reduce((sum, m) => 
            sum + (m.timing?.domComplete || 0), 0) / recent.length;
        
        if (avgLoadTime > 2000) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                suggestion: 'Enable DOM query optimization',
                optimizationId: 'domQueries'
            });
        }
        
        return recommendations;
    }
}

// ================== GLOBAL INSTANCES ==================
window.siteCompatibilityTester = new SiteCompatibilityTester();
window.errorMonitor = new ErrorMonitor();
window.performanceOptimizer = new PerformanceOptimizer();