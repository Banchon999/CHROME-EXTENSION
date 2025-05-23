/**
 * Advanced Image Downloader Pro - Enhanced Utilities
 * ฟังก์ชันช่วยเหลือขั้นสูงสำหรับการประมวลผลและจัดการไฟล์
 */

// ================== ENHANCED FILE UTILITIES ==================
class FileUtils {
    static supportedImageFormats = new Set([
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'ico',
        'avif', 'heic', 'heif', 'raw', 'psd', 'xcf', 'dng'
    ]);
    
    static mimeTypeMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg', 
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'ico': 'image/x-icon',
        'avif': 'image/avif',
        'heic': 'image/heic',
        'heif': 'image/heif'
    };
    
    // ================== FILE FORMAT DETECTION ==================
    static detectImageFormat(data) {
        if (data instanceof ArrayBuffer) {
            return this.detectFormatFromBuffer(data);
        } else if (typeof data === 'string') {
            return this.detectFormatFromUrl(data);
        } else if (data instanceof Blob) {
            return this.detectFormatFromBlob(data);
        }
        return 'unknown';
    }
    
    static detectFormatFromBuffer(buffer) {
        const uint8Array = new Uint8Array(buffer);
        
        const signatures = {
            'jpeg': [0xFF, 0xD8, 0xFF],
            'png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            'gif': [0x47, 0x49, 0x46, 0x38], // GIF8
            'webp': [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
            'bmp': [0x42, 0x4D],
            'tiff-le': [0x49, 0x49, 0x2A, 0x00], // Little endian
            'tiff-be': [0x4D, 0x4D, 0x00, 0x2A], // Big endian
            'ico': [0x00, 0x00, 0x01, 0x00],
            'svg': [0x3C, 0x3F, 0x78, 0x6D, 0x6C], // <?xml
            'psd': [0x38, 0x42, 0x50, 0x53], // 8BPS
            'avif': [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], // ....ftypavif
            'heic': [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63] // ....ftypheic
        };
        
        for (const [format, signature] of Object.entries(signatures)) {
            if (this.matchesSignature(uint8Array, signature)) {
                return format === 'tiff-le' || format === 'tiff-be' ? 'tiff' : format;
            }
        }
        
        return 'unknown';
    }
    
    static matchesSignature(uint8Array, signature) {
        if (uint8Array.length < signature.length) return false;
        
        for (let i = 0; i < signature.length; i++) {
            if (signature[i] !== null && uint8Array[i] !== signature[i]) {
                return false;
            }
        }
        return true;
    }
    
    static detectFormatFromUrl(url) {
        try {
            if (url.startsWith('data:')) {
                const mimeMatch = url.match(/data:image\/([^;]+)/);
                return mimeMatch ? mimeMatch[1] : 'unknown';
            }
            
            const urlObj = new URL(url);
            const extension = urlObj.pathname.split('.').pop()?.toLowerCase();
            
            if (extension && this.supportedImageFormats.has(extension)) {
                return extension;
            }
            
            // Check query parameters for format hints
            const params = urlObj.searchParams;
            const formatParam = params.get('format') || params.get('fmt') || params.get('f');
            if (formatParam && this.supportedImageFormats.has(formatParam.toLowerCase())) {
                return formatParam.toLowerCase();
            }
            
        } catch (error) {
            console.warn('Format detection from URL failed:', error);
        }
        
        return 'unknown';
    }
    
    static async detectFormatFromBlob(blob) {
        if (blob.type && blob.type.startsWith('image/')) {
            const format = blob.type.split('/')[1];
            if (this.supportedImageFormats.has(format)) {
                return format;
            }
        }
        
        // Read first few bytes for signature detection
        try {
            const arrayBuffer = await blob.slice(0, 32).arrayBuffer();
            return this.detectFormatFromBuffer(arrayBuffer);
        } catch (error) {
            console.warn('Format detection from blob failed:', error);
            return 'unknown';
        }
    }
    
    // ================== FILE SIZE UTILITIES ==================
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
    }
    
    static parseFileSize(sizeStr) {
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        const multipliers = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
        
        return value * (multipliers[unit] || 1);
    }
    
    static estimateImageSize(width, height, format = 'jpeg', quality = 0.8) {
        if (!width || !height) return 0;
        
        const pixels = width * height;
        
        const compressionRatios = {
            jpeg: 0.1 * quality + 0.05,
            jpg: 0.1 * quality + 0.05,
            png: 0.5,
            webp: 0.08 * quality + 0.03,
            gif: 0.2,
            bmp: 3,
            tiff: 3,
            svg: 0.01,
            avif: 0.05 * quality + 0.02,
            heic: 0.06 * quality + 0.02
        };
        
        const bytesPerPixel = compressionRatios[format.toLowerCase()] || 0.3;
        return Math.round(pixels * bytesPerPixel);
    }
    
    // ================== FILENAME UTILITIES ==================
    static sanitizeFilename(filename) {
        // Remove or replace invalid characters
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Control characters
            .replace(/^\.+/, '') // Leading dots
            .replace(/\.+$/, '') // Trailing dots
            .replace(/\s+/g, ' ') // Multiple spaces
            .trim()
            .substring(0, 255); // Max filename length
    }
    
    static generateUniqueFilename(baseName, extension, existingNames = new Set()) {
        let filename = `${baseName}.${extension}`;
        let counter = 1;
        
        while (existingNames.has(filename)) {
            filename = `${baseName} (${counter}).${extension}`;
            counter++;
        }
        
        return filename;
    }
    
    static extractFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let filename = urlObj.pathname.split('/').pop();
            
            // Remove query parameters from filename
            filename = filename.split('?')[0];
            
            // If no filename, generate one
            if (!filename || filename === '/') {
                const domain = urlObj.hostname.replace(/^www\./, '');
                filename = `image_from_${domain}`;
            }
            
            return this.sanitizeFilename(filename);
            
        } catch (error) {
            return 'image';
        }
    }
    
    static addTimestampToFilename(filename) {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .substring(0, 19);
        
        const parts = filename.split('.');
        if (parts.length > 1) {
            const extension = parts.pop();
            const baseName = parts.join('.');
            return `${baseName}_${timestamp}.${extension}`;
        } else {
            return `${filename}_${timestamp}`;
        }
    }
}

