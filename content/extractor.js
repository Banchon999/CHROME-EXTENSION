/**
 * Advanced Image Downloader Pro - Advanced Image Extractor
 * ระบบสกัดและประมวลผลภาพขั้นสูงสำหรับทุกรูปแบบ
 */

class AdvancedImageExtractor {
    constructor() {
        this.cache = new Map();
        this.corsProxyUrls = [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://proxy.cors.sh/'
        ];
        this.supportedFormats = new Set([
            'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'ico',
            'avif', 'heic', 'raw', 'psd'
        ]);
        
        this.downloadStats = {
            attempted: 0,
            successful: 0,
            failed: 0,
            corsBlocked: 0,
            converted: 0
        };
    }
    
    // ================== MAIN EXTRACTION METHODS ==================
    async extractImageData(imageElement, options = {}) {
        const defaultOptions = {
            preferHighQuality: true,
            enableConversion: true,
            useCorsProxy: true,
            maxRetries: 3,
            timeout: 30000,
            extractMetadata: true
        };
        
        const config = { ...defaultOptions, ...options };
        
        try {
            // Phase 1: Extract basic image information
            const basicInfo = await this.extractBasicInfo(imageElement);
            
            // Phase 2: Find the best quality source
            const bestSource = await this.findBestImageSource(imageElement, config);
            
            // Phase 3: Handle different image types
            const extractedData = await this.handleImageType(bestSource, config);
            
            // Phase 4: Extract metadata if requested
            if (config.extractMetadata) {
                extractedData.metadata = await this.extractMetadata(extractedData.blob || extractedData.url);
            }
            
            // Phase 5: Convert format if needed
            if (config.enableConversion && this.needsConversion(extractedData)) {
                extractedData.converted = await this.convertImage(extractedData, config);
            }
            
            return {
                success: true,
                ...basicInfo,
                ...extractedData,
                extractedAt: Date.now()
            };
            
        } catch (error) {
            console.error('Image extraction failed:', error);
            return {
                success: false,
                error: error.message,
                element: imageElement
            };
        }
    }
    
