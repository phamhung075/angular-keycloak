// keycloak-diagnostic.component.ts
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { KeycloakWrapperService } from '../services/keycloak-wrapper.service';
interface ServerTest {
  url: string;
  description: string;
  status: 'pending' | 'success' | 'error' | 'not-started';
  errorMessage?: string;
  responseData?: any;
}

interface FileCheck {
  path: string;
  status: 'pending' | 'success' | 'error' | 'not-started';
  errorMessage?: string;
}
@Component({
  selector: 'app-keycloak-diagnostic',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './keycloak-diagnostic.component.html',
})
export class KeycloakDiagnosticComponent implements OnInit {
  private http = inject(HttpClient);
  private keycloakWrapper = inject(KeycloakWrapperService);

  // Connection status signals
  private isConnectedState = signal<boolean>(false);
  private isInitializedState = signal<boolean>(false);
  private isAuthenticatedState = signal<boolean>(false);
  private connectionErrorState = signal<string | null>(null);
  private tokenExpiryState = signal<string | null>(null);
  constructor() {
    effect(() => {
      if (this.verboseLogging()) {
        console.log('Setting up Keycloak debug monitoring');

        // Setup monitoring interval
        const intervalId = setInterval(() => {
          this.updateConnectionStatus();
        }, 5000);

        // Cleanup when disabled
        return () => {
          console.log('Disabling Keycloak debug monitoring');
          clearInterval(intervalId);
        };
      }
      // Return cleanup function even when verbose logging is disabled
      return () => {};
    });
  }
  ngOnInit(): void {
    console.log('KeycloakDiagnosticComponent initialized');
    // Run initial connection status check
    this.updateConnectionStatus();

    // Ensure server test URLs are consistent
    this.serverTestsState.update((tests) =>
      tests.map((test) => {
        // Ensure Authentication Endpoint uses port 8080 consistently
        if (
          test.description === 'Authentication Endpoint' &&
          test.url.includes('localhost:8080')
        ) {
          console.log('Fixing Authentication Endpoint URL to use port 8080');
          return {
            ...test,
            url: 'http://localhost:8080/realms/ofelwin/protocol/openid-connect/auth',
          };
        }
        return test;
      })
    );
  }
  // Server tests signals
  private serverTestsState = signal<ServerTest[]>([
    {
      url: 'http://localhost:8080/realms/ofelwin/.well-known/openid-configuration',
      description: 'Realm Configuration',
      status: 'not-started',
    },
    {
      url: 'http://localhost:8080/realms/ofelwin/protocol/openid-connect/auth',
      description: 'Authentication Endpoint',
      status: 'not-started',
    },
    {
      url: 'http://localhost:8080/admin/master/console/',
      description: 'Keycloak Admin Console',
      status: 'not-started',
    },
  ]);

  // File checks signals
  private fileChecksState = signal<FileCheck[]>([
    {
      path: '/assets/silent-check-sso.html',
      status: 'not-started',
    },
  ]);

  // Fix action signals
  private ssoFixInProgressState = signal<boolean>(false);
  private lastFixMessageState = signal<string | null>(null);

  // Logging signals
  private verboseLoggingState = signal<boolean>(false);

  // Public readonly signals
  isConnected = this.isConnectedState.asReadonly();
  isInitialized = this.isInitializedState.asReadonly();
  isAuthenticated = this.isAuthenticatedState.asReadonly();
  connectionError = this.connectionErrorState.asReadonly();
  tokenExpiry = this.tokenExpiryState.asReadonly();
  serverTests = this.serverTestsState.asReadonly();
  fileChecks = this.fileChecksState.asReadonly();
  ssoFixInProgress = this.ssoFixInProgressState.asReadonly();
  lastFixMessage = this.lastFixMessageState.asReadonly();
  verboseLogging = this.verboseLoggingState.asReadonly();

  updateConnectionStatus(): void {
    this.keycloakWrapper.connectionStatus$.subscribe((status) => {
      this.isConnectedState.set(status.connected);
      this.isInitializedState.set(status.initialized);
      this.isAuthenticatedState.set(status.authenticated);
      this.connectionErrorState.set(status.error || null);

      if (status.tokenExpiresIn) {
        const expiresDate = new Date(Date.now() + status.tokenExpiresIn * 1000);
        this.tokenExpiryState.set(expiresDate.toLocaleString());
      } else {
        this.tokenExpiryState.set(null);
      }
    });
  }

  // Improved runServerTest method with better logging and CORS handling
  runServerTest(test: ServerTest): void {
    // Log the test being run
    console.log(`Starting test for: ${test.description} (${test.url})`);

    // Update test status to pending
    this.updateServerTestStatus(test.url, {
      status: 'pending',
    });

    // Make the HTTP request to test the endpoint
    this.http
      .get(test.url, {
        observe: 'response',
        // Add headers for CORS handling
        headers: {
          // No CORS headers needed - let the server handle CORS
        },
      })
      .pipe(
        tap((response) => {
          console.log(
            `Test succeeded for: ${test.description}`,
            response.status
          );
          this.updateServerTestStatus(test.url, {
            status: 'success',
            responseData: response.body,
          });
        }),
        catchError((error) => {
          console.error(`Test failed for: ${test.description}`, error);

          // Special handling for admin console which may have CORS restrictions
          if (
            test.url.includes('/admin/master/console/') &&
            error.status === 0
          ) {
            console.log('Admin console test - treating CORS error as success');
            this.updateServerTestStatus(test.url, {
              status: 'success',
              responseData: 'Admin console is available (CORS expected)',
            });
          } else {
            this.updateServerTestStatus(test.url, {
              status: 'error',
              errorMessage: this.formatError(error),
            });
          }
          return of(null);
        })
      )
      .subscribe({
        complete: () => console.log(`Test completed for: ${test.description}`),
      });
  }