// ================== URL UTILITIES ==================
class UrlUtils {
    static corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://proxy.cors.sh/',
        'https://corsproxy.io/?',
        'https://thingproxy.freeboard.io/fetch/'
    ];
    
    // ================== URL VALIDATION ==================
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    static isImageUrl(url) {
        if (!this.isValidUrl(url)) return false;
        
        try {
            if (url.startsWith('data:image/') || url.startsWith('blob:')) {
                return true;
            }
            
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            
            // Check file extension
            const imageExtensions = Array.from(FileUtils.supportedImageFormats);
            const hasImageExtension = imageExtensions.some(ext => 
                pathname.endsWith(`.${ext}`) || pathname.includes(`.${ext}?`)
            );
            
            if (hasImageExtension) return true;
            
            // Check for image-related patterns
            const imagePatterns = [
                /[?&](image|img|pic|photo|thumb)/i,
                /\/(image|img|pic|photo|thumbnail|thumb|gallery)/i,
                /\/media\//i,
                /\/assets\/.*\.(jpg|jpeg|png|webp|gif)/i
            ];
            
            return imagePatterns.some(pattern => pattern.test(url));
            
        } catch {
            return false;
        }
    }
    
    static isSameDomain(url1, url2) {
        try {
            const domain1 = new URL(url1).hostname;
            const domain2 = new URL(url2).hostname;
            return domain1 === domain2;
        } catch {
            return false;
        }
    }
    
    static requiresCors(url, currentOrigin = window.location.origin) {
        try {
            const urlObj = new URL(url);
            return urlObj.origin !== currentOrigin;
        } catch {
            return false;
        }
    }
    
    // ================== URL MANIPULATION ==================
    static normalizeUrl(url, baseUrl = window.location.href) {
        try {
            if (url.startsWith('//')) {
                return `${window.location.protocol}${url}`;
            }
            if (url.startsWith('/')) {
                return `${window.location.origin}${url}`;
            }
            if (!url.includes('://')) {
                return new URL(url, baseUrl).href;
            }
            return url;
        } catch {
            return url;
        }
    }
    
    static addCorsProxy(url, proxyIndex = 0) {
        if (proxyIndex >= this.corsProxies.length) {
            throw new Error('No more CORS proxies available');
        }
        
        const proxy = this.corsProxies[proxyIndex];
        return proxy + encodeURIComponent(url);
    }
    
    static removeCorsProxy(proxiedUrl) {
        for (const proxy of this.corsProxies) {
            if (proxiedUrl.startsWith(proxy)) {
                return decodeURIComponent(proxiedUrl.substring(proxy.length));
            }
        }
        return proxiedUrl;
    }
    
    static enhanceImageUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Common image enhancement patterns
            const enhancements = {
                // Instagram
                's150x150': 's1080x1080',
                's320x320': 's1080x1080',
                
                // Twitter
                'name=small': 'name=large',
                'name=medium': 'name=large',
                
                // Facebook
                's130x130': 's720x720',
                's200x200': 's720x720',
                
                // Generic
                'thumb': 'full',
                'small': 'large',
                'preview': 'original',
                '_150': '_1080',
                '_300': '_1080'
            };
            
            let enhancedUrl = url;
            
            for (const [pattern, replacement] of Object.entries(enhancements)) {
                if (enhancedUrl.includes(pattern)) {
                    enhancedUrl = enhancedUrl.replace(pattern, replacement);
                    break;
                }
            }
            
            return enhancedUrl;
            
        } catch {
            return url;
        }
    }
    
    static extractHighResFromSrcset(srcset) {
        if (!srcset) return null;
        
        try {
            const sources = srcset.split(',').map(src => {
                const [url, descriptor = '1x'] = src.trim().split(/\s+/);
                
                let resolution = 1;
                if (descriptor.endsWith('w')) {
                    resolution = parseInt(descriptor) / 1000; // Approximate resolution
                } else if (descriptor.endsWith('x')) {
                    resolution = parseFloat(descriptor);
                }
                
                return { url: url.trim(), resolution };
            });
            
            // Return highest resolution source
            const bestSource = sources.reduce((best, current) => 
                current.resolution > best.resolution ? current : best
            );
            
            return bestSource.url;
            
        } catch {
            return null;
        }
    }
}

