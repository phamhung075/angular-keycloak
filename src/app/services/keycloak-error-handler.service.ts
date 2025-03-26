import { isPlatformBrowser } from '@angular/common';
import { ErrorHandler, Inject, Injectable, PLATFORM_ID } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class KeycloakErrorHandler implements ErrorHandler {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  handleError(error: any): void {
    // Handle the error differently based on environment
    if (isPlatformBrowser(this.platformId)) {
      this.handleBrowserError(error);
    } else {
      this.handleServerError(error);
    }
  }

  private handleBrowserError(error: any): void {
    // Check if it's a Keycloak-related error
    if (this.isKeycloakError(error)) {
      console.group('Keycloak Authentication Error');
      console.error(
        'An error occurred with Keycloak authentication:',
        error.message
      );

      if (error.stack) {
        console.debug('Error stack:', error.stack);
      }

      // Additional context for debugging
      console.info('Suggestions:');
      console.info(
        '- Verify Keycloak server is running at http://localhost:8080'
      );
      console.info('- Check realm and client configuration');
      console.info('- Ensure silent-check-sso.html is properly deployed');
      console.groupEnd();
    } else {
      // For non-Keycloak errors, use default handling
      console.error('Application error:', error);
    }
  }

  private handleServerError(error: any): void {
    // In SSR mode, reduce verbosity for Keycloak errors since they're expected
    if (this.isKeycloakError(error)) {
      console.error(
        'Keycloak error during SSR (expected, will be resolved on client):',
        error.message || 'Unknown Keycloak error'
      );
    } else {
      console.error('Server-side error:', error);
    }
  }

  private isKeycloakError(error: any): boolean {
    if (!error) return false;

    // Check error message for Keycloak-related keywords
    const errorString = JSON.stringify(error).toLowerCase();
    const keycloakKeywords = [
      'keycloak',
      'authentication',
      'authorize',
      'token',
      'login',
      'sso',
      'resource access',
      'unauthorized',
      'forbidden',
      'authenticated',
    ];

    return keycloakKeywords.some((keyword) => errorString.includes(keyword));
  }
}
