module.exports = {
  apps: [
    {
      name: "api-gateway",
      cwd: "./apps/api-gateway",
      script: "../../node_modules/.bin/tsx",
      args: "src/index.ts",
      interpreter: "/usr/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
    {
      name: "web-public",
      cwd: "./apps/web-public",
      script: "../../node_modules/.bin/remix-serve",
      args: "./build/server/index.js",
      interpreter: "/usr/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      name: "web-admin",
      cwd: "./apps/web-admin",
      script: "../../node_modules/.bin/remix-serve",
      args: "./build/server/index.js",
      interpreter: "/usr/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
      },
    },
  ],
};
