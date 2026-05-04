// Simple default location (Dhaka, Bangladesh)
const DEFAULT_LOCATION = {
    latitude: 23.8103,
    longitude: 90.4125,
    city: 'Dhaka',
    country: 'Bangladesh',
    accuracy: 50000,
};

// Cache configuration
const CACHE_CONFIG = {
    WEATHER_TTL: 10 * 60 * 1000, // 10 minutes for weather data
    LOCATION_TTL: 60 * 60 * 1000, // 1 hour for location data
    AIR_POLLUTION_TTL: 15 * 60 * 1000, // 15 minutes for air pollution
    MAX_CACHE_SIZE: 50, // Maximum number of cached entries
};

// In-memory cache class
class WeatherCache {
    cache: Map<string, any>;
    accessTimes: Map<string, number>;

    constructor() {
        this.cache = new Map();
        this.accessTimes = new Map();
    }

    // Generate cache key
    generateKey(type: string, lat: number, lon: number) {
        // Round coordinates to reduce cache fragmentation
        const roundedLat = Math.round(lat * 100) / 100;
        const roundedLon = Math.round(lon * 100) / 100;
        return `${type}_${roundedLat}_${roundedLon}`;
    }

    // Check if cache entry is valid
    isValid(entry: any, ttl: number) {
        return entry && Date.now() - entry.timestamp < ttl;
    }

    // Get from cache
    get(type: string, lat: number, lon: number, ttl: number) {
        const key = this.generateKey(type, lat, lon);
        const entry = this.cache.get(key);

        if (this.isValid(entry, ttl)) {
            // Update access time for LRU
            this.accessTimes.set(key, Date.now());
            return entry.data;
        }

        // Remove expired entry
        if (entry) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
        }

        return null;
    }

    // Set cache entry
    set(type: string, lat: number, lon: number, data: any) {
        const key = this.generateKey(type, lat, lon);

        // Implement LRU eviction if cache is full
        if (this.cache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
            this.evictOldest();
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
        this.accessTimes.set(key, Date.now());
    }

    // Evict oldest accessed entry (LRU)
    evictOldest() {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [key, accessTime] of this.accessTimes) {
            if (accessTime < oldestTime) {
                oldestTime = accessTime;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
        }
    }

    // Clear expired entries
    clearExpired() {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache) {
            const [type] = key.split('_');
            let ttl = CACHE_CONFIG.WEATHER_TTL;

            if (type === 'location') ttl = CACHE_CONFIG.LOCATION_TTL;
            else if (type === 'airpollution')
                ttl = CACHE_CONFIG.AIR_POLLUTION_TTL;

            if (now - entry.timestamp > ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => {
            this.cache.delete(key);
            this.accessTimes.delete(key);
        });
    }

    // Get cache stats
    getStats() {
        return {
            size: this.cache.size,
            maxSize: CACHE_CONFIG.MAX_CACHE_SIZE,
            entries: Array.from(this.cache.keys()),
        };
    }

    // Clear all cache
    clear() {
        this.cache.clear();
        this.accessTimes.clear();
    }
}

// Global cache instance
const weatherCache = new WeatherCache();

// Periodic cleanup of expired cache entries
if (typeof window !== 'undefined') {
    setInterval(() => {
        weatherCache.clearExpired();
    }, 5 * 60 * 1000); // Clean every 5 minutes
}

// Rate limiter class
class RateLimiter {
    maxRequests: number;
    windowMs: number;
    requests: Map<string, number[]>;

    constructor(maxRequests = 60, windowMs = 60 * 1000) {
        // 60 requests per minute
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }

    canMakeRequest(key = 'default') {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or create request history for this key
        let requestTimes = this.requests.get(key) || [];

        // Filter out old requests outside the window
        requestTimes = requestTimes.filter(time => time > windowStart);

        // Check if under limit
        if (requestTimes.length < this.maxRequests) {
            requestTimes.push(now);
            this.requests.set(key, requestTimes);
            return true;
        }

        return false;
    }

    getTimeUntilReset(key = 'default') {
        const requestTimes = this.requests.get(key) || [];
        if (requestTimes.length === 0) return 0;

        const oldestRequest = Math.min(...requestTimes);
        const timeUntilReset = this.windowMs - (Date.now() - oldestRequest);
        return Math.max(0, timeUntilReset);
    }
}

// Global rate limiter
const rateLimiter = new RateLimiter(60, 60 * 1000); // 60 requests per minute

