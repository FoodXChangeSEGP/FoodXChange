/**
 * Metro Zustand CJS Resolution Test
 * 
 * This test ensures that all zustand imports used in the codebase are properly
 * mapped to CommonJS builds in metro.config.js to avoid the 
 * "import.meta may only appear in a module" error on web.
 * 
 * If this test fails, add the missing zustand subpath to the zustandCjsMap 
 * in metro.config.js
 */

const fs = require('fs');
const path = require('path');

// Read the metro config to extract the zustandCjsMap
const metroConfigPath = path.join(__dirname, '..', 'metro.config.js');
const metroConfigContent = fs.readFileSync(metroConfigPath, 'utf8');

// Extract the zustand mappings from metro.config.js
function extractZustandMappings(content) {
  const mapMatch = content.match(/zustandCjsMap\s*=\s*\{([^}]+)\}/s);
  if (!mapMatch) {
    throw new Error('Could not find zustandCjsMap in metro.config.js');
  }
  
  const mappings = new Set();
  const entries = mapMatch[1].matchAll(/'([^']+)':/g);
  for (const entry of entries) {
    mappings.add(entry[1]);
  }
  return mappings;
}

// Recursively find all .ts and .tsx files in src directory
function findSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      findSourceFiles(fullPath, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// Extract zustand imports from source files
function extractZustandImports(files) {
  const imports = new Set();
  const importRegex = /from\s+['"]zustand(?:\/[^'"]+)?['"]/g;
  const moduleRegex = /['"]zustand(?:\/[^'"]+)?['"]/;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(importRegex);
    if (matches) {
      for (const match of matches) {
        const moduleMatch = match.match(moduleRegex);
        if (moduleMatch) {
          // Extract just the module path (remove quotes)
          const modulePath = moduleMatch[0].replace(/['"]/g, '');
          imports.add(modulePath);
        }
      }
    }
  }
  return imports;
}

describe('Metro Zustand CJS Configuration', () => {
  let configuredMappings;
  let usedImports;

  beforeAll(() => {
    configuredMappings = extractZustandMappings(metroConfigContent);
    
    const srcDir = path.join(__dirname, '..', 'src');
    const appDir = path.join(__dirname, '..', 'app');
    
    const sourceFiles = [
      ...findSourceFiles(srcDir),
      ...findSourceFiles(appDir),
    ];
    
    usedImports = extractZustandImports(sourceFiles);
  });

  test('metro.config.js contains zustandCjsMap', () => {
    expect(metroConfigContent).toContain('zustandCjsMap');
  });

  test('metro.config.js has resolver using zustandCjsMap for web platform', () => {
    expect(metroConfigContent).toContain("platform === 'web'");
    expect(metroConfigContent).toContain('zustandCjsMap[moduleName]');
  });

  test('all zustand imports in source code are mapped in metro.config.js', () => {
    const unmappedImports = [];
    
    for (const importPath of usedImports) {
      if (!configuredMappings.has(importPath)) {
        unmappedImports.push(importPath);
      }
    }
    
    if (unmappedImports.length > 0) {
      fail(
        `The following zustand imports are used in source code but not mapped in metro.config.js:\n` +
        `  ${unmappedImports.join('\n  ')}\n\n` +
        `Add them to the zustandCjsMap in metro.config.js to fix the ` +
        `"import.meta may only appear in a module" error on web.\n\n` +
        `Example:\n` +
        `  '${unmappedImports[0]}': '${unmappedImports[0].replace('zustand/', '')}.js',`
      );
    }
    
    expect(unmappedImports).toHaveLength(0);
  });

  test('base zustand import is always mapped', () => {
    expect(configuredMappings.has('zustand')).toBe(true);
  });

  test('zustand/middleware is mapped (commonly used for persist)', () => {
    expect(configuredMappings.has('zustand/middleware')).toBe(true);
  });
});
