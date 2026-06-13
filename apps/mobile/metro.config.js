const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the workspace root
const workspaceRoot = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
