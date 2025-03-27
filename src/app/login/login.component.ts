// login.component.ts
import { CommonModule, JsonPipe } from '@angular/common';
import {
  HttpClient,
  HttpClientModule,
  HttpHeaders,
} from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import * as keycloakConfig from '../../../environment/keycloak.json';

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, JsonPipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // Keycloak configuration
  private keycloakConfig: KeycloakConfig = {
    url: keycloakConfig['auth-server-url'],
    realm: keycloakConfig.realm,
    clientId: keycloakConfig.resource,
  };

  // Form state
  loginForm: FormGroup = this.fb.group({
    username: ['testuser', [Validators.required, Validators.minLength(1)]],
    password: ['testtest!', [Validators.required, Validators.minLength(1)]],
  });

  // UI state
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Form validity - removed updateValueAndValidity from here
  isFormValid = computed(() => {
    const form = this.loginForm;
    return (
      form.valid &&
      form.get('username')?.value?.trim().length > 0 &&
      form.get('password')?.value?.trim().length > 0
    );
  });

  constructor() {
    // Using effect to handle form disabling/enabling based on loading state
    effect(() => {
      if (this.isLoading()) {
        // Disable form while loading
        this.loginForm.disable();
      } else {
        this.loginForm.enable();
      }
    });

    // REMOVED: The problematic subscription that was causing infinite recursion
    // this.loginForm.valueChanges.subscribe(() => {
    //   this.loginForm.updateValueAndValidity();
    // });
  }

  onSubmit(): void {
    if (!this.loginForm.valid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials: LoginCredentials = this.loginForm.value;
    this.authenticate(credentials)
      .then((response) => {
        // Store tokens in localStorage or a dedicated authentication service
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);

        // Navigate to protected route
        this.router.navigate(['/dashboard']);
      })
      .catch((error) => {
        console.error('Authentication failed:', error);
        this.errorMessage.set('Invalid username or password');
      })
      .finally(() => {
        this.isLoading.set(false);
      });
  }

  private async authenticate(
    credentials: LoginCredentials
  ): Promise<AuthResponse> {
    const tokenUrl = `${this.keycloakConfig.url}/auth/realms/${this.keycloakConfig.realm}/protocol/openid-connect/auth`;

    const body = new URLSearchParams();
    body.set('client_id', this.keycloakConfig.clientId);
    body.set('username', credentials.username);
    body.set('password', credentials.password);
    body.set('grant_type', 'password');

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    try {
      // Fixed: Using firstValueFrom instead of toPromise which is deprecated
      return (await this.http
        .post<AuthResponse>(tokenUrl, body.toString(), { headers })
        .toPromise()) as AuthResponse;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Authentication failed: ${error.message}`);
      } else {
        throw new Error('Authentication failed: Unknown error');
      }
    }
  }
}
