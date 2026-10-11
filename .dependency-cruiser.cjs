const { readdirSync } = require('node:fs');

const features = readdirSync('src/features', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

module.exports = {
  forbidden: [
    {
      name: 'no-cycles',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved-imports',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'browser-cannot-import-server-or-content',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^(server|content)/' },
    },
    {
      name: 'browser-and-domain-cannot-import-node-builtins',
      severity: 'error',
      from: { path: '^(src|shared)/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'domain-is-independent',
      severity: 'error',
      from: { path: '^shared/' },
      to: { path: '^(src|server|content)/|^node_modules/(react|react-dom|fastify|pg)(/|$)' },
    },
    {
      name: 'server-cannot-import-ui',
      severity: 'error',
      from: { path: '^(server|content)/' },
      to: { path: '^src/' },
    },
    {
      name: 'shared-ui-cannot-import-features-or-app',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(features|app)/|^src/main\\.tsx$' },
    },
    {
      name: 'features-cannot-import-app',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/app/|^src/main\\.tsx$' },
    },
    ...features.map((feature) => ({
      name: `public-api-of-${feature}`,
      severity: 'error',
      from: { path: '^src/', pathNot: `^src/features/${feature}/` },
      to: { path: `^src/features/${feature}/`, pathNot: '/index\\.ts$' },
    })),
    {
      name: 'routes-use-services-not-database',
      severity: 'error',
      from: { path: '^server/routes/' },
      to: { path: '^server/(db|schema)\\.ts$|^content/|^node_modules/pg/' },
    },
    {
      name: 'services-cannot-import-http',
      severity: 'error',
      from: { path: '^server/', pathNot: '^server/(routes/|http/|app\\.ts$|index\\.ts$)' },
      to: { path: '^server/(routes/|http/|app\\.ts$|index\\.ts$)|^node_modules/fastify/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
