/**
 * Advanced Image Downloader Pro - Content Scanner Engine
 * ระบบสแกนและค้นหาเนื้อหาอัตโนมัติสำหรับทุกประเภทเว็บไซต์
 */

class ContentScanner {
    constructor() {
        this.scannedImages = new Map();
        this.scannedPages = new Set();
        this.isScanning = false;
        this.abortController = null;
        this.settings = {};
        
        // Observers for dynamic content
        this.intersectionObserver = null;
        this.mutationObserver = null;
        
        this.initializeObservers();
    }
    
    // ================== INITIALIZATION ==================
    initializeObservers() {
        // Intersection Observer for lazy loading detection
        this.intersectionObserver = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            { threshold: 0.1, rootMargin: '50px' }
        );
        
        // Mutation Observer for dynamic content
        this.mutationObserver = new MutationObserver(
            (mutations) => this.handleMutations(mutations)
        );
    }
    
    // ================== MAIN SCANNING METHODS ==================
    async scanCurrentPage(settings = {}) {
        this.settings = { ...this.getDefaultSettings(), ...settings };
        
        try {
            this.startScanning();
            
            // Get site-specific patterns
            const siteInfo = window.sitePatternManager.detectSiteType();
            const selectors = window.sitePatternManager.getOptimizedSelectors();
            const characteristics = window.sitePatternManager.getSiteCharacteristics();
            
            // Add custom patterns if provided
            if (this.settings.customPatterns) {
                window.sitePatternManager.parseCustomPatterns(this.settings.customPatterns);
            }
            
            let foundImages = [];
            
            // Phase 1: Basic image scanning
            foundImages = await this.performBasicScan(selectors);
            
            // Phase 2: Handle lazy loading if needed
            if (characteristics.hasLazyLoading) {
                await this.handleLazyLoading();
                foundImages = await this.performBasicScan(selectors);
            }
            
            // Phase 3: Handle infinite scroll if needed
            if (characteristics.hasInfiniteScroll && this.settings.infiniteScroll) {
                foundImages = await this.handleInfiniteScroll(selectors);
            }
            
            // Phase 4: Extract from canvas/blob sources
            const canvasImages = await this.extractCanvasImages();
            foundImages = [...foundImages, ...canvasImages];
            
            // Phase 5: Filter and process results
            const processedImages = this.filterAndProcessImages(foundImages);
            
            this.notifyProgress(`สแกนเสร็จสิ้น: พบภาพ ${processedImages.length} รูป`);
            
            return {
                success: true,
                images: processedImages,
                siteInfo,
                stats: {
                    total: processedImages.length,
                    filtered: foundImages.length - processedImages.length,
                    canvasImages: canvasImages.length
                }
            };
            
        } catch (error) {
            console.error('Scan error:', error);
            return {
                success: false,
                error: error.message,
                images: []
            };
        } finally {
            this.stopScanning();
        }
    }
    
    async performDeepScan(settings = {}) {
        this.settings = { ...this.getDefaultSettings(), ...settings };
        
        try {
            this.startScanning();
            
            // Start with current page
            let allImages = [];
            const scannedUrls = new Set([window.location.href]);
            
            // Phase 1: Scan current page
            const currentPageResult = await this.scanCurrentPage(settings);
            if (currentPageResult.success) {
                allImages = [...currentPageResult.images];
            }
            
            // Phase 2: Deep scan through linked pages
            if (this.settings.scanDepth > 1) {
                const linkedPages = await this.findLinkedPages();
                
                for (let depth = 1; depth < this.settings.scanDepth; depth++) {
                    this.notifyProgress(`กำลังสแกนระดับที่ ${depth + 1}...`);
                    
                    const pagesToScan = linkedPages.slice(0, 5); // Limit pages per depth
                    
                    for (const pageUrl of pagesToScan) {
                        if (scannedUrls.has(pageUrl) || this.abortController?.signal.aborted) {
                            continue;
                        }
                        
                        try {
                            const pageImages = await this.scanExternalPage(pageUrl);
                            allImages = [...allImages, ...pageImages];
                            scannedUrls.add(pageUrl);
                            
                            // Small delay to prevent overwhelming
                            await this.delay(500);
                            
                        } catch (error) {
                            console.warn(`Failed to scan page ${pageUrl}:`, error);
                        }
                    }
                }
            }
            
            // Remove duplicates and filter
            const uniqueImages = this.removeDuplicateImages(allImages);
            const finalImages = this.filterAndProcessImages(uniqueImages);
            
            this.notifyProgress(`Deep Scan เสร็จสิ้น: พบภาพ ${finalImages.length} รูป จาก ${scannedUrls.size} หน้า`);
            
            return {
                success: true,
                images: finalImages,
                stats: {
                    pagesScanned: scannedUrls.size,
                    totalImages: finalImages.length,
                    depth: this.settings.scanDepth
                }
            };
            
        } catch (error) {
            console.error('Deep scan error:', error);
            return {
                success: false,
                error: error.message,
                images: []
            };
        } finally {
            this.stopScanning();
        }
    }
    
    // ================== BASIC SCANNING ==================
    async performBasicScan(selectors) {
        const foundImages = [];
        
        // Scan using multiple selector strategies
        for (const selector of selectors.images) {
            try {
                const elements = document.querySelectorAll(selector);
                
                for (const element of elements) {
                    const imageData = await this.extractImageData(element);
                    if (imageData && this.isValidImage(imageData)) {
                        foundImages.push(imageData);
                    }
                }
            } catch (error) {
                console.warn(`Selector failed: ${selector}`, error);
            }
        }
        
        return foundImages;
    }
    
    async extractImageData(element) {
        try {
            const imageData = {
                element,
                url: '',
                src: '',
                alt: element.alt || '',
                width: 0,
                height: 0,
                type: '',
                selector: '',
                timestamp: Date.now()
            };
            
            // Extract URL from various sources
            imageData.url = this.extractImageUrl(element);
            imageData.src = imageData.url;
            
            if (!imageData.url) return null;
            
            // Get dimensions
            if (element.naturalWidth && element.naturalHeight) {
                imageData.width = element.naturalWidth;
                imageData.height = element.naturalHeight;
            } else if (element.width && element.height) {
                imageData.width = element.width;
                imageData.height = element.height;
            } else {
                // Try to load and get dimensions
                const dimensions = await this.getImageDimensions(imageData.url);
                imageData.width = dimensions.width;
                imageData.height = dimensions.height;
            }
            
            // Determine type
            imageData.type = this.determineImageType(imageData.url);
            
            // Estimate file size (rough approximation)
            imageData.estimatedSize = this.estimateImageSize(imageData);
            
            return imageData;
            
        } catch (error) {
            console.warn('Failed to extract image data:', error);
            return null;
        }
    }
    
    extractImageUrl(element) {
        // Priority order for URL extraction
        const urlSources = [
            'data-original',
            'data-src',
            'data-url',
            'data-large-file-url',
            'data-zoom-image',
            'data-full',
            'data-hires',
            'src'
        ];
        
        for (const attr of urlSources) {
            const url = element.getAttribute(attr);
            if (url && this.isValidImageUrl(url)) {
                return this.normalizeImageUrl(url);
            }
        }
        
        // Check srcset for high-resolution images
        const srcset = element.getAttribute('srcset');
        if (srcset) {
            const highResUrl = this.extractBestFromSrcset(srcset);
            if (highResUrl) return this.normalizeImageUrl(highResUrl);
        }
        
        // Check parent elements for data attributes
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 3) {
            for (const attr of ['data-src', 'data-url', 'data-image']) {
                const url = parent.getAttribute(attr);
                if (url && this.isValidImageUrl(url)) {
                    return this.normalizeImageUrl(url);
                }
            }
            parent = parent.parentElement;
            depth++;
        }
        
        return null;
    }
    
    // ================== LAZY LOADING HANDLING ==================
    async handleLazyLoading() {
        this.notifyProgress('จัดการ Lazy Loading...');
        
        // Find images that might be lazy loaded
        const lazyImages = document.querySelectorAll([
            'img[data-src]',
            'img[data-original]',
            'img[loading="lazy"]',
            'img:not([src])',
            '.lazyload',
            '.lazy'
        ].join(', '));
        
        // Trigger loading by observing
        lazyImages.forEach(img => {
            this.intersectionObserver.observe(img);
        });
        
        // Scroll to trigger lazy loading
        await this.triggerLazyLoadingByScroll();
        
        // Wait for images to load
        await this.delay(2000);
        
        // Stop observing
        this.intersectionObserver.disconnect();
        this.initializeObservers();
    }
    
    async triggerLazyLoadingByScroll() {
        const scrollHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const scrollSteps = Math.min(10, Math.ceil(scrollHeight / viewportHeight));
        
        for (let i = 0; i <= scrollSteps; i++) {
            const scrollPosition = (scrollHeight * i) / scrollSteps;
            window.scrollTo(0, scrollPosition);
            await this.delay(300);
        }
        
        // Return to top
        window.scrollTo(0, 0);
    }
    
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                
                // Try to trigger loading
                const dataSrc = img.getAttribute('data-src') || 
                              img.getAttribute('data-original');
                              
                if (dataSrc && !img.src) {
                    img.src = dataSrc;
                }
                
                // Trigger any lazy loading library
                if (img.classList.contains('lazyload')) {
                    img.classList.add('lazyloaded');
                }
            }
        });
    }
    
    // ================== INFINITE SCROLL HANDLING ==================
    async handleInfiniteScroll(selectors) {
        this.notifyProgress('จัดการ Infinite Scroll...');
        
        let allImages = [];
        let previousImageCount = 0;
        let consecutiveNoChange = 0;
        const maxScrollAttempts = 10;
        
        for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
            // Scan current content
            const currentImages = await this.performBasicScan(selectors);
            allImages = this.mergImageArrays(allImages, currentImages);
            
            // Check if we found new images
            if (allImages.length === previousImageCount) {
                consecutiveNoChange++;
                if (consecutiveNoChange >= 3) break; // Stop if no new images for 3 attempts
            } else {
                consecutiveNoChange = 0;
                previousImageCount = allImages.length;
            }
            
            // Trigger more content loading
            const loadedMore = await this.triggerMoreContent();
            if (!loadedMore) break;
            
            // Wait for content to load
            await this.delay(1000);
            
            this.notifyProgress(`Infinite Scroll: พบภาพ ${allImages.length} รูป (ครั้งที่ ${attempt + 1})`);
        }
        
        return allImages;
    }
    
    async triggerMoreContent() {
        // Method 1: Scroll to bottom
        const oldHeight = document.documentElement.scrollHeight;
        window.scrollTo(0, document.documentElement.scrollHeight);
        await this.delay(500);
        
        // Method 2: Look for "Load More" buttons
        const loadMoreButtons = document.querySelectorAll([
            '.load-more', '.show-more', '.next-page',
            '[data-load-more]', '[data-next]',
            'button[onclick*="load"]', 'button[onclick*="more"]'
        ].join(', '));
        
        for (const button of loadMoreButtons) {
            if (button.offsetParent !== null && !button.disabled) {
                try {
                    button.click();
                    await this.delay(1000);
                    break;
                } catch (error) {
                    console.warn('Failed to click load more button:', error);
                }
            }
        }
        
        // Method 3: Trigger scroll events
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
        
        // Check if new content was loaded
        const newHeight = document.documentElement.scrollHeight;
        return newHeight > oldHeight;
    }
    
    // ================== CANVAS & BLOB EXTRACTION ==================
    async extractCanvasImages() {
        const canvasImages = [];
        
        if (!this.settings.fileTypes?.blob) return canvasImages;
        
        this.notifyProgress('สแกนหา Canvas และ Blob images...');
        
        // Extract from canvas elements
        const canvases = document.querySelectorAll('canvas');
        for (let i = 0; i < canvases.length; i++) {
            try {
                const canvas = canvases[i];
                if (canvas.width > this.settings.minWidth && canvas.height > this.settings.minHeight) {
                    const dataUrl = canvas.toDataURL('image/png');
                    
                    canvasImages.push({
                        url: dataUrl,
                        src: dataUrl,
                        alt: `Canvas Image ${i + 1}`,
                        width: canvas.width,
                        height: canvas.height,
                        type: 'canvas',
                        estimatedSize: this.estimateCanvasSize(canvas),
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.warn(`Failed to extract canvas ${i}:`, error);
            }
        }
        
        // Extract blob URLs from background images
        const blobImages = await this.extractBlobFromBackgrounds();
        canvasImages.push(...blobImages);
        
        // Extract from video frames if any
        const videoFrames = await this.extractVideoFrames();
        canvasImages.push(...videoFrames);
        
        return canvasImages;
    }
    
    async extractBlobFromBackgrounds() {
        const blobImages = [];
        const elementsWithBg = document.querySelectorAll('*');
        
        for (const element of elementsWithBg) {
            try {
                const computedStyle = window.getComputedStyle(element);
                const backgroundImage = computedStyle.backgroundImage;
                
                if (backgroundImage && backgroundImage !== 'none') {
                    const urlMatch = backgroundImage.match(/url\((["']?)(.*?)\1\)/);
                    if (urlMatch && urlMatch[2]) {
                        const url = urlMatch[2];
                        if (url.startsWith('blob:') && this.isValidImageUrl(url)) {
                            const dimensions = await this.getImageDimensions(url);
                            
                            if (dimensions.width >= this.settings.minWidth && 
                                dimensions.height >= this.settings.minHeight) {
                                
                                blobImages.push({
                                    url: url,
                                    src: url,
                                    alt: 'Background Blob Image',
                                    width: dimensions.width,
                                    height: dimensions.height,
                                    type: 'blob',
                                    estimatedSize: dimensions.width * dimensions.height * 3,
                                    timestamp: Date.now()
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                // Ignore errors for elements we can't access
            }
        }
        
        return blobImages;
    }
    
    async extractVideoFrames() {
        const videoFrames = [];
        const videos = document.querySelectorAll('video');
        
        for (let i = 0; i < videos.length; i++) {
            try {
                const video = videos[i];
                if (video.videoWidth > this.settings.minWidth && 
                    video.videoHeight > this.settings.minHeight) {
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    
                    videoFrames.push({
                        url: dataUrl,
                        src: dataUrl,
                        alt: `Video Frame ${i + 1}`,
                        width: video.videoWidth,
                        height: video.videoHeight,
                        type: 'video-frame',
                        estimatedSize: this.estimateCanvasSize(canvas),
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.warn(`Failed to extract video frame ${i}:`, error);
            }
        }
        
        return videoFrames;
    }
    
    // ================== EXTERNAL PAGE SCANNING ==================
    async scanExternalPage(url) {
        try {
            // Note: Due to CORS restrictions, we can't directly scan external pages
            // This would require a different approach in a real extension
            // For now, we'll return empty array and log the limitation
            
            console.log(`External page scanning would require iframe or background fetch: ${url}`);
            return [];
            
        } catch (error) {
            console.warn(`Failed to scan external page ${url}:`, error);
            return [];
        }
    }
    
    async findLinkedPages() {
        const linkedPages = [];
        const selectors = window.sitePatternManager.getOptimizedSelectors();
        
        // Find next page links
        for (const selector of selectors.nextPage) {
            try {
                const links = document.querySelectorAll(selector);
                
                for (const link of links) {
                    const href = link.href || link.getAttribute('href');
                    if (href && this.isValidPageUrl(href)) {
                        linkedPages.push(this.normalizeUrl(href));
                    }
                }
            } catch (error) {
                console.warn(`Failed to find links with selector: ${selector}`, error);
            }
        }
        
        // Find pagination links
        for (const selector of selectors.pagination) {
            try {
                const links = document.querySelectorAll(selector);
                
                for (const link of links) {
                    const href = link.href || link.getAttribute('href');
                    if (href && this.isValidPageUrl(href)) {
                        linkedPages.push(this.normalizeUrl(href));
                    }
                }
            } catch (error) {
                console.warn(`Failed to find pagination with selector: ${selector}`, error);
            }
        }
        
        // Remove duplicates and current page
        const currentUrl = window.location.href;
        return [...new Set(linkedPages)].filter(url => url !== currentUrl);
    }
    
    // ================== FILTERING & PROCESSING ==================
    filterAndProcessImages(images) {
        return images
            .filter(img => this.passesFilters(img))
            .map(img => this.processImageData(img))
            .sort((a, b) => b.estimatedSize - a.estimatedSize); // Sort by size, largest first
    }
    
    passesFilters(imageData) {
        // File type filter
        if (!this.passesFileTypeFilter(imageData)) return false;
        
        // Size filter
        if (imageData.width < this.settings.minWidth || 
            imageData.height < this.settings.minHeight) return false;
        
        // URL validity
        if (!this.isValidImageUrl(imageData.url)) return false;
        
        // Duplicate check
        const imageKey = this.generateImageKey(imageData);
        if (this.scannedImages.has(imageKey)) return false;
        
        this.scannedImages.set(imageKey, imageData);
        return true;
    }
    
    passesFileTypeFilter(imageData) {
        const fileTypes = this.settings.fileTypes || {};
        const type = imageData.type || this.determineImageType(imageData.url);
        
        switch (type) {
            case 'jpg':
            case 'jpeg':
                return fileTypes.jpg;
            case 'png':
                return fileTypes.png;
            case 'webp':
                return fileTypes.webp;
            case 'gif':
                return fileTypes.gif;
            case 'svg':
                return fileTypes.svg;
            case 'canvas':
            case 'blob':
            case 'video-frame':
                return fileTypes.blob;
            default:
                return true; // Allow unknown types
        }
    }
    
    processImageData(imageData) {
        return {
            ...imageData,
            id: this.generateImageKey(imageData),
            downloadUrl: this.prepareDownloadUrl(imageData.url),
            filename: this.generateFilename(imageData),
            sizeFormatted: this.formatFileSize(imageData.estimatedSize)
        };
    }
    
    // ================== UTILITY METHODS ==================
    getDefaultSettings() {
        return {
            fileTypes: {
                jpg: true, png: true, webp: true, gif: true, svg: false, blob: true
            },
            minWidth: 100,
            minHeight: 100,
            scanDepth: 2,
            followPagination: true,
            followGallery: true,
            infiniteScroll: true,
            customPatterns: '',
            debugMode: false
        };
    }
    
    generateImageKey(imageData) {
        // Create unique key for duplicate detection
        const url = imageData.url.split('?')[0]; // Remove query params
        return `${url}_${imageData.width}x${imageData.height}`;
    }
    
    isValidImageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            // Handle relative URLs
            if (url.startsWith('/')) {
                url = new URL(url, window.location.origin).href;
            }
            
            const urlObj = new URL(url);
            
            // Check for image extensions
            const imageExtensions = /\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff|ico)(\?.*)?$/i;
            if (imageExtensions.test(urlObj.pathname)) return true;
            
            // Check for blob and data URLs
            if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;
            
            // Check for common image patterns in query params or path
            const imagePatterns = [
                /[?&](image|img|pic|photo)/i,
                /\/(image|img|pic|photo|thumbnail|thumb)/i,
                /\.(jpg|jpeg|png|webp|gif)$/i
            ];
            
            return imagePatterns.some(pattern => pattern.test(url));
            
        } catch (error) {
            return false;
        }
    }
    
    isValidPageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            const urlObj = new URL(url, window.location.href);
            
            // Must be HTTP/HTTPS
            if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
            
            // Avoid file downloads
            const downloadExtensions = /\.(pdf|doc|docx|zip|rar|exe|dmg)$/i;
            if (downloadExtensions.test(urlObj.pathname)) return false;
            
            return true;
            
        } catch (error) {
            return false;
        }
    }
    
    normalizeImageUrl(url) {
        try {
            if (url.startsWith('//')) {
                return `${window.location.protocol}${url}`;
            }
            if (url.startsWith('/')) {
                return `${window.location.origin}${url}`;
            }
            return url;
        } catch (error) {
            return url;
        }
    }
    
    normalizeUrl(url) {
        try {
            return new URL(url, window.location.href).href;
        } catch (error) {
            return url;
        }
    }
    
    extractBestFromSrcset(srcset) {
        try {
            const sources = srcset.split(',').map(src => {
                const parts = src.trim().split(' ');
                const url = parts[0];
                const descriptor = parts[1] || '1x';
                
                let resolution = 1;
                if (descriptor.endsWith('w')) {
                    resolution = parseInt(descriptor) || 1;
                } else if (descriptor.endsWith('x')) {
                    resolution = parseFloat(descriptor) || 1;
                }
                
                return { url, resolution };
            });
            
            // Return highest resolution
            const best = sources.reduce((best, current) => 
                current.resolution > best.resolution ? current : best
            );
            
            return best.url;
            
        } catch (error) {
            return null;
        }
    }
    
    async getImageDimensions(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                resolve({ width: 0, height: 0 });
            };
            
            // Set timeout to avoid hanging
            setTimeout(() => resolve({ width: 0, height: 0 }), 5000);
            
            img.src = url;
        });
    }
    
    determineImageType(url) {
        if (url.startsWith('data:image/')) {
            const match = url.match(/data:image\/([^;]+)/);
            return match ? match[1] : 'unknown';
        }
        
        if (url.startsWith('blob:')) return 'blob';
        
        const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase();
        return extension || 'unknown';
    }
    
    estimateImageSize(imageData) {
        const { width, height, type } = imageData;
        if (!width || !height) return 0;
        
        const pixels = width * height;
        
        // Rough estimates based on compression
        switch (type) {
            case 'jpg':
            case 'jpeg':
                return pixels * 0.5; // JPEG compression
            case 'png':
                return pixels * 2; // PNG with alpha
            case 'webp':
                return pixels * 0.3; // WebP compression
            case 'gif':
                return pixels * 1; // GIF
            case 'svg':
                return Math.min(pixels * 0.1, 50000); // SVG is text-based
            default:
                return pixels * 1.5; // Default estimate
        }
    }
    
    estimateCanvasSize(canvas) {
        return canvas.width * canvas.height * 4; // RGBA
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    generateFilename(imageData) {
        try {
            const url = imageData.url;
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            let filename = pathParts[pathParts.length - 1] || 'image';
            
            // Ensure proper extension
            if (!filename.includes('.') || filename.startsWith('data:')) {
                const extension = this.determineImageType(url);
                filename = `${imageData.alt || 'image'}.${extension}`;
            }
            
            // Sanitize filename
            filename = filename.replace(/[<>:"/\\|?*]/g, '_');
            
            return filename;
            
        } catch (error) {
            return `image_${Date.now()}.jpg`;
        }
    }
    
    prepareDownloadUrl(url) {
        // Handle relative URLs
        if (url.startsWith('/')) {
            return new URL(url, window.location.origin).href;
        }
        return url;
    }
    
    removeDuplicateImages(images) {
        const seen = new Set();
        return images.filter(img => {
            const key = this.generateImageKey(img);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    
    mergImageArrays(array1, array2) {
        const combined = [...array1, ...array2];
        return this.removeDuplicateImages(combined);
    }
    
    // ================== SCANNING CONTROL ==================
    startScanning() {
        this.isScanning = true;
        this.abortController = new AbortController();
        
        // Start mutation observer for dynamic content
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'data-src', 'data-original']
        });
    }
    
    stopScanning() {
        this.isScanning = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        
        // Stop observers
        this.mutationObserver.disconnect();
        this.intersectionObserver.disconnect();
        
        // Reinitialize observers for next scan
        this.initializeObservers();
    }
    
    handleMutations(mutations) {
        if (!this.isScanning) return;
        
        // Handle dynamic content changes during scanning
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if new images were added
                        const images = node.querySelectorAll('img');
                        images.forEach(img => {
                            this.intersectionObserver.observe(img);
                        });
                    }
                });
            }
        });
    }
    
    notifyProgress(message) {
        // Send progress updates to popup
        chrome.runtime.sendMessage({
            action: 'scanProgress',
            message: message
        }).catch(() => {
            // Popup might be closed, ignore
        });
        
        if (this.settings.debugMode) {
            console.log('📡 Scanner:', message);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ================== GLOBAL INSTANCE ==================
window.contentScanner = new ContentScanner();
