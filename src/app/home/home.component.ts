import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { KeycloakProfile } from 'keycloak-js';
import { firstValueFrom } from 'rxjs';
import { KeycloakWrapperService } from '../services/keycloak-wrapper.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <h2 class="text-xl font-medium text-black mb-4">
        Welcome to Your Dashboard
      </h2>

      @if (loading()) {
      <div class="p-4 text-blue-800 bg-blue-100 rounded">
        Loading user profile...
      </div>
      } @else if (error()) {
      <div class="p-4 text-red-800 bg-red-100 rounded">
        {{ error() }}
        <button
          class="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          (click)="retry()"
        >
          Retry
        </button>
      </div>
      } @else if (userProfile()) {
      <div class="space-y-3">
        <h3 class="text-lg font-medium text-gray-900">User Profile</h3>

        <div class="flex flex-col space-y-2">
          <div class="flex">
            <span class="font-medium w-28">Username:</span>
            <span>{{ userProfile()?.username }}</span>
          </div>

          <div class="flex">
            <span class="font-medium w-28">Email:</span>
            <span>{{ userProfile()?.email }}</span>
          </div>

          <div class="flex">
            <span class="font-medium w-28">First Name:</span>
            <span>{{ userProfile()?.firstName }}</span>
          </div>

          <div class="flex">
            <span class="font-medium w-28">Last Name:</span>
            <span>{{ userProfile()?.lastName }}</span>
          </div>

          @if (userProfile()?.emailVerified) {
          <div class="mt-2 text-sm text-green-600">Email verified</div>
          } @else {
          <div class="mt-2 text-sm text-red-600">Email not verified</div>
          }
        </div>

        @if (realmRoles().length > 0) {
        <div class="mt-4">
          <h4 class="text-md font-medium text-gray-900">Your Roles</h4>
          <ul class="list-disc pl-5 mt-2">
            @for (role of realmRoles(); track role) {
            <li>{{ role }}</li>
            }
          </ul>
        </div>
        }
      </div>
      } @else {
      <div class="p-4 text-amber-800 bg-amber-100 rounded">
        No user profile available. Please log in.
      </div>
      }
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private keycloakWrapper = inject(KeycloakWrapperService);

  // State management with signals
  userProfile = signal<KeycloakProfile | null>(null);
  realmRoles = signal<string[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadUserData();
  }

  async loadUserData(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      // The wrapper service safely handles SSR conditions
      const isLoggedIn = await this.keycloakWrapper.isLoggedIn();

      if (isLoggedIn) {
        const profile = await firstValueFrom(
          this.keycloakWrapper.getUserProfile()
        );
        this.userProfile.set(profile);

        const roles = await firstValueFrom(this.keycloakWrapper.getUserRoles());
        this.realmRoles.set(roles);
      } else {
        // Not an error, just no user is logged in
        this.userProfile.set(null);
        this.realmRoles.set([]);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      this.error.set('Failed to load user data. Please try again later.');
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    this.loadUserData();
  }
}