// Enhanced get weather information with caching
export async function getWeatherInfo(lat: number, lon: number, forceRefresh = false) {
    try {
        // Check cache first (unless forced refresh)
        if (!forceRefresh) {
            const cachedData = weatherCache.get(
                'weather',
                lat,
                lon,
                CACHE_CONFIG.WEATHER_TTL
            );
            if (cachedData) {
                return cachedData;
            }
        }

        // Check rate limit
        if (!rateLimiter.canMakeRequest('weather')) {
            const waitTime = rateLimiter.getTimeUntilReset('weather');
            
            // Return cached data even if expired as fallback
            const expiredCache = weatherCache.get(
                'weather',
                lat,
                lon,
                Infinity
            );
            if (expiredCache) {
                return expiredCache;
            }

            throw new Error(
                `Rate limit exceeded. Please wait ${Math.ceil(
                    waitTime / 1000
                )} seconds.`
            );
        }

        const apiKey = process.env.NEXT_PUBLIC_OPEN_WEATHER_API_KEY;
        if (!apiKey) {
            throw new Error('OpenWeather API key is not configured');
        }

        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
        );

        if (!res.ok) {
            throw new Error(
                `Weather API error: ${res.status} ${res.statusText}`
            );
        }

        const data = await res.json();

        // Cache the result
        weatherCache.set('weather', lat, lon, data);

        return data;
    } catch (error) {
        // Try to return cached data as fallback
        const fallbackData = weatherCache.get('weather', lat, lon, Infinity);
        if (fallbackData) {
            return fallbackData;
        }

        throw error;
    }
}

// Enhanced get air pollution information with caching
export async function getAirPollutionInfo(lat: number, lon: number, forceRefresh = false) {
    try {
        // Check cache first
        if (!forceRefresh) {
            const cachedData = weatherCache.get(
                'airpollution',
                lat,
                lon,
                CACHE_CONFIG.AIR_POLLUTION_TTL
            );
            if (cachedData) {
                return cachedData;
            }
        }

        // Check rate limit
        if (!rateLimiter.canMakeRequest('airpollution')) {
            const waitTime = rateLimiter.getTimeUntilReset('airpollution');

            const expiredCache = weatherCache.get(
                'airpollution',
                lat,
                lon,
                Infinity
            );
            if (expiredCache) {
                return expiredCache;
            }

            throw new Error(
                `Rate limit exceeded. Please wait ${Math.ceil(
                    waitTime / 1000
                )} seconds.`
            );
        }

        const apiKey = process.env.NEXT_PUBLIC_OPEN_WEATHER_API_KEY;
        if (!apiKey) {
            throw new Error('OpenWeather API key is not configured');
        }

        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
        );

        if (!res.ok) {
            throw new Error(
                `Air pollution API error: ${res.status} ${res.statusText}`
            );
        }

        const data = await res.json();
        weatherCache.set('airpollution', lat, lon, data);

        return data;
    } catch (error) {
        const fallbackData = weatherCache.get(
            'airpollution',
            lat,
            lon,
            Infinity
        );
        if (fallbackData) {
            return fallbackData;
        }

        throw error;
    }
}

// Enhanced get location information with caching
export async function getLocationInfo(lat: number, lon: number, forceRefresh = false) {
    try {
        // Check cache first
        if (!forceRefresh) {
            const cachedData = weatherCache.get(
                'location',
                lat,
                lon,
                CACHE_CONFIG.LOCATION_TTL
            );
            if (cachedData) {
                return cachedData;
            }
        }

        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
        );

        if (!res.ok) {
            throw new Error(
                `Geocoding API error: ${res.status} ${res.statusText}`
            );
        }

        const data = await res.json();
        weatherCache.set('location', lat, lon, data);

        return data;
    } catch (error) {
        const fallbackData = weatherCache.get('location', lat, lon, Infinity);
        if (fallbackData) {
            return fallbackData;
        }

        // Return default location info if geocoding fails
        return {
            city: DEFAULT_LOCATION.city,
            countryName: DEFAULT_LOCATION.country,
            locality: DEFAULT_LOCATION.city,
        };
    }
}

// Get user's current location using browser geolocation API
function getCurrentPosition(options: PositionOptions = {}): Promise<{latitude: number, longitude: number, accuracy: number}> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        const defaultOptions: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds timeout
            maximumAge: 300000, // 5 minutes cache
            ...options,
        };

        navigator.geolocation.getCurrentPosition(
            position => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
            },
            error => {
                let errorMessage = 'Unknown geolocation error';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage =
                            'User denied the request for Geolocation';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage =
                            'The request to get user location timed out';
                        break;
                }
                reject(new Error(errorMessage));
            },
            defaultOptions
        );
    });
}

// Get user location from IP address as fallback
async function getLocationFromIP() {
    try {
        // Using ipapi.co (free tier: 1000 requests/day)
        const res = await fetch('https://ipapi.co/json/');

        if (!res.ok) {
            throw new Error(
                `IP geolocation API error: ${res.status} ${res.statusText}`
            );
        }

        const data = await res.json();

        if (data.error) {
            throw new Error(`IP geolocation error: ${data.reason}`);
        }

        return {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            city: data.city,
            country: data.country_name,
            accuracy: 10000, // IP-based location is less accurate
        };
    } catch (error) {
        // Try alternative IP geolocation service
        try {
            const res = await fetch(
                'https://api.bigdatacloud.net/data/client-ip'
            );

            if (!res.ok) {
                throw new Error(
                    `Alternative IP API error: ${res.status} ${res.statusText}`
                );
            }

            const data = await res.json();

            return {
                latitude: parseFloat(data.location.latitude),
                longitude: parseFloat(data.location.longitude),
                city: data.location.city,
                country: data.location.countryName,
                accuracy: 15000,
            };
        } catch (altError) {
            throw error; // Throw original error
        }
    }
}

