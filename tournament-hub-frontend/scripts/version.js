#!/usr/bin/env node

/**
 * Version management script for Tournament Hub Frontend
 * 
 * Usage:
 *   node scripts/version.js patch    # Increment patch version (1.0.0 -> 1.0.1)
 *   node scripts/version.js minor    # Increment minor version (1.0.0 -> 1.1.0)
 *   node scripts/version.js major    # Increment major version (1.0.0 -> 2.0.0)
 *   node scripts/version.js build    # Increment build number
 *   node scripts/version.js show     # Show current version
 */

const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '../src/config/version.ts');
const PACKAGE_FILE = path.join(__dirname, '../package.json');

// Read current version from version.ts
function getCurrentVersion() {
    const content = fs.readFileSync(VERSION_FILE, 'utf8');
    const majorMatch = content.match(/major:\s*(\d+)/);
    const minorMatch = content.match(/minor:\s*(\d+)/);
    const patchMatch = content.match(/patch:\s*(\d+)/);
    const buildMatch = content.match(/build:\s*['"`]([^'"`]*)['"`]/);

    return {
        major: parseInt(majorMatch[1]),
        minor: parseInt(minorMatch[1]),
        patch: parseInt(patchMatch[1]),
        build: buildMatch ? buildMatch[1] : 'dev'
    };
}

// Write new version to version.ts
function updateVersionFile(version) {
    const content = fs.readFileSync(VERSION_FILE, 'utf8');

    const newContent = content
        .replace(/major:\s*\d+/, `major: ${version.major}`)
        .replace(/minor:\s*\d+/, `minor: ${version.minor}`)
        .replace(/patch:\s*\d+/, `patch: ${version.patch}`)
        .replace(/build:\s*['"`][^'"`]*['"`]/, `build: '${version.build}'`)
        .replace(/timestamp:\s*new Date\(\)\.toISOString\(\)/, `timestamp: new Date().toISOString()`);

    fs.writeFileSync(VERSION_FILE, newContent);
}

// Update package.json version
function updatePackageJson(version) {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
    packageJson.version = `${version.major}.${version.minor}.${version.patch}`;
    fs.writeFileSync(PACKAGE_FILE, JSON.stringify(packageJson, null, 2) + '\n');
}

// Increment version based on type
function incrementVersion(currentVersion, type) {
    const newVersion = { ...currentVersion };

    switch (type) {
        case 'major':
            newVersion.major += 1;
            newVersion.minor = 0;
            newVersion.patch = 0;
            break;
        case 'minor':
            newVersion.minor += 1;
            newVersion.patch = 0;
            break;
        case 'patch':
            newVersion.patch += 1;
            break;
        case 'build':
            if (newVersion.build === 'dev') {
                newVersion.build = '1';
            } else {
                newVersion.build = (parseInt(newVersion.build) + 1).toString();
            }
            break;
        default:
            throw new Error(`Unknown version type: ${type}`);
    }

    return newVersion;
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log('Usage: node scripts/version.js [patch|minor|major|build|show]');
        process.exit(1);
    }

    try {
        const currentVersion = getCurrentVersion();

        if (command === 'show') {
            console.log(`Current version: ${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}${currentVersion.build !== 'dev' ? `-${currentVersion.build}` : ''}`);
            return;
        }

        const newVersion = incrementVersion(currentVersion, command);

        updateVersionFile(newVersion);
        updatePackageJson(newVersion);

        console.log(`Version updated: ${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}${currentVersion.build !== 'dev' ? `-${currentVersion.build}` : ''} -> ${newVersion.major}.${newVersion.minor}.${newVersion.patch}${newVersion.build !== 'dev' ? `-${newVersion.build}` : ''}`);

    } catch (error) {
        console.error('Error updating version:', error.message);
        process.exit(1);
    }
}

main();
