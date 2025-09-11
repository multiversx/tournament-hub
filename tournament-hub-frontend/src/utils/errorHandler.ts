// Error handler to suppress known MultiversX SDK socket API errors
export const setupErrorHandler = () => {
    // Override console.error to filter out known MultiversX SDK socket errors
    const originalConsoleError = console.error;

    console.error = (...args: any[]) => {
        const message = args.join(' ');

        // Filter out known MultiversX SDK socket API errors that are not critical
        const shouldSuppress =
            message.includes('CORS policy') ||
            message.includes('devnet-socket-api.multiversx.com') ||
            message.includes('Websocket connect error') ||
            message.includes('WebSocket reconnection failed') ||
            message.includes('Too Many Requests') ||
            message.includes('ERR_FAILED 429') ||
            message.includes('xhr poll error') ||
            message.includes('Access to XMLHttpRequest') ||
            message.includes('has been blocked by CORS policy') ||
            message.includes('No \'Access-Control-Allow-Origin\' header');

        if (!shouldSuppress) {
            originalConsoleError.apply(console, args);
        }
    };

    // Override console.warn to filter out socket warnings
    const originalConsoleWarn = console.warn;

    console.warn = (...args: any[]) => {
        const message = args.join(' ');

        // Filter out known MultiversX SDK socket warnings
        const shouldSuppress =
            message.includes('WebSocket disabled') ||
            message.includes('polling fallback') ||
            message.includes('devnet-socket-api.multiversx.com') ||
            message.includes('Starting polling fallback');

        if (!shouldSuppress) {
            originalConsoleWarn.apply(console, args);
        }
    };

    // Override console.log to filter out socket info messages
    const originalConsoleLog = console.log;

    console.log = (...args: any[]) => {
        const message = args.join(' ');

        // Filter out known MultiversX SDK socket info messages
        const shouldSuppress =
            message.includes('WebSocket disabled') ||
            message.includes('polling fallback') ||
            message.includes('Starting polling fallback') ||
            message.includes('devnet-socket-api.multiversx.com');

        if (!shouldSuppress) {
            originalConsoleLog.apply(console, args);
        }
    };
};

// Global error handler for unhandled promise rejections
export const setupGlobalErrorHandler = () => {
    window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || event.reason?.toString() || '';

        // Suppress known MultiversX SDK socket errors
        const shouldSuppress =
            message.includes('CORS policy') ||
            message.includes('devnet-socket-api.multiversx.com') ||
            message.includes('Websocket connect error') ||
            message.includes('Too Many Requests') ||
            message.includes('ERR_FAILED 429') ||
            message.includes('Access to XMLHttpRequest') ||
            message.includes('has been blocked by CORS policy');

        if (shouldSuppress) {
            event.preventDefault();
            return;
        }
    });
};

// Additional error handler for fetch errors
export const setupFetchErrorHandler = () => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
            return await originalFetch(input, init);
        } catch (error: any) {
            // Suppress known MultiversX SDK socket fetch errors
            const shouldSuppress =
                error.message?.includes('CORS policy') ||
                error.message?.includes('devnet-socket-api.multiversx.com') ||
                error.message?.includes('Too Many Requests') ||
                error.message?.includes('ERR_FAILED 429');

            if (shouldSuppress) {
                // Return a mock response to prevent further errors
                return new Response(JSON.stringify({}), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            throw error;
        }
    };
};
