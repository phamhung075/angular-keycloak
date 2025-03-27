import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-keycloak-diagnostic',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">
        Keycloak Connection Troubleshooter
      </h2>

      <!-- Connection Status -->
      <div class="mb-6 p-4 border rounded-md">
        <h3 class="font-medium text-lg mb-2">Current Connection Status</h3>
        <div
          class="p-3 rounded-md text-sm"
          [ngClass]="{
            'bg-green-100 text-green-800': isAuthenticated(),
            'bg-yellow-100 text-yellow-800': !isAuthenticated()
          }"
        >
          <div class="grid grid-cols-2 gap-2">
            <div class="font-medium">Connected:</div>
            <div>{{ isInitialized() ? '✓' : '✗' }}</div>

            <div class="font-medium">Authenticated:</div>
            <div>{{ isAuthenticated() ? '✓' : '✗' }}</div>

            <div class="font-medium">Keycloak URL:</div>
            <div>{{ keycloakUrl() }}</div>

            <div class="font-medium">Client ID:</div>
            <div>{{ clientId() }}</div>

            <div class="font-medium">Realm:</div>
            <div>{{ realm() }}</div>

            @if (tokenExpiry()) {
            <div class="font-medium">Token Expires:</div>
            <div>{{ tokenExpiry() }}</div>
            }
          </div>

          @if (connectionError()) {
          <div class="mt-3 p-2 bg-red-50 text-red-700 rounded">
            Error: {{ connectionError() }}
          </div>
          }
        </div>
      </div>

      <!-- Actions -->
      <div class="mb-6 p-4 border rounded-md">
        <h3 class="font-medium text-lg mb-2">Actions</h3>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
            (click)="testConnection()"
          >
            Test Connection
          </button>

          <button
            class="px-3 py-1.5 bg-green-600 text-white font-medium rounded hover:bg-green-700"
            (click)="login()"
          >
            Login
          </button>

          <button
            class="px-3 py-1.5 bg-red-600 text-white font-medium rounded hover:bg-red-700"
            (click)="logout()"
          >
            Logout
          </button>
        </div>

        @if (actionResult()) {
        <div
          class="mt-3 p-2 rounded"
          [ngClass]="{
            'bg-red-50 text-red-700': !actionSuccess(),
            'bg-green-50 text-green-700': actionSuccess()
          }"
        >
          {{ actionResult() }}
        </div>
        }
      </div>

      <!-- Configuration -->
      <div class="mb-6 p-4 border rounded-md">
        <h3 class="font-medium text-lg mb-2">Keycloak Configuration</h3>
        <pre class="p-3 bg-gray-100 rounded text-sm overflow-auto max-h-60">{{
          configData() | json
        }}</pre>
      </div>

      <!-- Recommendations -->
      <div class="mt-8 p-4 bg-yellow-50 rounded-md">
        <h3 class="font-semibold text-lg text-yellow-800 mb-2">
          Troubleshooting Recommendations
        </h3>
        <ul class="list-disc ml-6 text-sm space-y-2 text-yellow-800">
          <li>
            Ensure Keycloak server is running at the correct URL (typically
            <code>http://localhost:8080</code>)
          </li>
          <li>
            Verify your client ID, realm, and URL match between your Keycloak
            server and Angular app
          </li>
          <li>
            Check that the <code>silent-check-sso.html</code> file is correctly
            deployed
          </li>
          <li>
            Verify CORS settings in Keycloak allow requests from your
            application origin
          </li>
          <li>
            Clear browser cache and cookies if authentication state is
            inconsistent
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class KeycloakDiagnosticComponent implements OnInit {
  private keycloak = inject(KeycloakService);
  private http = inject(HttpClient);

  // Signals for state
  isInitialized = signal<boolean>(false);
  isAuthenticated = signal<boolean>(false);
  keycloakUrl = signal<string>('Unknown');
  clientId = signal<string>('Unknown');
  realm = signal<string>('Unknown');
  tokenExpiry = signal<string | null>(null);
  connectionError = signal<string | null>(null);
  configData = signal<any>({});
  actionResult = signal<string | null>(null);
  actionSuccess = signal<boolean>(false);

  ngOnInit(): void {
    this.updateStatus();
    this.loadConfiguration();
  }

  updateStatus(): void {
    try {
      const instance = this.keycloak.getKeycloakInstance();

      if (!instance) {
        this.connectionError.set('Keycloak instance not created');
        return;
      }

      // Check initialization and authentication
      this.isInitialized.set(!!instance.authenticated !== undefined);
      this.isAuthenticated.set(!!instance.authenticated);

      // Get configuration information
      if (instance.authServerUrl) {
        this.keycloakUrl.set(instance.authServerUrl);
      }

      if (instance.realm) {
        this.realm.set(instance.realm);
      }

      if (instance.clientId) {
        this.clientId.set(instance.clientId);
      }

      // Get token information if authenticated
      if (instance.authenticated && instance.token && instance.tokenParsed) {
        const expiresDate = new Date((instance.tokenParsed.exp || 0) * 1000);
        this.tokenExpiry.set(expiresDate.toLocaleString());
      } else {
        this.tokenExpiry.set(null);
      }

      this.connectionError.set(null);
    } catch (error) {
      console.error('Error checking Keycloak status:', error);
      this.connectionError.set(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  loadConfiguration(): void {
    // Try to fetch the configuration from the server
    this.http.get('/keycloak.json').subscribe({
      next: (config) => {
        this.configData.set(config);
      },
      error: (error) => {
        console.error('Failed to load Keycloak configuration:', error);
        this.configData.set({
          error: 'Failed to load configuration',
          details: error.message,
        });
      },
    });
  }

  testConnection(): void {
    this.actionResult.set('Testing connection...');

    try {
      const instance = this.keycloak.getKeycloakInstance();

      if (!instance) {
        this.actionResult.set('Error: Keycloak instance not created');
        this.actionSuccess.set(false);
        return;
      }

      const wellKnownUrl = `${instance.authServerUrl}/realms/${instance.realm}/.well-known/openid-configuration`;

      this.http.get(wellKnownUrl).subscribe({
        next: (response) => {
          this.actionResult.set('Connection successful! Server is reachable.');
          this.actionSuccess.set(true);
          console.log('Keycloak server response:', response);
        },
        error: (error) => {
          this.actionResult.set(`Connection failed: ${error.message}`);
          this.actionSuccess.set(false);
          console.error('Keycloak connection test failed:', error);
        },
      });
    } catch (error) {
      this.actionResult.set(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      this.actionSuccess.set(false);
    }
  }

  login(): void {
    try {
      this.keycloak
        .login()
        .then(() => {
          this.actionResult.set('Login successful!');
          this.actionSuccess.set(true);
          this.updateStatus();
        })
        .catch((error) => {
          this.actionResult.set(
            `Login failed: ${error.message || 'Unknown error'}`
          );
          this.actionSuccess.set(false);
          console.error('Login error:', error);
        });
    } catch (error) {
      this.actionResult.set(
        `Error initiating login: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.actionSuccess.set(false);
    }
  }

  logout(): void {
    try {
      this.keycloak
        .logout()
        .then(() => {
          this.actionResult.set('Logout successful!');
          this.actionSuccess.set(true);
          this.updateStatus();
        })
        .catch((error) => {
          this.actionResult.set(
            `Logout failed: ${error.message || 'Unknown error'}`
          );
          this.actionSuccess.set(false);
          console.error('Logout error:', error);
        });
    } catch (error) {
      this.actionResult.set(
        `Error initiating logout: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.actionSuccess.set(false);
    }
  }
}
