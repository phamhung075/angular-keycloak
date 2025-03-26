import { isPlatformBrowser } from '@angular/common';
import {
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  PLATFORM_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { routes } from './app.routes';
import { KeycloakErrorHandler } from './services/keycloak-error-handler.service';
import { KeycloakWrapperService } from './services/keycloak-wrapper.service';

// Function to initialize Keycloak
// keycloak-init.ts

export function initializeKeycloak(
  keycloak: KeycloakService
): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    // Check if we're in a browser environment
    const platformId = inject(PLATFORM_ID);
    if (!isPlatformBrowser(platformId)) {
      // Skip Keycloak initialization in SSR mode
      console.log('Skipping Keycloak initialization in server environment');
      return true;
    }

    try {
      console.log('Initializing Keycloak...');

      // Add more detailed logging for initialization
      const startTime = Date.now();

      // Initialize Keycloak with proper configuration and additional logging
      const success = await keycloak.init({
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

          // Add a flow to improve debugging - can be removed in production
          flow: 'standard', // Alternatives: 'implicit', 'hybrid'

          // Add response mode for better compatibility
          responseMode: 'fragment',
        },
        // Configure bearer token handling
        enableBearerInterceptor: true,
        bearerPrefix: 'Bearer',
        bearerExcludedUrls: ['/assets', '/public', '/debug'],
      });

      const endTime = Date.now();
      const initTime = endTime - startTime;

      if (success) {
        console.log(`Keycloak initialization successful (${initTime}ms)`);

        // Log authentication status
        const instance = keycloak.getKeycloakInstance();
        console.log(
          `Authentication status: ${
            instance.authenticated ? 'Authenticated' : 'Not authenticated'
          }`
        );

        if (instance.authenticated) {
          // Log token info (without exposing the full token)
          const tokenExpiry = instance.tokenParsed?.exp
            ? new Date(instance.tokenParsed.exp * 1000).toISOString()
            : 'unknown';

          console.log(`Token expires: ${tokenExpiry}`);
        }
      } else {
        console.warn(
          `Keycloak initialization completed without error but returned false (${initTime}ms)`
        );
      }

      return success;
    } catch (error) {
      console.error('Error initializing Keycloak:', error);

      // Provide more detailed diagnostics based on error type
      if (error instanceof Error) {
        console.error(`Error name: ${error.name}, message: ${error.message}`);

        if (
          error.name === 'NetworkError' ||
          error.message.includes('network')
        ) {
          console.error(
            'Network error detected. Please check if Keycloak server is running and accessible.'
          );
        } else if (error.message.includes('realm')) {
          console.error(
            'Realm error detected. Please verify the realm "ofelwin" exists on the Keycloak server.'
          );
        } else if (error.message.includes('client')) {
          console.error(
            'Client error detected. Please verify the client "ofelwin-client-250312" is properly configured.'
          );
        }

        // Suggest visiting the debug route
        console.info(
          'Consider accessing the /debug route to diagnose Keycloak connection issues.'
        );
      }

      // Return false to indicate initialization failure
      return false;
    }
  };
}

// Custom HTTP interceptor that safely handles Keycloak authentication
const keycloakInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // Skip in server environment
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  try {
    // Get the KeycloakService instance
    const keycloakService = inject(KeycloakService);

    // Safely check if Keycloak is initialized
    if (!keycloakService || !keycloakService.getKeycloakInstance) {
      return next(req);
    }

    // Check if the Keycloak instance is initialized and authenticated
    const keycloakInstance = keycloakService.getKeycloakInstance();

    if (keycloakInstance && keycloakInstance.authenticated) {
      // Get the token
      const token = keycloakInstance.token;

      if (token) {
        // Clone the request and add the Authorization header
        const authReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`),
        });
        return next(authReq);
      }
    }

    // If not authenticated or no token, proceed with original request
    return next(req);
  } catch (error) {
    console.error('Error in Keycloak interceptor:', error);
    return next(req);
  }
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),

    // Provide Keycloak service
    KeycloakService,

    // Provide our wrapper service
    KeycloakWrapperService,

    // Configure HTTP client with custom interceptor
    provideHttpClient(withInterceptors([keycloakInterceptor])),

    // Initialize Keycloak
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      multi: true,
      deps: [KeycloakService],
    },

    // Custom error handler for better Keycloak error messages
    {
      provide: ErrorHandler,
      useClass: KeycloakErrorHandler,
    },
  ],
};
