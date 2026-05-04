'use client';
import { getCurrentLocationWeather } from '@/utils/weather';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface WeatherSlideProps {
    loggedInUser: any;
}

const WeatherSlide = ({ loggedInUser }: WeatherSlideProps) => {
    const [weatherData, setWeatherData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const mountedRef = useRef(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchWeatherData = async (forceRefresh = false) => {
        try {
            if (forceRefresh) {
                setIsRefreshing(true);
            } else {
                setLoading(true);
            }

            const currentWeather = await getCurrentLocationWeather(forceRefresh);

            // Only update state if component is still mounted
            if (mountedRef.current) {
                setWeatherData(currentWeather);
                setError(null);
            }
        } catch (error: any) {
            if (mountedRef.current) {
                setError(error.message);

                // If it's a rate limit error, schedule a retry
                if (error.message.includes('Rate limit')) {
                    const retryIn = 5 * 60 * 1000; // Retry in 5 minutes

                    retryTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            fetchWeatherData();
                        }
                    }, retryIn);
                }
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    };

    useEffect(() => {
        mountedRef.current = true;

        // Initial fetch
        fetchWeatherData();

        // Set up periodic refresh (every 10 minutes)
        intervalRef.current = setInterval(
            () => {
                if (mountedRef.current) {
                    fetchWeatherData(true); // Force refresh on interval
                }
            },
            10 * 60 * 1000
        ); // 10 minutes

        // Cleanup function
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    // Manual refresh function (could be triggered by user interaction)
    const handleManualRefresh = async () => {
        if (isRefreshing || loading) return;
        await fetchWeatherData(true);
    };

    const getCurrentDate = () => {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        return now.toLocaleDateString('en-US', options);
    };

    const getWeatherSlide = () => {
        if (loading) return 'Loading weather...';
        if (isRefreshing) return 'Refreshing weather...';
        if (error) {
            // Show different messages based on error type
            if (error.includes('Rate limit')) {
                return 'Weather rate limited';
            } else if (error.includes('API key')) {
                return 'Weather config error';
            } else {
                return 'Weather unavailable';
            }
        }
        if (!weatherData) return 'No weather data';

        const temp = Math.round(weatherData.weather.main.temp);
        const location =
            weatherData.location.city ||
            weatherData.location.locality ||
            'Unknown location';
        const country =
            weatherData.location.countryCode || weatherData.location.country || '';
        const condition = weatherData.weather.weather[0]?.main || '';

        return `${temp}°C, ${condition} in ${location}${country ? ', ' + country : ''}`;
    };

    const slides = [
        `Howdy ${loggedInUser?.name?.split(' ')[0] || 'Admin'} !`,
        getCurrentDate(),
        getWeatherSlide(),
    ];

    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const slideInterval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 8000); // Change slide every 8 seconds

        return () => clearInterval(slideInterval);
    }, [slides.length]);

    // Add click handler for manual refresh (optional)
    const handleSlideClick = () => {
        if (currentSlide === 2) {
            // Weather slide
            handleManualRefresh();
        }
    };

    return (
        <div className='relative h-8 w-[250px] overflow-hidden flex items-center justify-end'>
            <AnimatePresence mode='wait'>
                <motion.h1
                    key={`${currentSlide}-${
                        weatherData?.weather?.main?.temp || 'loading'
                    }-${isRefreshing ? 'refreshing' : 'idle'}`}
                    className={`absolute text-sm font-medium text-foreground text-right tracking-wide whitespace-nowrap ${
                        currentSlide === 2
                            ? 'cursor-pointer hover:text-primary transition-colors'
                            : ''
                    } ${isRefreshing ? 'opacity-75' : ''}`}
                    onClick={handleSlideClick}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        duration: 0.3,
                    }}
                    title={
                        currentSlide === 2
                            ? `Click to refresh weather ${
                                  error ? '(Error: ' + error + ')' : ''
                              }`
                            : undefined
                    }>
                    {slides[currentSlide]}
                    {isRefreshing && currentSlide === 2 && (
                        <motion.span
                            className='inline-block ml-1'
                            animate={{ rotate: 360 }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'linear',
                            }}>
                            ↻
                        </motion.span>
                    )}
                </motion.h1>
            </AnimatePresence>
        </div>
    );
};

export default WeatherSlide;