    // ================== BASIC INFO EXTRACTION ==================
    async extractBasicInfo(element) {
        const info = {
            element: element,
            tagName: element.tagName.toLowerCase(),
            alt: element.alt || '',
            title: element.title || '',
            className: element.className || '',
            id: element.id || '',
            
            // Position and visibility
            boundingRect: element.getBoundingClientRect(),
            isVisible: this.isElementVisible(element),
            
            // Parent context
            parentInfo: this.getParentContext(element),
            
            // Attributes
            attributes: this.getAllAttributes(element)
        };
        
        return info;
    }
    
    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
        );
    }
    
    getParentContext(element) {
        const context = {
            parents: [],
            dataAttributes: {},
            contextualInfo: {}
        };
        
        let parent = element.parentElement;
        let depth = 0;
        
        while (parent && depth < 5) {
            context.parents.push({
                tagName: parent.tagName.toLowerCase(),
                className: parent.className || '',
                id: parent.id || ''
            });
            
            // Extract data attributes from parents
            Array.from(parent.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    context.dataAttributes[attr.name] = attr.value;
                }
            });
            
            parent = parent.parentElement;
            depth++;
        }
        
        return context;
    }
    
    getAllAttributes(element) {
        const attributes = {};
        Array.from(element.attributes).forEach(attr => {
            attributes[attr.name] = attr.value;
        });
        return attributes;
    }
    
    // ================== SOURCE DETECTION ==================
    async findBestImageSource(element, config) {
        const sources = [];
        
        // Strategy 1: Direct src attributes (priority order)
        const srcAttributes = [
            'data-zoom-image',
            'data-large-file-url',
            'data-full-size',
            'data-hires',
            'data-original',
            'data-src',
            'data-url',
            'src'
        ];
        
        for (const attr of srcAttributes) {
            const url = element.getAttribute(attr);
            if (url && this.isValidImageUrl(url)) {
                sources.push({
                    url: this.normalizeUrl(url),
                    type: 'attribute',
                    attribute: attr,
                    priority: srcAttributes.indexOf(attr),
                    quality: this.estimateQuality(url, attr)
                });
            }
        }
        
        // Strategy 2: Srcset parsing for responsive images
        const srcsetSources = await this.parseSrcset(element);
        sources.push(...srcsetSources);
        
        // Strategy 3: Background images
        const backgroundSources = await this.extractBackgroundImages(element);
        sources.push(...backgroundSources);
        
        // Strategy 4: Parent element sources
        const parentSources = await this.extractParentSources(element);
        sources.push(...parentSources);
        
        // Strategy 5: Canvas extraction if element is canvas
        if (element.tagName.toLowerCase() === 'canvas') {
            const canvasSource = await this.extractCanvasData(element);
            if (canvasSource) sources.push(canvasSource);
        }
        
        // Sort by quality and priority
        sources.sort((a, b) => {
            if (a.quality !== b.quality) return b.quality - a.quality;
            return a.priority - b.priority;
        });
        
        // Return best source or fallback
        return sources[0] || { 
            url: element.src || element.getAttribute('src'), 
            type: 'fallback',
            quality: 1
        };
    }
    
    async parseSrcset(element) {
        const sources = [];
        const srcset = element.getAttribute('srcset');
        
        if (!srcset) return sources;
        
        try {
            const srcsetEntries = srcset.split(',').map(entry => {
                const parts = entry.trim().split(/\s+/);
                const url = parts[0];
                const descriptor = parts[1] || '1x';
                
                let resolution = 1;
                if (descriptor.endsWith('w')) {
                    resolution = parseInt(descriptor) / 1000; // Convert width to resolution estimate
                } else if (descriptor.endsWith('x')) {
                    resolution = parseFloat(descriptor);
                }
                
                return {
                    url: this.normalizeUrl(url),
                    type: 'srcset',
                    descriptor: descriptor,
                    resolution: resolution,
                    priority: 10,
                    quality: Math.min(resolution * 30, 100) // Quality score based on resolution
                };
            });
            
            sources.push(...srcsetEntries);
            
        } catch (error) {
            console.warn('Failed to parse srcset:', error);
        }
        
        return sources;
    }
    
    async extractBackgroundImages(element) {
        const sources = [];
        
        try {
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatches = backgroundImage.match(/url\((["']?)(.*?)\1\)/g);
                
                if (urlMatches) {
                    urlMatches.forEach((match, index) => {
                        const urlMatch = match.match(/url\((["']?)(.*?)\1\)/);
                        if (urlMatch && urlMatch[2]) {
                            const url = this.normalizeUrl(urlMatch[2]);
                            if (this.isValidImageUrl(url)) {
                                sources.push({
                                    url: url,
                                    type: 'background',
                                    priority: 15 + index,
                                    quality: this.estimateQuality(url, 'background')
                                });
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to extract background images:', error);
        }
        
        return sources;
    }
    
    async extractParentSources(element) {
        const sources = [];
        let parent = element.parentElement;
        let depth = 0;
        
        while (parent && depth < 3) {
            // Check for data attributes in parent
            const parentAttrs = ['data-src', 'data-url', 'data-image', 'data-full'];
            
            for (const attr of parentAttrs) {
                const url = parent.getAttribute(attr);
                if (url && this.isValidImageUrl(url)) {
                    sources.push({
                        url: this.normalizeUrl(url),
                        type: 'parent',
                        attribute: attr,
                        depth: depth,
                        priority: 20 + depth,
                        quality: this.estimateQuality(url, attr) - (depth * 10)
                    });
                }
            }
            
            parent = parent.parentElement;
            depth++;
        }
        
        return sources;
    }
    
    async extractCanvasData(canvas) {
        try {
            if (canvas.width === 0 || canvas.height === 0) return null;
            
            // Try different formats for best quality
            const formats = ['image/png', 'image/webp', 'image/jpeg'];
            let bestDataUrl = null;
            let bestQuality = 0;
            
            for (const format of formats) {
                try {
                    const dataUrl = canvas.toDataURL(format, 0.95);
                    const quality = this.estimateDataUrlQuality(dataUrl);
                    
                    if (quality > bestQuality) {
                        bestDataUrl = dataUrl;
                        bestQuality = quality;
                    }
                } catch (error) {
                    // Format not supported, continue
                }
            }
            
            if (bestDataUrl) {
                return {
                    url: bestDataUrl,
                    type: 'canvas',
                    priority: 5,
                    quality: 90,
                    width: canvas.width,
                    height: canvas.height
                };
            }
            
        } catch (error) {
            console.warn('Failed to extract canvas data:', error);
        }
        
        return null;
    }
    
    // ================== IMAGE TYPE HANDLING ==================
    async handleImageType(source, config) {
        const url = source.url;
        
        if (url.startsWith('data:')) {
            return this.handleDataUrl(url, config);
        } else if (url.startsWith('blob:')) {
            return this.handleBlobUrl(url, config);
        } else if (this.isRemoteUrl(url)) {
            return this.handleRemoteUrl(url, config);
        } else {
            return this.handleLocalUrl(url, config);
        }
    }
    
    async handleDataUrl(dataUrl, config) {
        try {
            const [header, data] = dataUrl.split(',');
            const mimeMatch = header.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            
            // Convert to blob for consistent handling
            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
            return {
                url: dataUrl,
                blob: blob,
                mimeType: mimeType,
                size: blob.size,
                type: 'data-url',
                downloadUrl: URL.createObjectURL(blob)
            };
            
        } catch (error) {
            throw new Error(`Failed to process data URL: ${error.message}`);
        }
    }
    
    async handleBlobUrl(blobUrl, config) {
        try {
            const response = await this.fetchWithTimeout(blobUrl, config.timeout);
            const blob = await response.blob();
            
            return {
                url: blobUrl,
                blob: blob,
                mimeType: blob.type,
                size: blob.size,
                type: 'blob-url',
                downloadUrl: blobUrl
            };
            
        } catch (error) {
            throw new Error(`Failed to process blob URL: ${error.message}`);
        }
    }
    
    async handleRemoteUrl(url, config) {
        let lastError = null;
        
        // Try direct fetch first
        try {
            const response = await this.fetchWithTimeout(url, config.timeout);
            const blob = await response.blob();
            
            return {
                url: url,
                blob: blob,
                mimeType: blob.type,
                size: blob.size,
                type: 'remote-direct',
                downloadUrl: URL.createObjectURL(blob)
            };
            
        } catch (error) {
            lastError = error;
            this.downloadStats.corsBlocked++;
        }
        
        // Try CORS proxies if direct fetch fails
        if (config.useCorsProxy) {
            for (const proxyUrl of this.corsProxyUrls) {
                try {
                    const proxiedUrl = proxyUrl + encodeURIComponent(url);
                    const response = await this.fetchWithTimeout(proxiedUrl, config.timeout);
                    const blob = await response.blob();
                    
                    return {
                        url: url,
                        originalUrl: url,
                        proxiedUrl: proxiedUrl,
                        blob: blob,
                        mimeType: blob.type,
                        size: blob.size,
                        type: 'remote-proxy',
                        downloadUrl: URL.createObjectURL(blob)
                    };
                    
                } catch (proxyError) {
                    console.warn(`Proxy ${proxyUrl} failed:`, proxyError);
                    lastError = proxyError;
                }
            }
        }
        
        // Fallback: return URL for direct download
        return {
            url: url,
            type: 'remote-fallback',
            downloadUrl: url,
            error: lastError?.message
        };
    }
    
    async handleLocalUrl(url, config) {
        try {
            const fullUrl = new URL(url, window.location.href).href;
            return this.handleRemoteUrl(fullUrl, config);
            
        } catch (error) {
            throw new Error(`Failed to process local URL: ${error.message}`);
        }
    }
    
    // ================== METADATA EXTRACTION ==================
    async extractMetadata(source) {
        const metadata = {
            exif: null,
            iptc: null,
            icc: null,
            xmp: null,
            fileInfo: {}
        };
        
        try {
            let arrayBuffer;
            
            if (source instanceof Blob) {
                arrayBuffer = await source.arrayBuffer();
            } else if (typeof source === 'string') {
                if (source.startsWith('data:')) {
                    const [header, data] = source.split(',');
                    const byteCharacters = atob(data);
                    arrayBuffer = new ArrayBuffer(byteCharacters.length);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        uint8Array[i] = byteCharacters.charCodeAt(i);
                    }
                } else {
                    // Fetch and extract metadata
                    const response = await fetch(source);
                    arrayBuffer = await response.arrayBuffer();
                }
            }
            
            if (arrayBuffer) {
                metadata.fileInfo = this.analyzeFileStructure(arrayBuffer);
                metadata.exif = this.extractExifData(arrayBuffer);
            }
            
        } catch (error) {
            console.warn('Metadata extraction failed:', error);
        }
        
        return metadata;
    }
    
    analyzeFileStructure(arrayBuffer) {
        const uint8Array = new Uint8Array(arrayBuffer);
        const fileInfo = {
            size: arrayBuffer.byteLength,
            format: 'unknown',
            signature: '',
            isValid: false
        };
        
        // Check file signatures
        const signatures = {
            'JPEG': [0xFF, 0xD8, 0xFF],
            'PNG': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            'GIF': [0x47, 0x49, 0x46],
            'WebP': [0x52, 0x49, 0x46, 0x46], // RIFF header
            'BMP': [0x42, 0x4D],
            'TIFF': [0x49, 0x49, 0x2A, 0x00] // Little endian
        };
        
        for (const [format, signature] of Object.entries(signatures)) {
            if (this.checkSignature(uint8Array, signature)) {
                fileInfo.format = format;
                fileInfo.isValid = true;
                break;
            }
        }
        
        // Store first 16 bytes as signature for debugging
        fileInfo.signature = Array.from(uint8Array.slice(0, 16))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
        
        return fileInfo;
    }
    
    checkSignature(uint8Array, signature) {
        if (uint8Array.length < signature.length) return false;
        
        for (let i = 0; i < signature.length; i++) {
            if (uint8Array[i] !== signature[i]) return false;
        }
        
        return true;
    }
    
    extractExifData(arrayBuffer) {
        // Basic EXIF extraction for JPEG files
        const uint8Array = new Uint8Array(arrayBuffer);
        
        if (!this.checkSignature(uint8Array, [0xFF, 0xD8, 0xFF])) {
            return null; // Not a JPEG
        }
        
        try {
            // Look for EXIF marker (0xFFE1)
            for (let i = 0; i < uint8Array.length - 1; i++) {
                if (uint8Array[i] === 0xFF && uint8Array[i + 1] === 0xE1) {
                    // Found EXIF segment
                    const segmentLength = (uint8Array[i + 2] << 8) | uint8Array[i + 3];
                    const exifData = uint8Array.slice(i + 4, i + 2 + segmentLength);
                    
                    return {
                        found: true,
                        offset: i,
                        length: segmentLength,
                        data: Array.from(exifData.slice(0, 32)) // First 32 bytes for inspection
                    };
                }
            }
        } catch (error) {
            console.warn('EXIF extraction error:', error);
        }
        
        return { found: false };
    }
    
    // ================== IMAGE CONVERSION ==================
    needsConversion(extractedData) {
        const { mimeType, type } = extractedData;
        
        // Convert if unsupported format
        const unsupportedFormats = ['image/webp', 'image/avif', 'image/heic'];
        return unsupportedFormats.includes(mimeType);
    }
    
    async convertImage(extractedData, config) {
        try {
            const { blob, mimeType } = extractedData;
            
            if (!blob) return null;
            
            // Create canvas for conversion
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Load image
            const img = await this.loadImageFromBlob(blob);
            
            // Set canvas dimensions
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            
            // Convert to desired format
            const outputFormat = this.selectOutputFormat(mimeType);
            const quality = outputFormat === 'image/jpeg' ? 0.95 : undefined;
            
            const convertedDataUrl = canvas.toDataURL(outputFormat, quality);
            const convertedBlob = await this.dataUrlToBlob(convertedDataUrl);
            
            this.downloadStats.converted++;
            
            return {
                originalFormat: mimeType,
                convertedFormat: outputFormat,
                originalSize: blob.size,
                convertedSize: convertedBlob.size,
                dataUrl: convertedDataUrl,
                blob: convertedBlob,
                downloadUrl: URL.createObjectURL(convertedBlob)
            };
            
        } catch (error) {
            console.warn('Image conversion failed:', error);
            return null;
        }
    }
    
    selectOutputFormat(inputFormat) {
        // Convert to widely supported formats
        const formatMap = {
            'image/webp': 'image/png',
            'image/avif': 'image/png',
            'image/heic': 'image/jpeg',
            'image/tiff': 'image/png'
        };
        
        return formatMap[inputFormat] || 'image/png';
    }
    
    async loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image'));
            };
            
            img.src = URL.createObjectURL(blob);
        });
    }
    
    async dataUrlToBlob(dataUrl) {
        const response = await fetch(dataUrl);
        return response.blob();
    }
    
    // ================== UTILITY METHODS ==================
    async fetchWithTimeout(url, timeout = 30000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            
            throw error;
        }
    }
    
    isValidImageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            if (url.startsWith('data:image/') || url.startsWith('blob:')) {
                return true;
            }
            
            const urlObj = new URL(url, window.location.href);
            const pathname = urlObj.pathname.toLowerCase();
            
            // Check file extensions
            const imageExtensions = Array.from(this.supportedFormats);
            const hasImageExtension = imageExtensions.some(ext => 
                pathname.endsWith(`.${ext}`) || pathname.includes(`.${ext}?`)
            );
            
            if (hasImageExtension) return true;
            
            // Check for image-related patterns
            const imagePatterns = [
                /[?&](image|img|pic|photo|thumb)/i,
                /\/(image|img|pic|photo|thumbnail|thumb|gallery)/i,
                /\.(jpg|jpeg|png|webp|gif)$/i
            ];
            
            return imagePatterns.some(pattern => pattern.test(url));
            
        } catch (error) {
            return false;
        }
    }
    
    isRemoteUrl(url) {
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.origin !== window.location.origin;
        } catch (error) {
            return false;
        }
    }
    
    normalizeUrl(url) {
        try {
            if (url.startsWith('//')) {
                return `${window.location.protocol}${url}`;
            }
            if (url.startsWith('/')) {
                return `${window.location.origin}${url}`;
            }
            if (!url.includes('://')) {
                return new URL(url, window.location.href).href;
            }
            return url;
        } catch (error) {
            return url;
        }
    }
    
    estimateQuality(url, source) {
        let quality = 50; // Base quality
        
        // Higher quality indicators
        const highQualityIndicators = [
            'zoom', 'large', 'full', 'hires', 'high', 'original', 'max',
            '1080', '1440', '2160', '4k', 'uhd', 'hd'
        ];
        
        const lowQualityIndicators = [
            'thumb', 'thumbnail', 'small', 'preview', 'low', 'compressed',
            'tiny', 'mini', '150', '200', '300'
        ];
        
        const urlLower = url.toLowerCase();
        const sourceLower = source.toLowerCase();
        
        // Check URL for quality indicators
        highQualityIndicators.forEach(indicator => {
            if (urlLower.includes(indicator) || sourceLower.includes(indicator)) {
                quality += 20;
            }
        });
        
        lowQualityIndicators.forEach(indicator => {
            if (urlLower.includes(indicator) || sourceLower.includes(indicator)) {
                quality -= 15;
            }
        });
        
        // File format bonus
        if (urlLower.includes('.png')) quality += 10;
        if (urlLower.includes('.webp')) quality += 5;
        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) quality += 0;
        if (urlLower.includes('.gif')) quality -= 5;
        
        return Math.max(0, Math.min(100, quality));
    }
    
    estimateDataUrlQuality(dataUrl) {
        const sizeEstimate = dataUrl.length;
        
        // Larger data URLs generally indicate higher quality
        if (sizeEstimate > 500000) return 90; // >500KB
        if (sizeEstimate > 100000) return 70; // >100KB
        if (sizeEstimate > 50000) return 50;  // >50KB
        if (sizeEstimate > 10000) return 30;  // >10KB
        return 10; // Small images
    }
    
    // ================== STATISTICS ==================
    getStats() {
        return { ...this.downloadStats };
    }
    
    resetStats() {
        this.downloadStats = {
            attempted: 0,
            successful: 0,
            failed: 0,
            corsBlocked: 0,
            converted: 0
        };
    }
    
    // ================== CLEANUP ==================
    cleanup() {
        // Revoke any created object URLs to prevent memory leaks
        this.cache.forEach(entry => {
            if (entry.objectUrl) {
                URL.revokeObjectURL(entry.objectUrl);
            }
        });
        this.cache.clear();
    }
}

// ================== GLOBAL INSTANCE ==================
window.advancedImageExtractor = new AdvancedImageExtractor();