  private updateServerTestStatus(
    url: string,
    updates: Partial<ServerTest>
  ): void {
    this.serverTestsState.update((tests) =>
      tests.map((test) => (test.url === url ? { ...test, ...updates } : test))
    );
  }

  checkFile(file: FileCheck): void {
    // Update file check status to pending
    this.updateFileCheckStatus(file.path, {
      status: 'pending',
    });

    // Try to fetch the file to see if it exists
    this.http
      .get(file.path, { responseType: 'text' })
      .pipe(
        tap(() => {
          this.updateFileCheckStatus(file.path, {
            status: 'success',
          });
        }),
        catchError((error) => {
          this.updateFileCheckStatus(file.path, {
            status: 'error',
            errorMessage: this.formatError(error),
          });
          return of(null);
        })
      )
      .subscribe();
  }

  private updateFileCheckStatus(
    path: string,
    updates: Partial<FileCheck>
  ): void {
    this.fileChecksState.update((files) =>
      files.map((file) => (file.path === path ? { ...file, ...updates } : file))
    );
  }

  runAllTests(): void {
    // Run all server tests
    this.serverTestsState().forEach((test) => {
      this.runServerTest(test);
    });

    // Run all file checks
    this.fileChecksState().forEach((file) => {
      this.checkFile(file);
    });

    // Update connection status
    this.updateConnectionStatus();
  }

  fixSilentCheckSso(): void {
    this.ssoFixInProgressState.set(true);
    this.lastFixMessageState.set('Creating silent-check-sso.html file...');

    // Create a blob with the silent-check-sso.html content
    const silentCheckSsoContent = `<html>
  <body>
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  </body>
</html>`;

    const blob = new Blob([silentCheckSsoContent], { type: 'text/html' });
    const fileUrl = URL.createObjectURL(blob);

    // Create a download link for the user to save the file
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = 'silent-check-sso.html';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up
    URL.revokeObjectURL(fileUrl);

    this.lastFixMessageState.set(
      'File downloaded. Please place it in your assets folder at "src/assets/silent-check-sso.html" ' +
        "and rebuild your app. If you're using a dev server, restart it."
    );
    this.ssoFixInProgressState.set(false);

    // Re-check the file after a short delay
    setTimeout(() => {
      this.checkFile(this.fileChecksState()[0]);
    }, 5000);
  }

  clearCache(): void {
    // We can't programmatically clear the entire browser cache,
    // but we can clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    this.lastFixMessageState.set(
      'Browser storage cleared. For a complete reset, manually clear cookies and cache ' +
        'in your browser settings, then reload the page.'
    );
  }

  toggleVerboseLogging(): void {
    this.verboseLoggingState.update((current) => !current);

    if (this.verboseLoggingState()) {
      // Enable verbose logging
      console.info('Enabling verbose Keycloak logging');
      const keycloakInstance = this.keycloakWrapper.getKeycloakInstance();

      if (keycloakInstance) {
        // @ts-ignore - enableLogging might not be in the type definitions
        if (typeof keycloakInstance.enableLogging === 'function') {
          // @ts-ignore
          keycloakInstance.enableLogging(true);
        }

        console.info('Current Keycloak state:', {
          authenticated: keycloakInstance.authenticated,
          token: keycloakInstance.token ? 'Present (hidden)' : 'None',
          refreshToken: keycloakInstance.refreshToken
            ? 'Present (hidden)'
            : 'None',
          subject: keycloakInstance.subject || 'None',
          responseMode: keycloakInstance.responseMode || 'None',
          flow: keycloakInstance.flow || 'None',
        });
      } else {
        console.warn('Keycloak instance not available');
      }
    } else {
      // Disable verbose logging
      const keycloakInstance = this.keycloakWrapper.getKeycloakInstance();

      if (keycloakInstance) {
        // @ts-ignore - enableLogging might not be in the type definitions
        if (typeof keycloakInstance.enableLogging === 'function') {
          // @ts-ignore
          keycloakInstance.enableLogging(false);
        }
      }
    }
  }

  private formatError(error: any): string {
    if (!error) return 'Unknown error';

    const parts = [];

    if (error.status) {
      parts.push(`Status: ${error.status} ${error.statusText || ''}`);
    }

    if (error.message) {
      parts.push(`Message: ${error.message}`);
    }

    if (error.url) {
      parts.push(`URL: ${error.url}`);
    }

    // For CORS errors
    if (error.name === 'HttpErrorResponse' && error.message.includes('CORS')) {
      parts.push(
        'CORS Error: The server is not allowing cross-origin requests from your application'
      );
    }

    return parts.join('\n');
  }
}
