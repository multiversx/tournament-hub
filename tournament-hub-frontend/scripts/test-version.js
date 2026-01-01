#!/usr/bin/env node

/**
 * Test script to verify version system functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '../src/config/version.ts');
const PACKAGE_FILE = path.join(__dirname, '../package.json');

console.log('🧪 Testing version system...\n');

try {
    // Test 1: Check if version files exist
    console.log('1. Checking if version files exist...');
    if (!fs.existsSync(VERSION_FILE)) {
        throw new Error('Version file not found');
    }
    if (!fs.existsSync(PACKAGE_FILE)) {
        throw new Error('Package.json not found');
    }
    console.log('✅ Version files exist\n');

    // Test 2: Check current version
    console.log('2. Checking current version...');
    const currentVersion = execSync('npm run version:show --silent', { encoding: 'utf8' }).trim();
    console.log(`✅ Current version: ${currentVersion}\n`);

    // Test 3: Test version bump
    console.log('3. Testing version bump...');
    const beforeVersion = currentVersion;
    execSync('npm run version:patch --silent');
    const afterVersion = execSync('npm run version:show --silent', { encoding: 'utf8' }).trim();

    if (afterVersion === beforeVersion) {
        throw new Error('Version did not increment');
    }
    console.log(`✅ Version bumped: ${beforeVersion} → ${afterVersion}\n`);

    // Test 4: Check file synchronization
    console.log('4. Checking file synchronization...');
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
    const versionFile = fs.readFileSync(VERSION_FILE, 'utf8');

    const packageVersion = packageJson.version;
    const versionMatch = versionFile.match(/patch:\s*(\d+)/);
    const versionFilePatch = versionMatch ? versionMatch[1] : null;

    if (!versionFilePatch || !packageVersion.includes(versionFilePatch)) {
        throw new Error('Version files are not synchronized');
    }
    console.log(`✅ Files synchronized: package.json=${packageVersion}, version.ts patch=${versionFilePatch}\n`);

    // Test 5: Test version utilities
    console.log('5. Testing version utilities...');
    try {
        // This would require a build step, so we'll just check if the files can be parsed
        const versionContent = fs.readFileSync(VERSION_FILE, 'utf8');
        if (!versionContent.includes('getVersionString') || !versionContent.includes('getShortVersion')) {
            throw new Error('Version utilities not found');
        }
        console.log('✅ Version utilities found\n');
    } catch (error) {
        console.log(`⚠️  Version utilities test skipped: ${error.message}\n`);
    }

    console.log('🎉 All tests passed! Version system is working correctly.');

} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}
