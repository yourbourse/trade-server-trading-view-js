<div align="center">

# Vite Build System

[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev/)

**Fast development server and optimized production builds**

</div>

---

# Vite Setup

This project uses Vite as the build tool and development server, providing:
- **Hot Module Replacement (HMR)** for instant updates during development
- **Native TypeScript support** without separate compilation step
- **Path aliases** for cleaner imports (`@/` and `@schema/`)
- **Fast builds** with optimized bundling for production
- **Custom plugins** for handling static assets (charting library)

## Quick Start

### Development Server
```bash
npm run dev
```
Starts the Vite dev server at http://localhost:8080 with HMR enabled. The browser will automatically open.

### Build for Production
```bash
npm run build
```
Cleans the `dist/` folder and builds optimized production files. This includes:
- Bundling and minifying TypeScript/JavaScript
- Copying the TradingView charting library to `dist/charting_library/`
- Generating source maps

**Why copy instead of bundle?** The TradingView charting library dynamically loads CSS bundles and JS chunks at runtime based on the `library_path` configuration. These assets must be preserved as-is and cannot be bundled.

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing before deployment.

## Path Aliases

Path aliases are configured in both [`vite.config.ts`](vite.config.ts) and [`tsconfig.json`](tsconfig.json):

- `@` → `./src`
- `@schema` → `./src/schema`

### Usage Examples

```typescript
// Using @schema alias for generated API schemas
import { Interval } from '@schema/public-api';

// Using @ alias for src directory
import CONFIG from '@/config';
import Datafeed from '@/datafeed/datafeed';

// Relative imports still work
import { something } from './utils/helpers';
```

## TypeScript with Vite

Vite transpiles TypeScript files on-the-fly during development without type checking (for speed). Type checking is done separately:

- **Development**: Vite serves TypeScript directly with fast transpilation
- **Type Checking**: Run `npm run type-check` for full TypeScript validation
- **Build**: Production build includes type checking (`tsc --noEmit` configured)

## Available Scripts

- `npm run dev` - Start Vite dev server with HMR on port 8080
- `npm run build` - Clean dist, then build for production with Vite
- `npm run preview` - Preview the production build locally
- `npm run clean` - Remove the `dist/` directory
- `npm run type-check` - Run TypeScript type checking without emitting files
- `npm run lint` - Run ESLint on TypeScript files

## Configuration

The Vite configuration in [`vite.config.ts`](vite.config.ts) includes:

### Build Configuration
- **Entry point**: `index.html`
- **Output directory**: `dist/`
- **Root directory**: `.` (project root)
- **Public directory**: `public/` (automatically copied to dist)

### Development Server
- **Port**: 8080
- **Auto-open**: Browser opens automatically on start
- **HMR**: Enabled by default

### Path Aliases
```typescript
resolve: {
  alias: {
    '@': resolve(__dirname, './src'),
    '@schema': resolve(__dirname, './src/schema')
  }
}
```

### Custom Plugin: copyChartingLibrary

The configuration includes a custom Vite plugin that copies the entire `charting_library/` folder to `dist/` during build:

```typescript
function copyChartingLibrary() {
  return {
    name: 'copy-charting-library',
    closeBundle() {
      // Recursively copies charting_library/ to dist/charting_library/
    }
  };
}
```

**Why this is needed**: The TradingView charting library loads assets dynamically at runtime (CSS bundles, JS chunks) from the `library_path` you configure. These files cannot be bundled by Vite and must be available as static assets in the production build.

## Notes

- The HTML file (`index.html`) loads `src/app.ts` directly via `<script type="module">`
- Vite handles all TypeScript transpilation automatically
- Production builds are minified and tree-shaken for optimal size
- The `charting_library/` folder is copied as-is to preserve the library's internal structure
- CryptoJS is loaded from CDN (see `index.html`)
- Source maps are generated for debugging in both dev and production

## Migration from Plain TypeScript

If you're coming from a setup that used `tsc` directly:
- Remove any manual `tsc` watch commands
- Vite handles TypeScript compilation automatically
- Use `npm run dev` instead of running `tsc --watch` + separate server
- Type checking is now a separate step (`npm run type-check`)

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [TypeScript Setup](TYPESCRIPT_SETUP.md) | TypeScript configuration and types |
| [Development Guide](DEVELOPMENT.md) | Build system and workflow |
| [Getting Started](GETTING_STARTED.md) | Initial Vite setup |
| [Configuration](CONFIGURATION.md) | Build-time configuration |
