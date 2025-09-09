/**
 * Version utility functions
 * Re-exports version information for easy access throughout the application
 */

import {
    VERSION,
    getVersionString,
    getFullVersionInfo,
    getShortVersion,
    type VersionInfo
} from 'config/version';

export {
    VERSION,
    getVersionString,
    getFullVersionInfo,
    getShortVersion,
    type VersionInfo
};

/**
 * Get version for display in console logs
 */
export const getConsoleVersion = (): string => {
    return `Tournament Hub v${getVersionString()}`;
};

/**
 * Get version for API headers or requests
 */
export const getApiVersion = (): string => {
    return getShortVersion();
};

/**
 * Check if current version is a development build
 */
export const isDevelopmentBuild = (): boolean => {
    return VERSION.build === 'dev';
};

/**
 * Get build information for debugging
 */
export const getBuildInfo = (): string => {
    const version = getVersionString();
    const timestamp = VERSION.timestamp;
    const isDev = isDevelopmentBuild();

    return `${version} (${timestamp}) ${isDev ? '[DEV]' : '[PROD]'}`;
};
