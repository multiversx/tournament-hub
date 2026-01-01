/**
 * Rate Limiting Handler
 * 
 * This utility helps handle rate limiting errors gracefully
 * and prevents the cascade of errors you're seeing in the console.
 */

interface RateLimitConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

const defaultConfig: RateLimitConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
};

class RateLimitHandler {
    private requestQueue = new Map<string, number[]>();
    private retryCounts = new Map<string, number>();

    /**
     * Check if a request should be throttled
     */
    shouldThrottle(url: string, maxRequestsPerMinute: number = 60): boolean {
        const now = Date.now();
        const minuteAgo = now - 60000; // 1 minute ago

        // Clean old entries
        const requests = this.requestQueue.get(url) || [];
        const recentRequests = requests.filter((timestamp: number) => timestamp > minuteAgo);

        if (recentRequests.length >= maxRequestsPerMinute) {
            console.warn(`Rate limiting active for ${url}. Recent requests: ${recentRequests.length}`);
            return true;
        }

        // Add current request
        recentRequests.push(now);
        this.requestQueue.set(url, recentRequests);

        return false;
    }

    /**
     * Handle rate limit errors with exponential backoff
     */
    async handleRateLimitError(
        url: string,
        retryFn: () => Promise<any>,
        config: Partial<RateLimitConfig> = {}
    ): Promise<any> {
        const finalConfig = { ...defaultConfig, ...config };
        const retryKey = url;

        const retryCount = this.retryCounts.get(retryKey) || 0;

        if (retryCount >= finalConfig.maxRetries) {
            console.error(`Max retries (${finalConfig.maxRetries}) exceeded for ${url}`);
            throw new Error(`Rate limit exceeded for ${url}`);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
            finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, retryCount),
            finalConfig.maxDelay
        );

        console.warn(`Rate limit hit for ${url}. Retrying in ${delay}ms (attempt ${retryCount + 1}/${finalConfig.maxRetries})`);

        // Update retry count
        this.retryCounts.set(retryKey, retryCount + 1);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            const result = await retryFn();
            // Reset retry count on success
            this.retryCounts.delete(retryKey);
            return result;
        } catch (error) {
            // If it's still a rate limit error, retry
            if (this.isRateLimitError(error)) {
                return this.handleRateLimitError(url, retryFn, config);
            }
            throw error;
        }
    }

    /**
     * Check if an error is a rate limit error
     */
    public isRateLimitError(error: any): boolean {
        if (error?.status === 429) return true;
        if (error?.message?.includes('429')) return true;
        if (error?.message?.includes('Too Many Requests')) return true;
        return false;
    }

    /**
     * Clear all rate limit data
     */
    clear() {
        this.requestQueue.clear();
        this.retryCounts.clear();
    }

    /**
     * Get current rate limit status
     */
    getStatus(): { [url: string]: { requests: number; retries: number } } {
        const status: { [url: string]: { requests: number; retries: number } } = {};

        this.requestQueue.forEach((requests, url) => {
            const now = Date.now();
            const minuteAgo = now - 60000;
            const recentRequests = requests.filter((timestamp: number) => timestamp > minuteAgo);

            status[url] = {
                requests: recentRequests.length,
                retries: this.retryCounts.get(url) || 0
            };
        });

        return status;
    }
}

// Export singleton instance
export const rateLimitHandler = new RateLimitHandler();

// Helper function to wrap API calls with rate limiting
export const withRateLimit = async <T>(
    url: string,
    apiCall: () => Promise<T>,
    maxRequestsPerMinute: number = 60
): Promise<T> => {
    if (rateLimitHandler.shouldThrottle(url, maxRequestsPerMinute)) {
        throw new Error(`Rate limit exceeded for ${url}. Please wait before making more requests.`);
    }

    try {
        return await apiCall();
    } catch (error) {
        if (rateLimitHandler.isRateLimitError(error)) {
            return rateLimitHandler.handleRateLimitError(url, apiCall);
        }
        throw error;
    }
};
