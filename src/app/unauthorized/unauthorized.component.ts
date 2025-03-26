import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KeycloakWrapperService } from '../services/keycloak-wrapper.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  template: `
    <div class="flex items-center justify-center min-h-screen bg-gray-100">
      <div class="p-8 bg-white shadow-lg rounded-lg max-w-md w-full">
        <div class="flex flex-col items-center">
          <div class="bg-red-100 p-3 rounded-full">
            <svg
              class="w-16 h-16 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h2 class="mt-4 text-2xl font-bold text-gray-900">Access Denied</h2>
          <p class="mt-2 text-gray-600 text-center">
            You don't have permission to access this page. Please contact your
            administrator if you believe this is an error.
          </p>

          <div class="mt-6 flex space-x-4">
            <button
              (click)="goToHome()"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Return to Home
            </button>

            @if (!isLoggedIn()) {
            <button
              (click)="login()"
              class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              Login
            </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class UnauthorizedComponent implements OnInit {
  private router = inject(Router);
  private keycloakWrapper = inject(KeycloakWrapperService);

  isLoggedIn = signal<boolean>(false);

  ngOnInit(): void {
    this.checkLoginStatus();
  }

  async checkLoginStatus(): Promise<void> {
    try {
      // The wrapper service handles SSR detection internally
      const isLoggedIn$ = this.keycloakWrapper.isLoggedIn();
      this.isLoggedIn.set(await firstValueFrom(isLoggedIn$));
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  login(): void {
    this.keycloakWrapper.login();
  }
}
