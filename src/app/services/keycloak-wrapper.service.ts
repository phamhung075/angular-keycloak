// improved-keycloak-wrapper.service.ts
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakInstance, KeycloakProfile } from 'keycloak-js';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface KeycloakConnectionStatus {
  connected: boolean;
  initialized: boolean;
  authenticated: boolean;
  error?: string;
  token?: string;
  tokenExpiresIn?: number;
}

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

@Injectable({
  providedIn: 'root',
})
export class KeycloakWrapperService {
  private status = new BehaviorSubject<KeycloakConnectionStatus>({
    connected: false,
    initialized: false,
    authenticated: false,
  });

  public readonly connectionStatus$ = this.status.asObservable();

  // Default Keycloak configuration
  private config: KeycloakConfig = {
    url: 'http://localhost:8080',
    realm: 'ofelwin',
    clientId: 'ofelwin-client-angular',
  };

  constructor(
    private keycloak: KeycloakService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Update status periodically if in browser
    if (this.isBrowser()) {
      setInterval(() => this.updateStatus(), 30000);
    }
  }

  /**
   * Check if application is running in browser environment
   */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Updates the current status of the Keycloak connection
   */
  updateStatus(): void {
    if (!this.isBrowser()) {
      this.status.next({
        connected: false,
        initialized: false,
        authenticated: false,
        error: 'Server-side rendering - Keycloak not available',
      });
      return;
    }

    try {
      const instance = this.keycloak.getKeycloakInstance();

      if (!instance) {
        this.status.next({
          connected: false,
          initialized: false,
          authenticated: false,
          error: 'Keycloak instance not created',
        });
        return;
      }

      // Check initialization and authentication
      const initialized = !!instance.authenticated;
      const authenticated = !!instance.authenticated;

      // Get token information if authenticated
      let token: string | undefined;
      let tokenExpiresIn: number | undefined;

      if (authenticated && instance.token) {
        token = instance.token;
        tokenExpiresIn = instance.tokenParsed?.exp
          ? instance.tokenParsed.exp - Math.floor(Date.now() / 1000)
          : undefined;
      }

      this.status.next({
        connected: true,
        initialized,
        authenticated,
        token,
        tokenExpiresIn,
      });
    } catch (error) {
      console.error('Error checking Keycloak status:', error);
      this.status.next({
        connected: false,
        initialized: false,
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test the connection to Keycloak server
   * Returns diagnostic information
   */
  testConnection(): Observable<any> {
    if (!this.isBrowser()) {
      return of({
        success: false,
        error: 'Server-side rendering - cannot test connection',
      });
    }

    // Try to fetch the OpenID configuration
    return this.http
      .get(
        `${this.config.url}/realms/${this.config.realm}/.well-known/openid-configuration`
      )
      .pipe(
        map((response) => ({ success: true, data: response })),
        catchError((error) =>
          of({
            success: false,
            error: error.message || 'Failed to connect to Keycloak server',
            status: error.status,
            statusText: error.statusText,
          })
        )
      );
  }

  /**
   * Safely check if the user is logged in
   * Returns false in server-side rendering
   */
  isLoggedIn(): Observable<boolean> {
    if (!this.isBrowser()) {
      return of(false);
    }

    return from(Promise.resolve(this.keycloak.isLoggedIn())).pipe(
      catchError((error) => {
        console.error('Error checking login status:', error);
        return of(false);
      })
    );
  }

  /**
   * Safely get user profile
   * Returns null in server-side rendering or if errors occur
   */
  getUserProfile(): Observable<KeycloakProfile | null> {
    if (!this.isBrowser()) {
      return of(null);
    }

    return this.isLoggedIn().pipe(
      switchMap((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          return of(null);
        }
        return from(this.keycloak.loadUserProfile()).pipe(
          catchError((error) => {
            console.error('Error loading user profile:', error);
            return of(null);
          })
        );
      }),
      catchError((error) => {
        console.error('Error in getUserProfile:', error);
        return of(null);
      })
    );
  }

  /**
   * Safely get user roles
   * Returns empty array in server-side rendering or if errors occur
   */
  getUserRoles(allRoles: boolean = true): Observable<string[]> {
    if (!this.isBrowser()) {
      return of([]);
    }

    return this.isLoggedIn().pipe(
      map((isLoggedIn) => {
        if (!isLoggedIn) {
          return [];
        }

        try {
          return this.keycloak.getUserRoles(allRoles);
        } catch (error) {
          console.error('Error getting user roles:', error);
          return [];
        }
      }),
      catchError((error) => {
        console.error('Error in getUserRoles:', error);
        return of([]);
      })
    );
  }

  /**
   * Safely perform login
   * Does nothing in server-side rendering
   */
  login(options?: any): Promise<void> {
    if (!this.isBrowser()) {
      console.warn('Login attempted in SSR, ignoring');
      return Promise.resolve();
    }

    return this.keycloak
      .login(options)
      .then(() => this.updateStatus())
      .catch((error) => {
        console.error('Login error:', error);
        this.updateStatus();
        throw error;
      });
  }

  /**
   * Safely perform logout
   * Does nothing in server-side rendering
   */
  logout(redirectUri?: string): Promise<void> {
    if (!this.isBrowser()) {
      console.warn('Logout attempted in SSR, ignoring');
      return Promise.resolve();
    }

    return this.keycloak
      .logout(redirectUri)
      .then(() => this.updateStatus())
      .catch((error) => {
        console.error('Logout error:', error);
        this.updateStatus();
        throw error;
      });
  }

  /**
   * Safely check if user has a specific role
   * Returns false in server-side rendering
   */
  hasRole(role: string): Observable<boolean> {
    return this.getUserRoles().pipe(
      map((roles) => roles.some((r) => r.toLowerCase() === role.toLowerCase()))
    );
  }

  /**
   * Get the underlying Keycloak instance for advanced operations
   * Returns null in server-side rendering
   */
  getKeycloakInstance(): KeycloakInstance | null {
    if (!this.isBrowser()) {
      return null;
    }

    try {
      return this.keycloak.getKeycloakInstance();
    } catch (error) {
      console.error('Error getting Keycloak instance:', error);
      return null;
    }
  }

  /**
   * Manually initialize Keycloak with custom config
   * Useful for testing different configurations
   */
  initializeKeycloak(config?: KeycloakConfig): Promise<boolean> {
    if (!this.isBrowser()) {
      console.warn('Initialization attempted in SSR, ignoring');
      return Promise.resolve(false);
    }

    // Use provided config or fallback to default
    const keycloakConfig = config || this.config;

    try {
      return this.keycloak
        .init({
          config: {
            url: keycloakConfig.url,
            realm: keycloakConfig.realm,
            clientId: keycloakConfig.clientId,
          },
          initOptions: {
            onLoad: 'check-sso',
            silentCheckSsoRedirectUri:
              window.location.origin + '/assets/silent-check-sso.html',
            checkLoginIframe: false,
          },
          enableBearerInterceptor: true,
          bearerPrefix: 'Bearer',
          bearerExcludedUrls: ['/assets', '/public'],
        })
        .then((success) => {
          this.updateStatus();
          return success;
        })
        .catch((error) => {
          console.error('Error initializing Keycloak:', error);
          this.updateStatus();
          return false;
        });
    } catch (error) {
      console.error('Exception during Keycloak initialization:', error);
      this.updateStatus();
      return Promise.resolve(false);
    }
  }
}