// ================== IMAGE PROCESSING UTILITIES ==================
class ImageProcessingUtils {
    // ================== CANVAS UTILITIES ==================
    static createCanvasFromImage(image, maxWidth = null, maxHeight = null) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let { width, height } = image;
        
        // Resize if max dimensions specified
        if (maxWidth || maxHeight) {
            const scale = Math.min(
                maxWidth ? maxWidth / width : 1,
                maxHeight ? maxHeight / height : 1,
                1 // Don't upscale
            );
            
            width *= scale;
            height *= scale;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(image, 0, 0, width, height);
        
        return canvas;
    }
    
    static async canvasToBlob(canvas, format = 'image/png', quality = 0.95) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to convert canvas to blob'));
                }
            }, format, quality);
        });
    }
    
    static async imageToCanvas(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = this.createCanvasFromImage(img);
                resolve(canvas);
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            if (typeof imageSrc === 'string') {
                img.crossOrigin = 'anonymous';
                img.src = imageSrc;
            } else if (imageSrc instanceof Blob) {
                img.src = URL.createObjectURL(imageSrc);
                img.onload = () => {
                    URL.revokeObjectURL(img.src);
                    const canvas = this.createCanvasFromImage(img);
                    resolve(canvas);
                };
            }
        });
    }
    
    // ================== FORMAT CONVERSION ==================
    static async convertImageFormat(blob, targetFormat, quality = 0.95) {
        try {
            // Load image from blob
            const img = await this.loadImageFromBlob(blob);
            
            // Create canvas
            const canvas = this.createCanvasFromImage(img);
            
            // Convert to target format
            const mimeType = FileUtils.mimeTypeMap[targetFormat.toLowerCase()] || 'image/png';
            
            return this.canvasToBlob(canvas, mimeType, quality);
            
        } catch (error) {
            throw new Error(`Format conversion failed: ${error.message}`);
        }
    }
    
    static async loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image from blob'));
            };
            
            img.src = url;
        });
    }
    
    // ================== IMAGE ANALYSIS ==================
    static async analyzeImageQuality(imageData) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let img;
            if (typeof imageData === 'string') {
                img = await this.loadImageFromUrl(imageData);
            } else if (imageData instanceof Blob) {
                img = await this.loadImageFromBlob(imageData);
            } else {
                throw new Error('Unsupported image data type');
            }
            
            // Sample small area for analysis
            const sampleSize = Math.min(100, img.width, img.height);
            canvas.width = sampleSize;
            canvas.height = sampleSize;
            
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
            
            const imageDataArray = ctx.getImageData(0, 0, sampleSize, sampleSize);
            const pixels = imageDataArray.data;
            
            // Analyze image characteristics
            const analysis = {
                brightness: this.calculateBrightness(pixels),
                contrast: this.calculateContrast(pixels),
                saturation: this.calculateSaturation(pixels),
                sharpness: this.estimateSharpness(pixels, sampleSize),
                noise: this.estimateNoise(pixels),
                compression: this.estimateCompression(pixels)
            };
            
            // Calculate overall quality score
            analysis.qualityScore = this.calculateQualityScore(analysis);
            
            return analysis;
            
        } catch (error) {
            return {
                error: error.message,
                qualityScore: 50 // Default score
            };
        }
    }
    
    static async loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            
            img.src = url;
        });
    }
    
    static calculateBrightness(pixels) {
        let total = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            total += (r + g + b) / 3;
        }
        return total / (pixels.length / 4);
    }
    
    static calculateContrast(pixels) {
        const brightness = this.calculateBrightness(pixels);
        let variance = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const pixelBrightness = (r + g + b) / 3;
            variance += Math.pow(pixelBrightness - brightness, 2);
        }
        
        return Math.sqrt(variance / (pixels.length / 4));
    }
    
    static calculateSaturation(pixels) {
        let totalSaturation = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i] / 255;
            const g = pixels[i + 1] / 255;
            const b = pixels[i + 2] / 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            
            totalSaturation += saturation;
        }
        
        return totalSaturation / (pixels.length / 4);
    }
    
    static estimateSharpness(pixels, width) {
        let sharpness = 0;
        
        // Simple edge detection using Sobel-like filter
        for (let y = 1; y < width - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                
                const gx = 
                    -pixels[i - width * 4 - 4] + pixels[i - width * 4 + 4] +
                    -2 * pixels[i - 4] + 2 * pixels[i + 4] +
                    -pixels[i + width * 4 - 4] + pixels[i + width * 4 + 4];
                
                const gy = 
                    -pixels[i - width * 4 - 4] - 2 * pixels[i - width * 4] - pixels[i - width * 4 + 4] +
                    pixels[i + width * 4 - 4] + 2 * pixels[i + width * 4] + pixels[i + width * 4 + 4];
                
                sharpness += Math.sqrt(gx * gx + gy * gy);
            }
        }
        
        return sharpness / ((width - 2) * (width - 2));
    }
    
    static estimateNoise(pixels) {
        let noise = 0;
        const sampleSize = Math.min(1000, pixels.length / 4);
        
        for (let i = 0; i < sampleSize; i++) {
            const idx = i * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            
            // Simple noise estimation based on color variation
            const avg = (r + g + b) / 3;
            noise += Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
        }
        
        return noise / sampleSize / 3;
    }
    
    static estimateCompression(pixels) {
        // Detect compression artifacts by analyzing color gradients
        let artifacts = 0;
        const threshold = 20;
        
        for (let i = 0; i < pixels.length - 4; i += 4) {
            const r1 = pixels[i], g1 = pixels[i + 1], b1 = pixels[i + 2];
            const r2 = pixels[i + 4], g2 = pixels[i + 5], b2 = pixels[i + 6];
            
            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            if (diff > threshold) {
                artifacts++;
            }
        }
        
        return artifacts / (pixels.length / 4);
    }
    
    static calculateQualityScore(analysis) {
        let score = 50; // Base score
        
        // Brightness (optimal range: 100-200)
        const brightness = analysis.brightness;
        if (brightness >= 100 && brightness <= 200) {
            score += 10;
        } else {
            score -= Math.abs(brightness - 150) / 15;
        }
        
        // Contrast (higher is generally better)
        score += Math.min(analysis.contrast / 5, 15);
        
        // Saturation (moderate levels preferred)
        const saturation = analysis.saturation * 100;
        if (saturation >= 20 && saturation <= 70) {
            score += 10;
        } else {
            score -= Math.abs(saturation - 45) / 10;
        }
        
        // Sharpness (higher is better)
        score += Math.min(analysis.sharpness / 10, 15);
        
        // Noise (lower is better)
        score -= analysis.noise / 5;
        
        // Compression artifacts (lower is better)
        score -= analysis.compression / 100;
        
        return Math.max(0, Math.min(100, score));
    }
}

