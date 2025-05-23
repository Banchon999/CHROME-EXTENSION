/**
 * Advanced Image Downloader Pro - Automated Testing Suite
 * ระบบทดสอบอัตโนมัติสำหรับเว็บไซต์ยอดนิยม
 */

class AutomatedTestingSuite {
    constructor() {
        this.testSites = new Map();
        this.testResults = new Map();
        this.currentTest = null;
        this.testQueue = [];
        this.isRunning = false;
        
        this.settings = {
            timeout: 30000,
            retryAttempts: 3,
            parallelTests: 2,
            screenshotOnFailure: true,
            collectMetrics: true,
            skipSiteErrors: true
        };
        
        this.metrics = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            avgExecutionTime: 0,
            startTime: null,
            endTime: null
        };
        
        this.initializeTestSites();
    }
    
    // ================== TEST SITE DEFINITIONS ==================
    initializeTestSites() {
        // Social Media Sites
        this.addTestSite('instagram', {
            name: 'Instagram',
            url: 'https://www.instagram.com/p/SAMPLE_POST/',
            type: 'social',
            expectedImages: 1,
            features: ['lazy-loading', 'infinite-scroll', 'dynamic-content'],
            selectors: {
                images: 'article img, ._aagu img',
                nextPost: 'a[aria-label="Next"]',
                userProfile: 'header a[role="link"]'
            },
            tests: [
                'basicImageDetection',
                'lazyLoadingHandling',
                'userProfileNavigation',
                'downloadQuality'
            ]
        });
        
        this.addTestSite('twitter', {
            name: 'Twitter/X',
            url: 'https://twitter.com/SAMPLE_USER/status/SAMPLE_ID',
            type: 'social',
            expectedImages: 1,
            features: ['dynamic-content', 'lazy-loading'],
            selectors: {
                images: '[data-testid="tweetPhoto"] img',
                tweet: '[data-testid="tweet"]',
                userProfile: '[data-testid="UserAvatar-Container-SAMPLE_USER"]'
            },
            tests: [
                'basicImageDetection',
                'threadNavigation',
                'mediaExpansion',
                'downloadQuality'
            ]
        });
        
        // Gallery Sites
        this.addTestSite('pinterest', {
            name: 'Pinterest',
            url: 'https://www.pinterest.com/pin/SAMPLE_PIN/',
            type: 'gallery',
            expectedImages: 5,
            features: ['infinite-scroll', 'grid-layout', 'lazy-loading'],
            selectors: {
                images: '[data-test-id="pin-image"], .gridCentered img',
                pinBoard: '[data-test-id="board-pin"]',
                nextPin: '[data-test-id="next-pin"]'
            },
            tests: [
                'basicImageDetection',
                'gridScrolling',
                'pinBoardNavigation',
                'highResolutionImages'
            ]
        });
        
        this.addTestSite('flickr', {
            name: 'Flickr',
            url: 'https://www.flickr.com/photos/SAMPLE_USER/SAMPLE_ID/',
            type: 'gallery',
            expectedImages: 1,
            features: ['multiple-sizes', 'metadata'],
            selectors: {
                images: '.photo-img img, .main-photo img',
                sizesMenu: '.sizes-menu',
                metaData: '.photo-metadata'
            },
            tests: [
                'basicImageDetection',
                'multipleSizeDetection',
                'metadataExtraction',
                'albumNavigation'
            ]
        });
        
        // E-commerce Sites
        this.addTestSite('amazon', {
            name: 'Amazon',
            url: 'https://www.amazon.com/dp/SAMPLE_PRODUCT/',
            type: 'ecommerce',
            expectedImages: 6,
            features: ['zoom-images', 'variant-images', 'gallery'],
            selectors: {
                images: '#landingImage, .a-dynamic-image',
                thumbnails: '#altImages img',
                zoomTrigger: '.imgTagWrapper',
                variants: '[data-defaultasin] img'
            },
            tests: [
                'basicImageDetection',
                'productGallery',
                'zoomImageExtraction',
                'variantImages'
            ]
        });
        
        // Webtoon/Manga Sites
        this.addTestSite('webtoons', {
            name: 'Webtoons',
            url: 'https://www.webtoons.com/en/SAMPLE_SERIES/episode-1/viewer?title_no=SAMPLE&episode_no=1',
            type: 'webtoon',
            expectedImages: 20,
            features: ['vertical-scroll', 'episode-navigation', 'lazy-loading'],
            selectors: {
                images: '.viewer_img img, ._images img',
                nextEpisode: '.pg_next',
                episodeList: '.episode_lst li'
            },
            tests: [
                'basicImageDetection',
                'verticalScrolling',
                'episodeNavigation',
                'batchDownload'
            ]
        });
        
        // News/Blog Sites
        this.addTestSite('medium', {
            name: 'Medium',
            url: 'https://medium.com/SAMPLE_PUBLICATION/SAMPLE_ARTICLE',
            type: 'news',
            expectedImages: 3,
            features: ['article-images', 'responsive-images'],
            selectors: {
                images: 'article img, .graf-image',
                articleContent: 'article',
                relatedArticles: '.related-articles a'
            },
            tests: [
                'basicImageDetection',
                'responsiveImages',
                'articleNavigation',
                'relatedContent'
            ]
        });
    }
    
    addTestSite(id, config) {
        this.testSites.set(id, {
            id,
            ...config,
            status: 'pending',
            lastTested: null,
            results: {},
            metrics: {}
        });
    }
    
    // ================== TEST EXECUTION ==================
    async runAllTests() {
        if (this.isRunning) {
            throw new Error('Tests are already running');
        }
        
        this.isRunning = true;
        this.metrics.startTime = Date.now();
        this.metrics.totalTests = this.testSites.size;
        
        console.log('🧪 Starting automated testing suite...');
        
        try {
            // Reset metrics
            this.metrics.passedTests = 0;
            this.metrics.failedTests = 0;
            this.metrics.skippedTests = 0;
            
            // Create test queue
            this.testQueue = Array.from(this.testSites.keys());
            
            // Run tests in parallel batches
            await this.runTestBatches();
            
            // Calculate final metrics
            this.calculateFinalMetrics();
            
            // Generate comprehensive report
            const report = this.generateTestReport();
            
            console.log('✅ Automated testing completed');
            return report;
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error);
            throw error;
        } finally {
            this.isRunning = false;
            this.metrics.endTime = Date.now();
        }
    }
    
    async runTestBatches() {
        const batchSize = this.settings.parallelTests;
        
        while (this.testQueue.length > 0) {
            const batch = this.testQueue.splice(0, batchSize);
            const batchPromises = batch.map(siteId => this.runSiteTests(siteId));
            
            await Promise.allSettled(batchPromises);
            
            // Small delay between batches
            await this.delay(1000);
        }
    }
    
    async runSiteTests(siteId) {
        const site = this.testSites.get(siteId);
        if (!site) {
            throw new Error(`Site ${siteId} not found`);
        }
        
        console.log(`🔍 Testing ${site.name}...`);
        
        const testStartTime = Date.now();
        
        try {
            site.status = 'running';
            
            // Navigate to test URL (simulated)
            await this.navigateToSite(site);
            
            // Run individual tests
            const testResults = {};
            
            for (const testName of site.tests) {
                try {
                    const testResult = await this.runIndividualTest(site, testName);
                    testResults[testName] = testResult;
                } catch (testError) {
                    testResults[testName] = {
                        passed: false,
                        error: testError.message,
                        duration: 0
                    };
                    
                    if (!this.settings.skipSiteErrors) {
                        throw testError;
                    }
                }
            }
            
            // Calculate site results
            const passedTests = Object.values(testResults).filter(r => r.passed).length;
            const totalTests = Object.keys(testResults).length;
            
            site.results = {
                passed: passedTests,
                failed: totalTests - passedTests,
                total: totalTests,
                tests: testResults,
                duration: Date.now() - testStartTime,
                success: passedTests === totalTests
            };
            
            site.status = site.results.success ? 'passed' : 'failed';
            site.lastTested = Date.now();
            
            if (site.results.success) {
                this.metrics.passedTests++;
            } else {
                this.metrics.failedTests++;
            }
            
            console.log(`${site.results.success ? '✅' : '❌'} ${site.name}: ${passedTests}/${totalTests} tests passed`);
            
        } catch (error) {
            site.status = 'error';
            site.results = {
                error: error.message,
                duration: Date.now() - testStartTime,
                success: false
            };
            
            this.metrics.failedTests++;
            console.error(`❌ ${site.name} testing failed:`, error);
            
            if (this.settings.screenshotOnFailure) {
                await this.captureErrorScreenshot(site, error);
            }
        }
    }
    
    async runIndividualTest(site, testName) {
        const testStartTime = Date.now();
        
        try {
            let result;
            
            switch (testName) {
                case 'basicImageDetection':
                    result = await this.testBasicImageDetection(site);
                    break;
                case 'lazyLoadingHandling':
                    result = await this.testLazyLoadingHandling(site);
                    break;
                case 'infiniteScrolling':
                    result = await this.testInfiniteScrolling(site);
                    break;
                case 'downloadQuality':
                    result = await this.testDownloadQuality(site);
                    break;
                case 'gridScrolling':
                    result = await this.testGridScrolling(site);
                    break;
                case 'productGallery':
                    result = await this.testProductGallery(site);
                    break;
                case 'episodeNavigation':
                    result = await this.testEpisodeNavigation(site);
                    break;
                case 'responsiveImages':
                    result = await this.testResponsiveImages(site);
                    break;
                default:
                    throw new Error(`Unknown test: ${testName}`);
            }
            
            return {
                passed: true,
                duration: Date.now() - testStartTime,
                data: result
            };
            
        } catch (error) {
            return {
                passed: false,
                error: error.message,
                duration: Date.now() - testStartTime
            };
        }
    }
    
    // ================== INDIVIDUAL TESTS ==================
    async testBasicImageDetection(site) {
        // Simulate image detection using selectors
        const imageSelector = site.selectors.images;
        
        // In a real implementation, this would interact with the page
        const mockDetectedImages = this.simulateImageDetection(site, imageSelector);
        
        if (mockDetectedImages.length === 0) {
            throw new Error('No images detected');
        }
        
        if (mockDetectedImages.length < site.expectedImages) {
            console.warn(`Expected ${site.expectedImages} images, found ${mockDetectedImages.length}`);
        }
        
        return {
            imagesFound: mockDetectedImages.length,
            expected: site.expectedImages,
            images: mockDetectedImages.slice(0, 5) // Return first 5 for reporting
        };
    }
    
    async testLazyLoadingHandling(site) {
        if (!site.features.includes('lazy-loading')) {
            return { skipped: true, reason: 'Site does not use lazy loading' };
        }
        
        // Simulate lazy loading test
        const initialImages = this.simulateImageDetection(site, site.selectors.images);
        
        // Simulate scrolling to trigger lazy loading
        await this.simulateScrolling();
        
        const finalImages = this.simulateImageDetection(site, site.selectors.images);
        
        if (finalImages.length <= initialImages.length) {
            throw new Error('Lazy loading does not appear to be working');
        }
        
        return {
            initialImages: initialImages.length,
            finalImages: finalImages.length,
            newImages: finalImages.length - initialImages.length
        };
    }
    
    async testInfiniteScrolling(site) {
        if (!site.features.includes('infinite-scroll')) {
            return { skipped: true, reason: 'Site does not use infinite scroll' };
        }
        
        const scrollTests = [];
        let currentImageCount = this.simulateImageDetection(site, site.selectors.images).length;
        
        // Simulate multiple scroll actions
        for (let i = 0; i < 3; i++) {
            await this.simulateScrolling();
            await this.delay(2000); // Wait for content to load
            
            const newImageCount = this.simulateImageDetection(site, site.selectors.images).length;
            
            scrollTests.push({
                scrollAction: i + 1,
                imagesBefore: currentImageCount,
                imagesAfter: newImageCount,
                newImages: newImageCount - currentImageCount
            });
            
            currentImageCount = newImageCount;
        }
        
        const totalNewImages = scrollTests.reduce((sum, test) => sum + test.newImages, 0);
        
        if (totalNewImages === 0) {
            throw new Error('Infinite scroll does not appear to be working');
        }
        
        return {
            scrollTests,
            totalNewImages,
            averageNewImagesPerScroll: totalNewImages / scrollTests.length
        };
    }
    
    async testDownloadQuality(site) {
        const images = this.simulateImageDetection(site, site.selectors.images);
        
        if (images.length === 0) {
            throw new Error('No images available for quality testing');
        }
        
        const qualityTests = images.slice(0, 3).map(img => {
            // Simulate quality analysis
            const dimensions = this.simulateImageDimensions(img);
            const quality = this.simulateQualityScore(dimensions);
            
            return {
                url: img.url,
                width: dimensions.width,
                height: dimensions.height,
                qualityScore: quality,
                isHighQuality: quality > 70
            };
        });
        
        const avgQuality = qualityTests.reduce((sum, test) => sum + test.qualityScore, 0) / qualityTests.length;
        
        if (avgQuality < 50) {
            throw new Error(`Poor image quality detected: ${avgQuality.toFixed(1)}/100`);
        }
        
        return {
            averageQuality: avgQuality,
            highQualityImages: qualityTests.filter(t => t.isHighQuality).length,
            totalTested: qualityTests.length,
            details: qualityTests
        };
    }
    
    async testGridScrolling(site) {
        if (!site.features.includes('grid-layout')) {
            return { skipped: true, reason: 'Site does not use grid layout' };
        }
        
        // Simulate grid scrolling for gallery sites
        const scrollPositions = [0, 25, 50, 75, 100]; // Percentage positions
        const gridTests = [];
        
        for (const position of scrollPositions) {
            await this.simulateScrollToPosition(position);
            
            const visibleImages = this.simulateVisibleImages(site);
            const totalImages = this.simulateImageDetection(site, site.selectors.images);
            
            gridTests.push({
                scrollPosition: position,
                visibleImages: visibleImages.length,
                totalImages: totalImages.length,
                loadedRatio: visibleImages.length / totalImages.length
            });
        }
        
        const avgLoadedRatio = gridTests.reduce((sum, test) => sum + test.loadedRatio, 0) / gridTests.length;
        
        return {
            gridTests,
            averageLoadedRatio: avgLoadedRatio,
            effectiveScrolling: avgLoadedRatio > 0.7
        };
    }
    
    async testProductGallery(site) {
        if (site.type !== 'ecommerce') {
            return { skipped: true, reason: 'Not an e-commerce site' };
        }
        
        // Test main product image
        const mainImages = this.simulateImageDetection(site, site.selectors.images);
        
        // Test thumbnail gallery
        const thumbnails = this.simulateImageDetection(site, site.selectors.thumbnails);
        
        // Test zoom functionality
        const zoomTest = await this.simulateZoomTest(site);
        
        // Test variant images
        const variantTest = await this.simulateVariantTest(site);
        
        return {
            mainImages: mainImages.length,
            thumbnails: thumbnails.length,
            zoomAvailable: zoomTest.available,
            variantImages: variantTest.count,
            totalProductImages: mainImages.length + thumbnails.length + variantTest.count
        };
    }
    
    async testEpisodeNavigation(site) {
        if (site.type !== 'webtoon') {
            return { skipped: true, reason: 'Not a webtoon site' };
        }
        
        // Test current episode images
        const currentEpisodeImages = this.simulateImageDetection(site, site.selectors.images);
        
        // Test navigation to next episode
        const navigationTest = await this.simulateEpisodeNavigation(site);
        
        // Test episode list access
        const episodeListTest = await this.simulateEpisodeListAccess(site);
        
        return {
            currentEpisodeImages: currentEpisodeImages.length,
            navigationAvailable: navigationTest.available,
            episodeListAccessible: episodeListTest.accessible,
            totalEpisodesFound: episodeListTest.count
        };
    }
    
    async testResponsiveImages(site) {
        // Simulate different viewport sizes
        const viewports = [
            { width: 1920, height: 1080, name: 'desktop' },
            { width: 768, height: 1024, name: 'tablet' },
            { width: 375, height: 667, name: 'mobile' }
        ];
        
        const responsiveTests = [];
        
        for (const viewport of viewports) {
            await this.simulateViewportChange(viewport);
            
            const images = this.simulateImageDetection(site, site.selectors.images);
            const responsiveImages = images.filter(img => this.hasResponsiveAttributes(img));
            
            responsiveTests.push({
                viewport: viewport.name,
                totalImages: images.length,
                responsiveImages: responsiveImages.length,
                responsiveRatio: responsiveImages.length / images.length
            });
        }
        
        const avgResponsiveRatio = responsiveTests.reduce((sum, test) => sum + test.responsiveRatio, 0) / responsiveTests.length;
        
        return {
            responsiveTests,
            averageResponsiveRatio: avgResponsiveRatio,
            isResponsive: avgResponsiveRatio > 0.5
        };
    }
    
    // ================== SIMULATION METHODS ==================
    simulateImageDetection(site, selector) {
        // Simulate finding images based on site type and expected count
        const baseCount = site.expectedImages || 5;
        const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const imageCount = Math.max(1, baseCount + variation);
        
        const images = [];
        for (let i = 0; i < imageCount; i++) {
            images.push({
                url: `https://example.com/${site.id}/image${i + 1}.jpg`,
                selector: selector,
                index: i,
                visible: Math.random() > 0.1 // 90% chance of being visible
            });
        }
        
        return images;
    }
    
    simulateImageDimensions(image) {
        // Simulate realistic image dimensions based on image index
        const baseDimensions = [
            { width: 1920, height: 1080 },
            { width: 1280, height: 720 },
            { width: 800, height: 600 },
            { width: 400, height: 300 }
        ];
        
        return baseDimensions[image.index % baseDimensions.length];
    }
    
    simulateQualityScore(dimensions) {
        const pixels = dimensions.width * dimensions.height;
        
        if (pixels > 2000000) return 85 + Math.random() * 15; // 85-100
        if (pixels > 500000) return 65 + Math.random() * 20;  // 65-85
        if (pixels > 100000) return 45 + Math.random() * 20;  // 45-65
        return 25 + Math.random() * 20; // 25-45
    }
    
    simulateVisibleImages(site) {
        const allImages = this.simulateImageDetection(site, site.selectors.images);
        return allImages.filter(img => img.visible);
    }
    
    async simulateScrolling() {
        // Simulate scrolling delay
        await this.delay(500);
        console.log('🔄 Simulating scroll action');
    }
    
    async simulateScrollToPosition(percentage) {
        await this.delay(300);
        console.log(`🔄 Simulating scroll to ${percentage}%`);
    }
    
    async simulateViewportChange(viewport) {
        await this.delay(200);
        console.log(`📱 Simulating viewport change to ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
    
    async simulateZoomTest(site) {
        if (!site.selectors.zoomTrigger) {
            return { available: false, reason: 'No zoom trigger selector defined' };
        }
        
        await this.delay(300);
        return {
            available: Math.random() > 0.3, // 70% chance zoom is available
            zoomLevels: ['1x', '2x', '4x'],
            highResolution: true
        };
    }
    
    async simulateVariantTest(site) {
        if (!site.selectors.variants) {
            return { count: 0, reason: 'No variant selector defined' };
        }
        
        await this.delay(400);
        return {
            count: Math.floor(Math.random() * 5) + 1, // 1-5 variants
            types: ['color', 'size', 'style']
        };
    }
    
    async simulateEpisodeNavigation(site) {
        if (!site.selectors.nextEpisode) {
            return { available: false, reason: 'No next episode selector defined' };
        }
        
        await this.delay(500);
        return {
            available: Math.random() > 0.2, // 80% chance navigation is available
            nextEpisodeFound: true,
            previousEpisodeFound: Math.random() > 0.5
        };
    }
    
    async simulateEpisodeListAccess(site) {
        if (!site.selectors.episodeList) {
            return { accessible: false, count: 0 };
        }
        
        await this.delay(600);
        return {
            accessible: Math.random() > 0.1, // 90% chance list is accessible
            count: Math.floor(Math.random() * 50) + 10 // 10-59 episodes
        };
    }
    
    hasResponsiveAttributes(image) {
        // Simulate checking for responsive attributes
        return Math.random() > 0.4; // 60% chance of being responsive
    }
    
    async navigateToSite(site) {
        console.log(`🌐 Navigating to ${site.name}: ${site.url}`);
        
        // Simulate navigation delay
        await this.delay(2000 + Math.random() * 3000);
        
        // Simulate potential navigation failures
        if (Math.random() < 0.05) { // 5% chance of failure
            throw new Error(`Failed to navigate to ${site.url}`);
        }
    }
    
    async captureErrorScreenshot(site, error) {
        console.log(`📸 Capturing error screenshot for ${site.name}`);
        
        // In a real implementation, this would capture actual screenshots
        const screenshot = {
            timestamp: Date.now(),
            site: site.name,
            error: error.message,
            url: site.url,
            filename: `error_${site.id}_${Date.now()}.png`
        };
        
        site.screenshot = screenshot;
        return screenshot;
    }
    
    // ================== METRICS AND REPORTING ==================
    calculateFinalMetrics() {
        const totalDuration = this.metrics.endTime - this.metrics.startTime;
        this.metrics.avgExecutionTime = totalDuration / this.metrics.totalTests;
        
        // Calculate additional metrics
        const siteResults = Array.from(this.testSites.values());
        
        this.metrics.successRate = (this.metrics.passedTests / this.metrics.totalTests) * 100;
        this.metrics.totalImagesTested = siteResults.reduce((sum, site) => {
            return sum + (site.results?.tests?.basicImageDetection?.data?.imagesFound || 0);
        }, 0);
        
        this.metrics.averageImagesPerSite = this.metrics.totalImagesTested / this.metrics.totalTests;
    }
    
    generateTestReport() {
        const siteResults = Array.from(this.testSites.values());
        
        const report = {
            summary: {
                totalSites: this.metrics.totalTests,
                passed: this.metrics.passedTests,
                failed: this.metrics.failedTests,
                skipped: this.metrics.skippedTests,
                successRate: this.metrics.successRate,
                totalDuration: this.metrics.endTime - this.metrics.startTime,
                averageExecutionTime: this.metrics.avgExecutionTime
            },
            
            siteResults: siteResults.map(site => ({
                id: site.id,
                name: site.name,
                type: site.type,
                status: site.status,
                url: site.url,
                results: site.results,
                lastTested: site.lastTested,
                screenshot: site.screenshot
            })),
            
            categoryAnalysis: this.analyzeSiteCategories(siteResults),
            
            featureAnalysis: this.analyzeFeatures(siteResults),
            
            recommendations: this.generateRecommendations(siteResults),
            
            metrics: this.metrics,
            
            timestamp: Date.now()
        };
        
        return report;
    }
    
    analyzeSiteCategories(siteResults) {
        const categories = {};
        
        siteResults.forEach(site => {
            if (!categories[site.type]) {
                categories[site.type] = {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    sites: []
                };
            }
            
            categories[site.type].total++;
            categories[site.type].sites.push({
                name: site.name,
                status: site.status,
                success: site.results?.success || false
            });
            
            if (site.results?.success) {
                categories[site.type].passed++;
            } else {
                categories[site.type].failed++;
            }
        });
        
        // Calculate success rates
        Object.values(categories).forEach(category => {
            category.successRate = (category.passed / category.total) * 100;
        });
        
        return categories;
    }
    
    analyzeFeatures(siteResults) {
        const features = {};
        
        siteResults.forEach(site => {
            site.features?.forEach(feature => {
                if (!features[feature]) {
                    features[feature] = {
                        total: 0,
                        working: 0,
                        broken: 0,
                        sites: []
                    };
                }
                
                features[feature].total++;
                features[feature].sites.push({
                    name: site.name,
                    status: site.status
                });
                
                // Determine if feature is working based on test results
                const featureWorking = this.isFeatureWorking(site, feature);
                if (featureWorking) {
                    features[feature].working++;
                } else {
                    features[feature].broken++;
                }
            });
        });
        
        return features;
    }
    
    isFeatureWorking(site, feature) {
        if (!site.results?.tests) return false;
        
        const featureTestMap = {
            'lazy-loading': 'lazyLoadingHandling',
            'infinite-scroll': 'infiniteScrolling',
            'grid-layout': 'gridScrolling',
            'zoom-images': 'productGallery',
            'episode-navigation': 'episodeNavigation',
            'responsive-images': 'responsiveImages'
        };
        
        const testName = featureTestMap[feature];
        if (!testName || !site.results.tests[testName]) return false;
        
        return site.results.tests[testName].passed;
    }
    
    generateRecommendations(siteResults) {
        const recommendations = [];
        
        // Overall success rate recommendations
        if (this.metrics.successRate < 80) {
            recommendations.push({
                type: 'critical',
                category: 'overall',
                issue: 'Low overall success rate',
                description: `Success rate is ${this.metrics.successRate.toFixed(1)}%, which is below the 80% target`,
                solution: 'Review failed tests and improve site compatibility patterns'
            });
        }
        
        // Category-specific recommendations
        const categoryAnalysis = this.analyzeSiteCategories(siteResults);
        
        Object.entries(categoryAnalysis).forEach(([category, data]) => {
            if (data.successRate < 70) {
                recommendations.push({
                    type: 'warning',
                    category: category,
                    issue: `Poor compatibility with ${category} sites`,
                    description: `Only ${data.successRate.toFixed(1)}% of ${category} sites are working correctly`,
                    solution: `Develop specialized handlers for ${category} site patterns`
                });
            }
        });
        
        // Feature-specific recommendations
        const featureAnalysis = this.analyzeFeatures(siteResults);
        
        Object.entries(featureAnalysis).forEach(([feature, data]) => {
            const workingRate = (data.working / data.total) * 100;
            if (workingRate < 60) {
                recommendations.push({
                    type: 'warning',
                    category: 'feature',
                    issue: `${feature} feature not working reliably`,
                    description: `${feature} is working on only ${workingRate.toFixed(1)}% of sites that have it`,
                    solution: `Improve ${feature} detection and handling algorithms`
                });
            }
        });
        
        // Performance recommendations
        if (this.metrics.avgExecutionTime > 30000) {
            recommendations.push({
                type: 'info',
                category: 'performance',
                issue: 'Slow test execution',
                description: `Average test time is ${(this.metrics.avgExecutionTime / 1000).toFixed(1)}s`,
                solution: 'Optimize test procedures and reduce timeouts'
            });
        }
        
        return recommendations;
    }
    
    // ================== UTILITY METHODS ==================
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }
    
    exportReport(report) {
        const blob = new Blob([JSON.stringify(report, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-report-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        console.log('📥 Test report exported');
    }
    
    // ================== PUBLIC API ==================
    async runSpecificSite(siteId) {
        if (!this.testSites.has(siteId)) {
            throw new Error(`Site ${siteId} not found`);
        }
        
        console.log(`🧪 Running tests for specific site: ${siteId}`);
        
        await this.runSiteTests(siteId);
        
        const site = this.testSites.get(siteId);
        return {
            site: site.name,
            results: site.results,
            status: site.status
        };
    }
    
    async runSpecificTest(siteId, testName) {
        const site = this.testSites.get(siteId);
        if (!site) {
            throw new Error(`Site ${siteId} not found`);
        }
        
        if (!site.tests.includes(testName)) {
            throw new Error(`Test ${testName} not available for site ${siteId}`);
        }
        
        console.log(`🧪 Running specific test: ${testName} on ${site.name}`);
        
        await this.navigateToSite(site);
        const result = await this.runIndividualTest(site, testName);
        
        return {
            site: site.name,
            test: testName,
            result: result
        };
    }
    
    getSiteList() {
        return Array.from(this.testSites.values()).map(site => ({
            id: site.id,
            name: site.name,
            type: site.type,
            status: site.status,
            lastTested: site.lastTested,
            features: site.features,
            tests: site.tests
        }));
    }
    
    getTestResults() {
        return Object.fromEntries(this.testResults);
    }
    
    // ================== CONFIGURATION ==================
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('⚙️ Test settings updated:', newSettings);
    }
    
    addCustomSite(id, config) {
        this.addTestSite(id, config);
        console.log(`➕ Custom site added: ${config.name}`);
    }
    
    removeSite(siteId) {
        if (this.testSites.delete(siteId)) {
            console.log(`➖ Site removed: ${siteId}`);
            return true;
        }
        return false;
    }
}

// ================== TEST RUNNER UTILITY ==================
class TestRunner {
    constructor() {
        this.testSuite = new AutomatedTestingSuite();
        this.isRunning = false;
    }
    
    async runFullSuite() {
        if (this.isRunning) {
            throw new Error('Tests are already running');
        }
        
        this.isRunning = true;
        
        try {
            const report = await this.testSuite.runAllTests();
            console.log('📊 Test Summary:', {
                sites: report.summary.totalSites,
                passed: report.summary.passed,
                failed: report.summary.failed,
                successRate: `${report.summary.successRate.toFixed(1)}%`,
                duration: this.testSuite.formatDuration(report.summary.totalDuration)
            });
            
            return report;
        } finally {
            this.isRunning = false;
        }
    }
    
    async runQuickTest() {
        // Run a subset of tests for quick validation
        const quickSites = ['instagram', 'pinterest', 'amazon'];
        const results = [];
        
        for (const siteId of quickSites) {
            try {
                const result = await this.testSuite.runSpecificSite(siteId);
                results.push(result);
            } catch (error) {
                results.push({
                    site: siteId,
                    error: error.message,
                    status: 'error'
                });
            }
        }
        
        return {
            type: 'quick-test',
            results: results,
            timestamp: Date.now()
        };
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            totalSites: this.testSuite.testSites.size,
            lastRun: this.testSuite.metrics.endTime,
            settings: this.testSuite.settings
        };
    }
}

// ================== GLOBAL INSTANCE ==================
window.automatedTestingSuite = new AutomatedTestingSuite();
window.testRunner = new TestRunner();

// ================== CONSOLE API ==================
window.runAutomatedTests = async () => {
    try {
        const report = await window.testRunner.runFullSuite();
        console.log('🎉 All tests completed!');
        return report;
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        throw error;
    }
};

window.runQuickTests = async () => {
    try {
        const results = await window.testRunner.runQuickTest();
        console.log('⚡ Quick tests completed!');
        return results;
    } catch (error) {
        console.error('❌ Quick test failed:', error);
        throw error;
    }
};

console.log('🧪 Automated Testing Suite loaded. Use runAutomatedTests() or runQuickTests() to start testing.');