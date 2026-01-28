// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to resolve the CommonJS version of zustand to avoid import.meta issues on web
// The ESM version uses import.meta.env which causes "import.meta may only appear in a module" errors
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'zustand') {
    return {
      filePath: path.join(__dirname, 'node_modules/zustand/index.js'),
      type: 'sourceFile',
    };
  }
  if (platform === 'web' && moduleName === 'zustand/shallow') {
    return {
      filePath: path.join(__dirname, 'node_modules/zustand/shallow.js'),
      type: 'sourceFile',
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