// Enhanced function to get user's location with fallbacks
async function getUserLocation() {
    let locationSource = 'default';
    let coordinates = DEFAULT_LOCATION;

    try {
        // First, try browser geolocation
        const browserLocation = await getCurrentPosition();

        coordinates = {
            latitude: browserLocation.latitude,
            longitude: browserLocation.longitude,
            accuracy: browserLocation.accuracy,
            city: '',
            country: '',
        };
        locationSource = 'browser';
    } catch (browserError) {
        try {
            // Fallback to IP-based location
            const ipLocation = await getLocationFromIP();

            coordinates = {
                latitude: ipLocation.latitude,
                longitude: ipLocation.longitude,
                accuracy: ipLocation.accuracy,
                city: ipLocation.city || '',
                country: ipLocation.country || '',
            };
            locationSource = 'ip';
        } catch (ipError) {
            locationSource = 'default';
        }
    }

    return { coordinates, locationSource };
}

// Enhanced function to get weather data using location with fallbacks and caching
export async function getCurrentLocationWeather(forceRefresh = false) {
    try {
        const { coordinates, locationSource } = await getUserLocation();

        const [weather, airPollution, locationInfo] = await Promise.all([
            getWeatherInfo(
                coordinates.latitude,
                coordinates.longitude,
                forceRefresh
            ),
            getAirPollutionInfo(
                coordinates.latitude,
                coordinates.longitude,
                forceRefresh
            ),
            getLocationInfo(
                coordinates.latitude,
                coordinates.longitude,
                forceRefresh
            ),
        ]);

        return {
            location: locationInfo,
            weather,
            airPollution,
            coordinates: {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                accuracy: coordinates.accuracy,
            },
            locationSource,
            success: true,
            cached: !forceRefresh, // Indicate if data might be cached
        };
    } catch (error) {
        throw error;
    }
}

// Function to check if geolocation is supported and get permission status
export async function checkGeolocationSupport() {
    const result: {supported: boolean, permission: string, error: string | null} = {
        supported: false,
        permission: 'unknown',
        error: null,
    };

    try {
        if (!navigator.geolocation) {
            result.error = 'Geolocation is not supported by this browser';
            return result;
        }

        result.supported = true;

        // Check permission status if available
        if (navigator.permissions) {
            try {
                const permission = await navigator.permissions.query({
                    name: 'geolocation' as PermissionName,
                });
                result.permission = permission.state; // 'granted', 'denied', or 'prompt'
            } catch (permError) {}
        }

        return result;
    } catch (error: any) {
        result.error = error.message;
        return result;
    }
}

// Enhanced function to get weather data using only default location with caching
export async function getDefaultLocationWeather(forceRefresh = false) {
    try {
        const [weather, airPollution, locationInfo] = await Promise.all([
            getWeatherInfo(
                DEFAULT_LOCATION.latitude,
                DEFAULT_LOCATION.longitude,
                forceRefresh
            ),
            getAirPollutionInfo(
                DEFAULT_LOCATION.latitude,
                DEFAULT_LOCATION.longitude,
                forceRefresh
            ),
            getLocationInfo(
                DEFAULT_LOCATION.latitude,
                DEFAULT_LOCATION.longitude,
                forceRefresh
            ),
        ]);

        return {
            location: locationInfo,
            weather,
            airPollution,
            coordinates: {
                latitude: DEFAULT_LOCATION.latitude,
                longitude: DEFAULT_LOCATION.longitude,
                accuracy: DEFAULT_LOCATION.accuracy,
            },
            locationSource: 'default',
            success: true,
            cached: !forceRefresh,
        };
    } catch (error) {
        throw error;
    }
}

// Utility functions for cache management
export const cacheUtils = {
    // Clear all cached data
    clearCache: () => {
        weatherCache.clear();
    },

    // Get cache statistics
    getCacheStats: () => {
        return weatherCache.getStats();
    },

    // Force refresh data (bypasses cache)
    refreshWeatherData: async () => {
        return await getCurrentLocationWeather(true);
    },

    // Preload weather data for common locations
    preloadData: async (locations = [DEFAULT_LOCATION]) => {
        const promises = locations.map(async ({ latitude, longitude }) => {
            try {
                await Promise.all([
                    getWeatherInfo(latitude, longitude),
                    getAirPollutionInfo(latitude, longitude),
                    getLocationInfo(latitude, longitude),
                ]);
            } catch (error) {}
        });

        await Promise.allSettled(promises);
    },
};
