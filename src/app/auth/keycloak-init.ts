import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import * as keycloakConfig from '../../../environment/keycloak.json';

interface KeycloakConfig {
  'auth-server-url': string;
  realm: string;
  resource: string;
  'ssl-required'?: string;
  credentials?: {
    secret?: string;
  };
  'confidential-port'?: number;
}

export function initializeKeycloak(
  keycloak: KeycloakService,
  http: HttpClient
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
      const startTime = Date.now();

      // Try to load the configuration from the server first
      let config: KeycloakConfig;

      try {
        // Attempt to fetch configuration from /keycloak.json
        config = (await http
          .get<KeycloakConfig>('/keycloak.json')
          .toPromise()) as KeycloakConfig;
        console.log(
          'Successfully loaded Keycloak configuration from server:',
          config
        );
      } catch (configError) {
        console.warn(
          'Failed to load Keycloak configuration from server, using default values:',
          configError
        );

        // Fall back to hardcoded configuration
        config = {
          'auth-server-url': keycloakConfig['auth-server-url'],
          realm: keycloakConfig.realm,
          resource: keycloakConfig.resource,
          'ssl-required': 'none',
        };
      }

      // Initialize Keycloak with proper configuration and additional logging
      const success = await keycloak.init({
        config: {
          url: config['auth-server-url'],
          realm: config.realm,
          clientId: config.resource,
        },
        initOptions: {
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri:
            window.location.origin + '/assets/silent-check-sso.html',
          checkLoginIframe: false, // Recommended for better performance
          flow: 'standard',
          responseMode: 'fragment',
        },
        enableBearerInterceptor: true,
        bearerPrefix: 'Bearer',
        bearerExcludedUrls: ['/assets', '/public', '/debug', '/keycloak.json'],
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
            'Client error detected. Please verify the client is properly configured.'
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
