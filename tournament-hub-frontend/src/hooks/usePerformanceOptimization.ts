import { useCallback, useRef, useEffect, useState } from 'react';

// Debounce hook
export const useDebounce = <T>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// Throttle hook
export const useThrottle = <T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T => {
    const lastRun = useRef(Date.now());

    return useCallback(
        ((...args: any[]) => {
            if (Date.now() - lastRun.current >= delay) {
                callback(...args);
                lastRun.current = Date.now();
            }
        }) as T,
        [callback, delay]
    );
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
    elementRef: React.RefObject<Element>,
    options: IntersectionObserverInit = {}
) => {
    const [isIntersecting, setIsIntersecting] = useState(false);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsIntersecting(entry.isIntersecting);
            },
            {
                threshold: 0.1,
                rootMargin: '50px',
                ...options,
            }
        );

        observer.observe(element);

        return () => {
            observer.unobserve(element);
        };
    }, [elementRef, options]);

    return isIntersecting;
};

// Virtual scrolling hook
export const useVirtualScrolling = (
    itemCount: number,
    itemHeight: number,
    containerHeight: number,
    overscan: number = 5
) => {
    const [scrollTop, setScrollTop] = useState(0);

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        itemCount - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = Array.from(
        { length: endIndex - startIndex + 1 },
        (_, index) => startIndex + index
    );

    const totalHeight = itemCount * itemHeight;
    const offsetY = startIndex * itemHeight;

    return {
        visibleItems,
        totalHeight,
        offsetY,
        setScrollTop,
    };
};

// Memory optimization hook
export const useMemoryOptimization = () => {
    const cleanupFunctions = useRef<(() => void)[]>([]);

    const addCleanup = useCallback((cleanup: () => void) => {
        cleanupFunctions.current.push(cleanup);
    }, []);

    const cleanup = useCallback(() => {
        cleanupFunctions.current.forEach(fn => fn());
        cleanupFunctions.current = [];
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return { addCleanup, cleanup };
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
    const renderCount = useRef(0);
    const startTime = useRef(Date.now());

    useEffect(() => {
        renderCount.current += 1;
        const renderTime = Date.now() - startTime.current;

        if (process.env.NODE_ENV === 'development') {
            console.log(`${componentName} rendered ${renderCount.current} times in ${renderTime}ms`);
        }

        startTime.current = Date.now();
    });

    return {
        renderCount: renderCount.current,
        logPerformance: (operation: string, duration: number) => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`${componentName} - ${operation}: ${duration}ms`);
            }
        },
    };
};

// Optimized state updates hook
export const useOptimizedState = <T>(initialState: T) => {
    const [state, setState] = useState(initialState);
    const stateRef = useRef(state);

    const setOptimizedState = useCallback((newState: T | ((prev: T) => T)) => {
        const nextState = typeof newState === 'function'
            ? (newState as (prev: T) => T)(stateRef.current)
            : newState;

        if (nextState !== stateRef.current) {
            stateRef.current = nextState;
            setState(nextState);
        }
    }, []);

    return [state, setOptimizedState] as const;
};

// Batch updates hook
export const useBatchedUpdates = () => {
    const updates = useRef<(() => void)[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const batchUpdate = useCallback((update: () => void) => {
        updates.current.push(update);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            updates.current.forEach(update => update());
            updates.current = [];
        }, 0);
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return batchUpdate;
};

// Resource preloading hook
export const useResourcePreloader = () => {
    const preloadedResources = useRef<Set<string>>(new Set());

    const preloadImage = useCallback((src: string) => {
        if (preloadedResources.current.has(src)) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                preloadedResources.current.add(src);
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }, []);

    const preloadScript = useCallback((src: string) => {
        if (preloadedResources.current.has(src)) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.onload = () => {
                preloadedResources.current.add(src);
                resolve();
            };
            script.onerror = reject;
            script.src = src;
            document.head.appendChild(script);
        });
    }, []);

    const preloadStylesheet = useCallback((href: string) => {
        if (preloadedResources.current.has(href)) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = href;
            link.onload = () => {
                preloadedResources.current.add(href);
                resolve();
            };
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }, []);

    return {
        preloadImage,
        preloadScript,
        preloadStylesheet,
        isPreloaded: (src: string) => preloadedResources.current.has(src),
    };
};

// Component visibility hook
export const useComponentVisibility = () => {
    const [isVisible, setIsVisible] = useState(!document.hidden);
    const [isFocused, setIsFocused] = useState(document.hasFocus());

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        const handleFocus = () => setIsFocused(true);
        const handleBlur = () => setIsFocused(false);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    return { isVisible, isFocused };
};

// Network status hook
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [connectionType, setConnectionType] = useState<string>('unknown');

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Get connection type if available
        if ('connection' in navigator) {
            const connection = (navigator as any).connection;
            setConnectionType(connection.effectiveType || 'unknown');
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, connectionType };
};

export default {
    useDebounce,
    useThrottle,
    useIntersectionObserver,
    useVirtualScrolling,
    useMemoryOptimization,
    usePerformanceMonitor,
    useOptimizedState,
    useBatchedUpdates,
    useResourcePreloader,
    useComponentVisibility,
    useNetworkStatus,
};
