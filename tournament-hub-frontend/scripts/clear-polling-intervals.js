/**
 * Clear Polling Intervals Script
 * 
 * This script helps clear any remaining polling intervals that might be cached
 * in the browser or development server.
 */

console.log('🧹 Clearing all polling intervals...');

// Clear all intervals
const highestIntervalId = setTimeout(() => { }, 0);
for (let i = 0; i < highestIntervalId; i++) {
    clearInterval(i);
}

// Clear all timeouts
const highestTimeoutId = setTimeout(() => { }, 0);
for (let i = 0; i < highestTimeoutId; i++) {
    clearTimeout(i);
}

console.log('✅ All intervals and timeouts cleared');

// Clear localStorage cache
if (typeof localStorage !== 'undefined') {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('tournament') || key.includes('cache'))) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed cache key: ${key}`);
    });
}

console.log('🎉 Polling cleanup complete!');
console.log('💡 Restart your development server to ensure all changes take effect');
