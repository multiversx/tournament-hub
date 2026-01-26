/**
 * Application version configuration
 * This file manages the application version and build information
 */

export interface VersionInfo {
    major: number;
    minor: number;
    patch: number;
    build?: string;
    timestamp?: string;
}

export const VERSION: VersionInfo = {
    major: 0,
    minor: 3,
    patch: 4,
    build: process.env.VITE_BUILD_NUMBER || 'dev',
    timestamp: new Date().toISOString()
};

export const getVersionString = (): string => {
    const { major, minor, patch, build } = VERSION;
    return `${major}.${minor}.${patch}${build && build !== 'dev' ? `-${build}` : ''}`;
};

export const getFullVersionInfo = (): string => {
    const version = getVersionString();
    const { timestamp } = VERSION;
    return `${version} (${timestamp})`;
};

export const getShortVersion = (): string => {
    const { major, minor, patch } = VERSION;
    return `${major}.${minor}.${patch}`;
};
