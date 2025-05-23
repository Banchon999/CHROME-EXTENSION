/**
 * Advanced Image Downloader Pro - Site Pattern Recognition
 * ระบบจดจำรูปแบบเว็บไซต์และปรับแต่งการสแกนให้เหมาะสม
 */

class SitePatternManager {
    constructor() {
        this.patterns = this.initializePatterns();
        this.currentSite = null;
        this.detectedPatterns = [];
    }
    
    // ================== PATTERN INITIALIZATION ==================
    initializePatterns() {
        return {
            // ==================== WEBTOON PATTERNS ====================
            webtoon: {
                name: 'Webtoon Sites',
                domains: [
                    'webtoons.com', 'tapas.io', 'webcomics.com', 'mangadex.org',
                    'mangakakalot.com', 'manganelo.com', 'mangapark.net',
                    'manhwa18.net', 'toomics.com', 'lezhin.com'
                ],
                selectors: {
                    images: [
                        'img[data-url]', 'img[data-src]', 'img.episode_img',
                        '.viewer img', '.comic-container img', '.chapter-content img',
                        'img[src*="episode"]', 'img[src*="chapter"]', 'img[src*="page"]'
                    ],
                    nextPage: [
                        '.paginate_next', '.next-chapter', '.next', 'a[rel="next"]',
                        '.episode_next', '.chapter-next-btn', '[data-next]',
                        'a[href*="episode"]', 'a[href*="chapter"]'
                    ],
                    pagination: [
                        '.pagination a', '.episode-list a', '.chapter-list a',
                        'select[name="episode"] option', 'select[name="chapter"] option'
                    ]
                },
                characteristics: {
                    hasInfiniteScroll: true,
                    hasLazyLoading: true,
                    requiresScroll: true,
                    hasSequentialPages: true
                }
            },
            
            // ==================== GALLERY PATTERNS ====================
            gallery: {
                name: 'Image Gallery Sites',
                domains: [
                    'imgur.com', 'flickr.com', 'deviantart.com', 'artstation.com',
                    'pinterest.com', '500px.com', 'pixiv.net', 'gelbooru.com',
                    'danbooru.donmai.us', 'safebooru.org', 'rule34.xxx'
                ],
                selectors: {
                    images: [
                        '.gallery-image img', '.post-image img', '.artwork img',
                        'img[data-original]', 'img[data-large-file-url]',
                        '.content img', '.image-container img', '.post img'
                    ],
                    nextPage: [
                        '.next', '.pagination-next', 'a[rel="next"]',
                        '.load-more', '.show-more', '[data-next-page]'
                    ],
                    pagination: [
                        '.pagination a', '.paginator a', '.page-link'
                    ]
                },
                characteristics: {
                    hasInfiniteScroll: true,
                    hasLazyLoading: true,
                    hasGrid: true,
                    hasModal: true
                }
            },
            
            // ==================== SOCIAL MEDIA PATTERNS ====================
            social: {
                name: 'Social Media Sites',
                domains: [
                    'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
                    'reddit.com', 'tumblr.com', 'tiktok.com'
                ],
                selectors: {
                    images: [
                        'img[src*="pbs.twimg.com"]', 'img[src*="cdninstagram.com"]',
                        'img[src*="fbcdn.net"]', 'img[src*="redd.it"]',
                        '.media img', '.post-image img', '.content img'
                    ],
                    nextPage: [
                        '[data-testid="cellInnerDiv"]', '.stream-item',
                        '.post', '.feed-item'
                    ]
                },
                characteristics: {
                    hasInfiniteScroll: true,
                    dynamicContent: true,
                    requiresInteraction: true
                }
            },
            
            // ==================== E-COMMERCE PATTERNS ====================
            ecommerce: {
                name: 'E-commerce Sites',
                domains: [
                    'amazon.com', 'ebay.com', 'aliexpress.com', 'shopee.com',
                    'lazada.com', 'etsy.com', 'alibaba.com'
                ],
                selectors: {
                    images: [
                        '.product-image img', '.item-photo img', '.gallery img',
                        'img[data-zoom-image]', 'img[data-large]',
                        '.product-gallery img', '.slider img'
                    ],
                    nextPage: [
                        '.next', '.pagination-next', 'a[aria-label="Next"]'
                    ]
                },
                characteristics: {
                    hasProductGallery: true,
                    hasZoomImages: true,
                    hasVariants: true
                }
            },
            
            // ==================== NEWS/BLOG PATTERNS ====================
            news: {
                name: 'News & Blog Sites',
                domains: [
                    'medium.com', 'wordpress.com', 'blogger.com', 'substack.com',
                    'cnn.com', 'bbc.com', 'reuters.com'
                ],
                selectors: {
                    images: [
                        '.article img', '.post-content img', '.entry-content img',
                        '.story-image img', '.featured-image img'
                    ],
                    nextPage: [
                        '.next-post', '.pagination-next', 'a[rel="next"]'
                    ]
                },
                characteristics: {
                    hasArticleImages: true,
                    hasFeaturedImages: true
                }
            },
            
            // ==================== GENERIC FALLBACK PATTERNS ====================
            generic: {
                name: 'Generic Website',
                domains: ['*'],
                selectors: {
                    images: [
                        'img[src]', 'img[data-src]', 'img[data-original]',
                        'img[data-lazy]', 'img[data-srcset]', 'picture img',
                        'figure img', '.image img', '.photo img'
                    ],
                    nextPage: [
                        '.next', '.pagination-next', 'a[rel="next"]',
                        '[aria-label*="next"]', '[title*="next"]',
                        'a[href*="page"]', 'a[href*="p="]'
                    ],
                    pagination: [
                        '.pagination a', '.pager a', '.page-numbers a',
                        '.nav-links a', '.pageNav a'
                    ]
                },
                characteristics: {
                    universal: true
                }
            }
        };
    }
    
