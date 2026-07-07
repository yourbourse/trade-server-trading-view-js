import { defineConfig, loadEnv } from 'vite';
import { resolve, join } from 'path';
import { existsSync, copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import banner from 'vite-plugin-banner';

/**
 * Detect charting_library location.
 * - Standalone:  ./charting_library  (user copies it locally)
 * - Submodule:   ../charting_library (when used inside the private repo)
 */
function getChartingLibraryPath(): string {
  const local  = resolve(__dirname, 'charting_library');
  const parent = resolve(__dirname, '..', 'charting_library');

  if (existsSync(local))  return local;
  if (existsSync(parent)) return parent;

  console.warn(
    '\n⚠  charting_library/ not found.\n' +
    '   Copy TradingView Charting Library to this directory or the parent directory.\n'
  );
  return local; // fallback for type-checking (will fail at runtime)
}

const chartingLibPath = getChartingLibraryPath();

function copyChartingLibrary() {
  return {
    name: 'copy-charting-library',
    closeBundle() {
      const dest = 'dist/charting_library';
      function copyRecursive(source: string, destination: string) {
        try {
          mkdirSync(destination, { recursive: true });
          const files = readdirSync(source);
          for (const file of files) {
            const srcPath  = join(source, file);
            const destPath = join(destination, file);
            if (statSync(srcPath).isDirectory()) {
              copyRecursive(srcPath, destPath);
            } else {
              copyFileSync(srcPath, destPath);
            }
          }
        } catch (error) {
          console.error('Error copying charting_library:', error);
        }
      }
      copyRecursive(chartingLibPath, dest);
      console.log('Copied charting_library to dist/');
    }
  };
}

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  const version: string = env.VERSION || "0.0.0";

  const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
  const libVersion: string = pkg.version || '0.0.0';

  return {
    root: '.',
    publicDir: 'public',
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __LIB_VERSION__: JSON.stringify(libVersion)
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@schema': resolve(__dirname, './src/schema'),
        // Allow bare imports like `import ... from 'charting_library/...'`
        'charting_library': chartingLibPath,
      }
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main:   resolve(__dirname, 'index.html'),
          signin: resolve(__dirname, 'signin.html')
        }
      }
    },
    plugins: [
      copyChartingLibrary(),
      banner(`Version: ${version}`),
    ],
    server: {
      port: 8080,
      open: true,
      // Allow Vite dev server to serve files from the parent directory
      // (needed when charting_library lives in the private repo root)
      fs: {
        allow: ['.', '..']
      }
    }
  };
});