// ================== STORAGE UTILITIES ==================
class StorageUtils {
    // ================== CHROME STORAGE HELPERS ==================
    static async get(keys) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(keys, resolve);
        });
    }
    
    static async set(data) {
        return new Promise((resolve) => {
            chrome.storage.sync.set(data, resolve);
        });
    }
    
    static async remove(keys) {
        return new Promise((resolve) => {
            chrome.storage.sync.remove(keys, resolve);
        });
    }
    
    static async clear() {
        return new Promise((resolve) => {
            chrome.storage.sync.clear(resolve);
        });
    }
    
    // ================== SETTINGS MANAGEMENT ==================
    static async saveSettings(settings) {
        const timestamp = Date.now();
        const settingsWithMetadata = {
            ...settings,
            _savedAt: timestamp,
            _version: chrome.runtime.getManifest().version
        };
        
        await this.set({ settings: settingsWithMetadata });
        return timestamp;
    }
    
    static async loadSettings(defaults = {}) {
        const stored = await this.get(['settings']);
        return { ...defaults, ...stored.settings };
    }
    
    static async exportSettings() {
        const settings = await this.get(null); // Get all stored data
        const exportData = {
            exportedAt: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
            data: settings
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    static async importSettings(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            
            if (!importData.data) {
                throw new Error('Invalid import data format');
            }
            
            // Validate version compatibility
            const currentVersion = chrome.runtime.getManifest().version;
            if (importData.version && importData.version !== currentVersion) {
                console.warn(`Version mismatch: ${importData.version} vs ${currentVersion}`);
            }
            
            await this.set(importData.data);
            return true;
            
        } catch (error) {
            throw new Error(`Import failed: ${error.message}`);
        }
    }
}

