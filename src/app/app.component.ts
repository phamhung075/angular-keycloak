import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeycloakProfile } from 'keycloak-js';
import { firstValueFrom } from 'rxjs';
import { KeycloakDiagnosticComponent } from './keycloak-diagnostic/keycloak-diagnostic.component';
import { KeycloakWrapperService } from './services/keycloak-wrapper.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, KeycloakDiagnosticComponent],
  template: `
    <div class="container mx-auto p-4">
      <header
        class="flex justify-between items-center mb-6 p-4 bg-white shadow rounded"
      >
        <h1 class="text-2xl font-bold">Angular Keycloak Auth</h1>

        <div class="flex items-center">
          @if (isLoggedIn()) {
          <span class="mr-4">
            Welcome {{ userProfile()?.firstName || 'User' }}
          </span>
          <button
            class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            (click)="logout()"
          >
            Logout
          </button>
          } @else {
          <button
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            (click)="login()"
          >
            Login
          </button>
          }
        </div>
      </header>

      <main>
        <router-outlet></router-outlet>
      </main>
      <app-keycloak-diagnostic></app-keycloak-diagnostic>
    </div>
  `,
})
export class AppComponent implements OnInit {
  // Use the wrapper service instead of direct KeycloakService
  private readonly keycloakWrapper = inject(KeycloakWrapperService);

  // Use signals for reactive state management
  private isLoggedInState = signal<boolean>(false);
  private userProfileState = signal<KeycloakProfile | null>(null);

  // Expose signals as getters
  public isLoggedIn = this.isLoggedInState.asReadonly();
  public userProfile = this.userProfileState.asReadonly();

  public async ngOnInit(): Promise<void> {
    try {
      // The wrapper service handles SSR detection internally
      const isLoggedIn = await firstValueFrom(
        this.keycloakWrapper.isLoggedIn()
      );
      this.isLoggedInState.set(isLoggedIn);

      if (isLoggedIn) {
        const profile = await firstValueFrom(
          this.keycloakWrapper.getUserProfile()
        );
        this.userProfileState.set(profile);
      }
    } catch (error) {
      console.error('Failed to initialize auth status:', error);
    }
  }

  public login(): void {
    this.keycloakWrapper.login();
  }

  public logout(): void {
    this.keycloakWrapper.logout(window.location.origin);
  }
}
