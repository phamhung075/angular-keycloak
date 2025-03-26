// profile.component.ts
import { CommonModule } from '@angular/common';
import {
  HttpClient,
  HttpClientModule,
  HttpHeaders,
} from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  attributes?: Record<string, string[]>;
}

interface ProfileUpdateRequest {
  firstName: string;
  lastName: string;
  email: string;
  attributes?: Record<string, string[]>;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // Keycloak configuration
  private keycloakConfig: KeycloakConfig = {
    url: 'http://localhost:8080',
    realm: 'ofelwin',
    clientId: 'ofelwin-client-250312',
  };

  // UI state
  isLoading = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  userProfile = signal<UserProfile | null>(null);

  // Form state
  profileForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(/^\+?[0-9\s-()]{7,}$/)]],
  });

  // Computed properties
  isFormValid = computed(() => this.profileForm.valid);

  displayName = computed(() => {
    const profile = this.userProfile();
    if (!profile) return '';
    return `${profile.firstName} ${profile.lastName}`;
  });

  constructor() {
    effect(() => {
      if (this.isLoading()) {
        this.profileForm.disable();
      } else {
        if (this.isEditing()) {
          this.profileForm.enable();
        } else {
          this.profileForm.disable();
        }
      }
    });
  }

  ngOnInit(): void {
    this.fetchUserProfile();
  }

  fetchUserProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const token = localStorage.getItem('access_token');
    if (!token) {
      this.errorMessage.set('Authentication required');
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const accountUrl = `${this.keycloakConfig.url}/auth/realms/${this.keycloakConfig.realm}/account`;

    this.http.get<UserProfile>(`${accountUrl}`, { headers }).subscribe({
      next: (profile) => {
        this.userProfile.set(profile);
        this.updateFormWithProfile(profile);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to fetch profile:', error);
        if (error.status === 401) {
          this.errorMessage.set('Session expired. Please login again.');
          this.router.navigate(['/login']);
        } else {
          this.errorMessage.set('Failed to load profile information');
        }
        this.isLoading.set(false);
      },
    });
  }

  updateFormWithProfile(profile: UserProfile): void {
    this.profileForm.patchValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.attributes?.['phone']?.[0] || '',
    });
  }

  toggleEditMode(): void {
    if (this.isEditing()) {
      // Cancel editing - reset form to original values
      const profile = this.userProfile();
      if (profile) {
        this.updateFormWithProfile(profile);
      }
      this.isEditing.set(false);
    } else {
      // Start editing
      this.isEditing.set(true);
    }
  }

  saveProfile(): void {
    if (!this.profileForm.valid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const token = localStorage.getItem('access_token');
    if (!token) {
      this.errorMessage.set('Authentication required');
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const formValues = this.profileForm.value;
    const updateData: ProfileUpdateRequest = {
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      email: formValues.email,
      attributes: {
        phone: [formValues.phone],
      },
    };

    const accountUrl = `${this.keycloakConfig.url}/auth/realms/${this.keycloakConfig.realm}/account`;

    this.http.post<void>(`${accountUrl}`, updateData, { headers }).subscribe({
      next: () => {
        // Refresh profile data
        this.fetchUserProfile();
        this.successMessage.set('Profile updated successfully');
        this.isEditing.set(false);
      },
      error: (error) => {
        console.error('Failed to update profile:', error);
        if (error.status === 401) {
          this.errorMessage.set('Session expired. Please login again.');
          this.router.navigate(['/login']);
        } else {
          this.errorMessage.set('Failed to update profile information');
        }
        this.isLoading.set(false);
      },
    });
  }

  logout(): void {
    const token = localStorage.getItem('refresh_token');
    if (!token) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      this.router.navigate(['/login']);
      return;
    }

    const logoutUrl = `${this.keycloakConfig.url}/auth/realms/${this.keycloakConfig.realm}/protocol/openid-connect/logout`;

    const body = new URLSearchParams();
    body.set('client_id', this.keycloakConfig.clientId);
    body.set('refresh_token', token);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    this.http.post(logoutUrl, body.toString(), { headers }).subscribe({
      next: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even if there's an error, clear tokens and redirect
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        this.router.navigate(['/login']);
      },
    });
  }
}