// ================== PERFORMANCE UTILITIES ==================
class PerformanceUtils {
    static createTimer(label) {
        const startTime = performance.now();
        
        return {
            mark: (milestone) => {
                const currentTime = performance.now();
                console.log(`⏱️ ${label} - ${milestone}: ${(currentTime - startTime).toFixed(2)}ms`);
                return currentTime - startTime;
            },
            
            end: () => {
                const endTime = performance.now();
                const totalTime = endTime - startTime;
                console.log(`✅ ${label} completed: ${totalTime.toFixed(2)}ms`);
                return totalTime;
            }
        };
    }
    
    static throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
    
    static debounce(func, delay) {
        let timeoutId;
        
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    static async measureAsync(label, asyncFunc) {
        const timer = this.createTimer(label);
        try {
            const result = await asyncFunc();
            timer.end();
            return result;
        } catch (error) {
            timer.end();
            throw error;
        }
    }
}

// ================== EXPORT FOR GLOBAL ACCESS ==================
if (typeof window !== 'undefined') {
    window.FileUtils = FileUtils;
    window.UrlUtils = UrlUtils;
    window.ImageProcessingUtils = ImageProcessingUtils;
    window.StorageUtils = StorageUtils;
    window.PerformanceUtils = PerformanceUtils;
}