    // ================== SITE DETECTION ==================
    detectSiteType(url = window.location.href) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            this.currentSite = { url, domain };
            
            // Check against known patterns
            for (const [patternKey, pattern] of Object.entries(this.patterns)) {
                if (pattern.domains.includes('*')) continue; // Skip generic
                
                const isMatch = pattern.domains.some(patternDomain => 
                    domain.includes(patternDomain) || patternDomain.includes(domain)
                );
                
                if (isMatch) {
                    this.detectedPatterns.unshift(patternKey);
                    return { type: patternKey, pattern, confidence: 1.0 };
                }
            }
            
            // Advanced pattern detection based on DOM structure
            const domBasedType = this.detectByDOMStructure();
            if (domBasedType) {
                return domBasedType;
            }
            
            // Fallback to generic
            return { 
                type: 'generic', 
                pattern: this.patterns.generic, 
                confidence: 0.5 
            };
            
        } catch (error) {
            console.error('Site detection error:', error);
            return { 
                type: 'generic', 
                pattern: this.patterns.generic, 
                confidence: 0.1 
            };
        }
    }
    
    detectByDOMStructure() {
        const indicators = {
            webtoon: [
                () => document.querySelector('.episode, .chapter, .comic-container'),
                () => document.querySelectorAll('img[src*="episode"], img[src*="chapter"]').length > 3,
                () => document.querySelector('.webtoon, .manhwa, .manga')
            ],
            gallery: [
                () => document.querySelector('.gallery, .grid, .masonry'),
                () => document.querySelectorAll('.thumbnail, .preview').length > 5,
                () => document.querySelector('.lightbox, .modal, .overlay')
            ],
            social: [
                () => document.querySelector('.feed, .timeline, .stream'),
                () => document.querySelector('.post, .tweet, .status'),
                () => document.querySelector('[data-testid], [data-react-]')
            ],
            ecommerce: [
                () => document.querySelector('.product, .item, .listing'),
                () => document.querySelector('.price, .cart, .buy'),
                () => document.querySelector('.gallery, .zoom, .variant')
            ]
        };
        
        for (const [type, checks] of Object.entries(indicators)) {
            const matches = checks.filter(check => {
                try {
                    return check();
                } catch {
                    return false;
                }
            }).length;
            
            if (matches >= 2) {
                this.detectedPatterns.unshift(type);
                return { 
                    type, 
                    pattern: this.patterns[type], 
                    confidence: matches / checks.length 
                };
            }
        }
        
        return null;
    }
    
    // ================== SELECTOR OPTIMIZATION ==================
    getOptimizedSelectors(patternType = null) {
        const siteType = patternType || this.detectedPatterns[0] || 'generic';
        const pattern = this.patterns[siteType];
        
        if (!pattern) {
            return this.patterns.generic.selectors;
        }
        
        // Merge with generic selectors for better coverage
        const optimized = {
            images: [
                ...pattern.selectors.images,
                ...this.patterns.generic.selectors.images
            ],
            nextPage: [
                ...pattern.selectors.nextPage,
                ...this.patterns.generic.selectors.nextPage
            ],
            pagination: [
                ...(pattern.selectors.pagination || []),
                ...this.patterns.generic.selectors.pagination
            ]
        };
        
        // Remove duplicates
        Object.keys(optimized).forEach(key => {
            optimized[key] = [...new Set(optimized[key])];
        });
        
        return optimized;
    }
    
    // ================== CUSTOM PATTERN HANDLING ==================
    addCustomPattern(selector, type = 'images') {
        if (!selector || typeof selector !== 'string') return;
        
        const customKey = 'custom';
        if (!this.patterns[customKey]) {
            this.patterns[customKey] = {
                name: 'Custom Patterns',
                domains: ['*'],
                selectors: { images: [], nextPage: [], pagination: [] },
                characteristics: { custom: true }
            };
        }
        
        if (!this.patterns[customKey].selectors[type]) {
            this.patterns[customKey].selectors[type] = [];
        }
        
        // Add custom selector
        this.patterns[customKey].selectors[type].unshift(selector);
        
        // Move custom to front of detection queue
        this.detectedPatterns = this.detectedPatterns.filter(p => p !== customKey);
        this.detectedPatterns.unshift(customKey);
    }
    
    parseCustomPatterns(patternsText) {
        if (!patternsText || typeof patternsText !== 'string') return;
        
        const lines = patternsText.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#')) return; // Skip comments
            
            // Parse format: "type:selector" or just "selector" (defaults to images)
            const colonIndex = trimmed.indexOf(':');
            let type = 'images';
            let selector = trimmed;
            
            if (colonIndex > 0) {
                type = trimmed.substring(0, colonIndex).trim();
                selector = trimmed.substring(colonIndex + 1).trim();
            }
            
            if (selector) {
                this.addCustomPattern(selector, type);
            }
        });
    }
    
    // ================== SITE CHARACTERISTICS ==================
    getSiteCharacteristics(patternType = null) {
        const siteType = patternType || this.detectedPatterns[0] || 'generic';
        const pattern = this.patterns[siteType];
        
        return {
            hasInfiniteScroll: pattern?.characteristics?.hasInfiniteScroll || false,
            hasLazyLoading: pattern?.characteristics?.hasLazyLoading || false,
            requiresScroll: pattern?.characteristics?.requiresScroll || false,
            hasSequentialPages: pattern?.characteristics?.hasSequentialPages || false,
            dynamicContent: pattern?.characteristics?.dynamicContent || false,
            requiresInteraction: pattern?.characteristics?.requiresInteraction || false,
            hasGrid: pattern?.characteristics?.hasGrid || false,
            hasModal: pattern?.characteristics?.hasModal || false,
            ...pattern?.characteristics
        };
    }
    
    // ================== UTILITY METHODS ==================
    isWebtoonSite() {
        return this.detectedPatterns.includes('webtoon');
    }
    
    isGallerySite() {
        return this.detectedPatterns.includes('gallery');
    }
    
    isSocialSite() {
        return this.detectedPatterns.includes('social');
    }
    
    supportsDeepScanning() {
        const characteristics = this.getSiteCharacteristics();
        return characteristics.hasSequentialPages || 
               characteristics.hasInfiniteScroll || 
               characteristics.hasGrid;
    }
    
    needsSpecialHandling() {
        const characteristics = this.getSiteCharacteristics();
        return characteristics.dynamicContent || 
               characteristics.requiresInteraction ||
               characteristics.hasLazyLoading;
    }
    
    // ================== DEBUG & LOGGING ==================
    getDetectionInfo() {
        return {
            currentSite: this.currentSite,
            detectedPatterns: this.detectedPatterns,
            primaryPattern: this.detectedPatterns[0] || 'generic',
            characteristics: this.getSiteCharacteristics(),
            selectors: this.getOptimizedSelectors()
        };
    }
    
    logDetectionResults() {
        const info = this.getDetectionInfo();
        console.group('🎯 Site Pattern Detection Results');
        console.log('Domain:', info.currentSite?.domain);
        console.log('Detected Patterns:', info.detectedPatterns);
        console.log('Primary Pattern:', info.primaryPattern);
        console.log('Characteristics:', info.characteristics);
        console.log('Image Selectors:', info.selectors.images);
        console.log('Next Page Selectors:', info.selectors.nextPage);
        console.groupEnd();
        
        return info;
    }
}

// ================== GLOBAL INSTANCE ==================
window.sitePatternManager = new SitePatternManager();

// Auto-detect on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sitePatternManager.detectSiteType();
    });
} else {
    window.sitePatternManager.detectSiteType();
}