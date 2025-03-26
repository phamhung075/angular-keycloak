import { KeycloakService } from 'keycloak-angular';

export function initializeKeycloak(
  keycloak: KeycloakService
): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      // Skip Keycloak initialization in SSR mode
      console.log('Skipping Keycloak initialization in server environment');
      return true;
    }

    try {
      // Initialize Keycloak with proper configuration
      return await keycloak.init({
        config: {
          url: 'http://localhost:8080',
          realm: 'ofelwin',
          clientId: 'ofelwin-client-250312',
        },
        initOptions: {
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri:
            window.location.origin + '/assets/silent-check-sso.html',
          checkLoginIframe: false, // Recommended for better performance
        },
        // Configure bearer token handling
        enableBearerInterceptor: true,
        bearerPrefix: 'Bearer',
        bearerExcludedUrls: ['/assets', '/public'],
      });
    } catch (error) {
      console.error('Error initializing Keycloak:', error);
      return false;
    }
  };
}
