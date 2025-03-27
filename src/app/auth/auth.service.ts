// auth.service.ts
import { isPlatformBrowser } from '@angular/common';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  session_state: string;
  scope: string;
}

interface UserCredentials {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private keycloakConfig: KeycloakConfig = {
    url: 'http://localhost:8080',
    realm: 'ofelwin',
    clientId: 'ofelwin-client-angular',
  };

  private tokenUrl: string;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(
    this.hasValidToken()
  );
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.tokenUrl = `${this.keycloakConfig.url}/auth/realms/${this.keycloakConfig.realm}/protocol/openid-connect/token`;
  }

  login(credentials: UserCredentials): Observable<AuthResponse> {
    const body = new URLSearchParams();
    body.set('client_id', this.keycloakConfig.clientId);
    body.set('username', credentials.username);
    body.set('password', credentials.password);
    body.set('grant_type', 'password');

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http
      .post<AuthResponse>(this.tokenUrl, body.toString(), { headers })
      .pipe(
        tap((response: AuthResponse) => {
          this.storeTokens(response);
          this.isAuthenticatedSubject.next(true);
        }),
        catchError(this.handleError)
      );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
    }
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<AuthResponse> {
    if (!isPlatformBrowser(this.platformId)) {
      return throwError(() => new Error('Cannot refresh token during SSR'));
    }

    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const body = new URLSearchParams();
    body.set('client_id', this.keycloakConfig.clientId);
    body.set('refresh_token', refreshToken);
    body.set('grant_type', 'refresh_token');

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    return this.http
      .post<AuthResponse>(this.tokenUrl, body.toString(), { headers })
      .pipe(
        tap((response: AuthResponse) => {
          this.storeTokens(response);
          this.isAuthenticatedSubject.next(true);
        }),
        catchError((error) => {
          this.logout();
          return this.handleError(error);
        })
      );
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const token = localStorage.getItem('access_token');
    const expiresAt = localStorage.getItem('token_expires_at');

    if (!token || !expiresAt) {
      return null;
    }

    // Check if token is expired
    if (new Date().getTime() > parseInt(expiresAt, 10)) {
      // Token expired, try to refresh it
      this.refreshToken().subscribe();
      return null;
    }

    return token;
  }

  private storeTokens(response: AuthResponse): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const expiresAt = new Date().getTime() + response.expires_in * 1000;

    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('token_expires_at', expiresAt.toString());
  }

  private hasValidToken(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const token = localStorage.getItem('access_token');
    const expiresAt = localStorage.getItem('token_expires_at');

    if (!token || !expiresAt) {
      return false;
    }

    return new Date().getTime() < parseInt(expiresAt, 10);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 400 || error.status === 401) {
        errorMessage = 'Invalid username or password';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to server, please try again later';
      } else {
        errorMessage = `Error Code: ${error.status}, Message: ${error.message}`;
      }
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
