import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import fs from 'fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const assetsFolder = resolve(browserDistFolder, 'assets');

// Ensure assets folder exists
if (!fs.existsSync(assetsFolder)) {
  fs.mkdirSync(assetsFolder, { recursive: true });
}

// Create the silent-check-sso.html file if it doesn't exist
const silentCheckSsoPath = resolve(assetsFolder, 'silent-check-sso.html');
if (!fs.existsSync(silentCheckSsoPath)) {
  const htmlContent = `<html>
  <body>
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  </body>
</html>`;

  fs.writeFileSync(silentCheckSsoPath, htmlContent);
  console.log('Created silent-check-sso.html file');
}

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Serve static files from /browser with appropriate cache headers
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/**
 * Special handling for silent-check-sso.html to ensure proper Keycloak SSO flow
 */
app.get('/assets/silent-check-sso.html', (req, res) => {
  res.sendFile(resolve(assetsFolder, 'silent-check-sso.html'));
});

/**
 * Add a keycloak.json route to serve the Keycloak configuration
 * This allows dynamic configuration without hardcoding values
 */
app.get('/keycloak.json', (req, res) => {
  res.json({
    realm: 'ofelwin',
    'auth-server-url': 'http://localhost:8080',
    'ssl-required': 'external',
    resource: 'ofelwin-client-250312',
    'public-client': true,
    'confidential-port': 0,
  });
});

/**
 * API route for checking server status
 */
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Handle all other requests by rendering the Angular application
 */
app.use('/**', (req, res, next) => {
  // Skip SSR for these routes related to authentication flow
  const skipSsrRoutes = ['/silent-check-sso.html', '/keycloak'];
  if (skipSsrRoutes.some((route) => req.url.includes(route))) {
    return res.sendFile(resolve(browserDistFolder, 'index.html'));
  }

  // Handle normal SSR routes
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch((err) => {
      console.error('SSR Error:', err);
      // Fall back to serving the index.html in case of SSR errors
      res.sendFile(resolve(browserDistFolder, 'index.html'));
    });
});

/**
 * Error handler
 */
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Server error:', err);
    res.status(500).send('Server Error');
  }
);

/**
 * Start the server if this module is the main entry point
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI or Firebase Cloud Functions
 */
export const reqHandler = createNodeRequestHandler(app);
