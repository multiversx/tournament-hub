# Version Management

This document describes the versioning system implemented for the Tournament Hub frontend application.

## Overview

The application uses semantic versioning (SemVer) with the format `MAJOR.MINOR.PATCH-BUILD`:
- **MAJOR**: Breaking changes that require user action
  - **0.x.x**: Pre-stable development versions (current)
  - **1.x.x**: First stable release and beyond
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes that are backward compatible
- **BUILD**: Build number for development and CI/CD purposes

### Version Strategy

- **0.x.x**: Development and pre-stable versions
  - 0.1.0: Initial development version
  - 0.2.0, 0.3.0, etc.: Major feature additions during development
  - 0.1.1, 0.1.2, etc.: Bug fixes and minor improvements
- **1.0.0**: First stable, production-ready release
- **1.x.x+**: Stable releases with semantic versioning

## Version Configuration

The version is centrally managed in `src/config/version.ts`:

```typescript
export const VERSION: VersionInfo = {
  major: 0,
  minor: 1,
  patch: 0,
  build: process.env.VITE_BUILD_NUMBER || 'dev',
  timestamp: new Date().toISOString()
};
```

## Version Display

The current version is displayed in the application footer and can be accessed programmatically throughout the app.

## Manual Version Management

### Using npm scripts:

```bash
# Show current version
npm run version:show

# Increment patch version (0.1.0 → 0.1.1)
npm run version:patch

# Increment minor version (0.1.0 → 0.2.0)
npm run version:minor

# Increment major version (0.1.0 → 1.0.0) - Use when reaching stable release
npm run version:major

# Increment build number
npm run version:build
```

### Using the script directly:

```bash
# Show current version
node scripts/version.js show

# Increment versions
node scripts/version.js patch    # 0.1.0 → 0.1.1
node scripts/version.js minor    # 0.1.0 → 0.2.0
node scripts/version.js major    # 0.1.0 → 1.0.0 (stable release)
node scripts/version.js build    # Increment build number
```

## Automatic Version Bumping

### GitHub Actions Workflow

A GitHub Actions workflow (`.github/workflows/version-bump.yml`) automatically manages version bumping:

1. **Scheduled**: Runs every Monday at 9 AM UTC to bump the patch version
2. **Manual**: Can be triggered manually with a choice of version type

### Workflow Features

- Automatically increments version numbers
- Updates both `src/config/version.ts` and `package.json`
- Commits and pushes changes to the repository
- Creates GitHub releases for major and minor version bumps
- Includes detailed changelog information

## Using Version Information in Code

### Import version utilities:

```typescript
import { 
  getVersionString, 
  getFullVersionInfo, 
  getShortVersion,
  getConsoleVersion,
  getApiVersion,
  isDevelopmentBuild,
  getBuildInfo
} from 'utils/version';
```

### Available functions:

- `getVersionString()`: Returns full version string (e.g., "0.1.0-dev")
- `getFullVersionInfo()`: Returns version with timestamp
- `getShortVersion()`: Returns just major.minor.patch
- `getConsoleVersion()`: Formatted for console logs
- `getApiVersion()`: Formatted for API requests
- `isDevelopmentBuild()`: Check if running in dev mode
- `getBuildInfo()`: Complete build information

## Environment Variables

- `VITE_BUILD_NUMBER`: Override the build number (useful in CI/CD)
- If not set, defaults to 'dev' for local development

## Best Practices

1. **Patch versions**: Use for bug fixes and small improvements (0.1.0 → 0.1.1)
2. **Minor versions**: Use for new features that don't break existing functionality (0.1.0 → 0.2.0)
3. **Major versions**: Use when reaching stable release (0.x.x → 1.0.0) or breaking changes (1.0.0 → 2.0.0)
4. **Build numbers**: Automatically incremented for each build

## Integration with CI/CD

The versioning system integrates with:
- GitHub Actions for automated version bumping
- Package.json for npm version management
- Build processes for environment-specific versioning
- Release management for creating GitHub releases

## Troubleshooting

### Version not updating
- Ensure the version script has execute permissions: `chmod +x scripts/version.js`
- Check that both `src/config/version.ts` and `package.json` are being updated
- Verify the script is running from the correct directory

### Build issues
- Make sure `VITE_BUILD_NUMBER` is set in your build environment
- Check that the version file is properly imported in your components
- Verify TypeScript compilation is successful after version changes
