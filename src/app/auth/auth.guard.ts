import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KeycloakWrapperService } from '../services/keycloak-wrapper.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  private router = inject(Router);
  private keycloakWrapper = inject(KeycloakWrapperService);

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    // Check if user is authenticated - wrapper handles SSR safely
    const authenticated = await this.keycloakWrapper.isLoggedIn();

    if (!authenticated) {
      // Try to login if not authenticated in browser context
      try {
        await this.keycloakWrapper.login({
          redirectUri: window.location.origin + state.url,
        });
      } catch (error) {
        // Login might not be possible in SSR, just navigate to unauthorized
        return this.router.parseUrl('/unauthorized');
      }
      return false;
    }

    // Check if specific roles are required for the route
    const requiredRoles = route.data['roles'] as string[] | undefined;

    if (requiredRoles && requiredRoles.length > 0) {
      // Get user roles - wrapper handles SSR safely
      const userRoles = await this.keycloakWrapper.getUserRoles();

      // Convert to lowercase for case-insensitive comparison
      const lowercaseUserRoles = (await firstValueFrom(userRoles)).map(
        (role: string) => role.toLowerCase()
      );
      const lowercaseRequiredRoles = requiredRoles.map((role) =>
        role.toLowerCase()
      );

      // Check if user has any of the required roles
      const hasRole = lowercaseRequiredRoles.some((role) =>
        lowercaseUserRoles.includes(role)
      );

      if (!hasRole) {
        // Redirect to unauthorized page if user doesn't have required roles
        return this.router.parseUrl('/unauthorized');
      }
    }

    // User is authenticated and has required roles (if any)
    return true;
  }
}
