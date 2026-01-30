// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to resolve the CommonJS version of zustand to avoid import.meta issues on web
// The ESM version uses import.meta.env which causes "import.meta may only appear in a module" errors
const zustandCjsMap = {
  'zustand': 'index.js',
  'zustand/shallow': 'shallow.js',
  'zustand/middleware': 'middleware.js',
  'zustand/vanilla': 'vanilla.js',
  'zustand/react': 'react.js',
  'zustand/context': 'context.js',
  'zustand/traditional': 'traditional.js',
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && zustandCjsMap[moduleName]) {
    return {
      filePath: path.join(__dirname, 'node_modules/zustand', zustandCjsMap[moduleName]),
      type: 'sourceFile',
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
