const { getDefaultConfig } = require("expo/metro-config");
const { resolve } = require("metro-resolver");
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

/**
 * Workspace packages use TypeScript ESM (imports end in `.js` but files are `.ts`).
 * Metro does not rewrite those extensions by default — map them for monorepo sources.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const tryResolve = (name) => {
    try {
      return resolve({ ...context, resolveRequest: undefined }, name, platform);
    } catch {
      return null;
    }
  };

  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    for (const ext of [".ts", ".tsx"]) {
      const candidate = moduleName.slice(0, -3) + ext;
      const resolved = tryResolve(candidate);
      if (resolved) return resolved;
    }
  }

  return tryResolve(moduleName) ?? context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
