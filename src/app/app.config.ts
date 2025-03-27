import { isPlatformBrowser } from '@angular/common';
import {
  HttpClient,
  HttpInterceptorFn,
  provideHttpClient,
  withFetch,
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
function initializeKeycloak(
  keycloak: KeycloakService,
  httpClient: HttpClient,
  platformId: Object
): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    // Check if we're in a browser environment
    if (!isPlatformBrowser(platformId)) {
      // Skip Keycloak initialization in SSR mode
      console.log('Skipping Keycloak initialization in server environment');
      return true;
    }

    try {
      console.log('Initializing Keycloak...');

      // Initialize Keycloak with proper configuration
      return await keycloak.init({
        config: {
          url: 'http://localhost:8080',
          realm: 'ofelwin',
          clientId: 'ofelwin-client-angular',
        },
        initOptions: {
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri:
            window.location.origin + '/assets/silent-check-sso.html',
          checkLoginIframe: false,
        },
        enableBearerInterceptor: true,
        bearerPrefix: 'Bearer',
        bearerExcludedUrls: ['/assets', '/public', '/debug'],
      });
    } catch (error) {
      console.error('Error initializing Keycloak:', error);
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

    // Configure HTTP client with custom interceptor
    provideHttpClient(withFetch(), withInterceptors([keycloakInterceptor])),

    // Provide Keycloak service
    KeycloakService,

    // Provide our wrapper service
    KeycloakWrapperService,

    // Initialize Keycloak with proper dependency injection
    {
      provide: APP_INITIALIZER,
      useFactory: (
        keycloak: KeycloakService,
        httpClient: HttpClient,
        platformId: Object
      ) => initializeKeycloak(keycloak, httpClient, platformId),
      multi: true,
      deps: [KeycloakService, HttpClient, PLATFORM_ID],
    },

    // Custom error handler for better Keycloak error messages
    {
      provide: ErrorHandler,
      useClass: KeycloakErrorHandler,
    },
  ],
};
