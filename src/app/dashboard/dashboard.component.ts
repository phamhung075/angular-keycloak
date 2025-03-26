// dashboard.component.ts
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service.ts.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <nav class="bg-white shadow">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 justify-between">
            <div class="flex flex-1 items-center justify-between">
              <div class="flex flex-shrink-0 items-center">
                <h1 class="text-xl font-bold">Dashboard</h1>
              </div>
              <div>
                <button
                  (click)="logout()"
                  class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          <div
            class="rounded-lg border-4 border-dashed border-gray-200 p-4 min-h-96"
          >
            <h2 class="text-lg font-medium mb-4">Welcome to your Dashboard</h2>
            <p>
              You have successfully logged in. This is a protected route that
              requires authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class DashboardComponent {
  private authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
