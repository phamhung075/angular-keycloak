import { TestBed } from '@angular/core/testing';

import { KeycloakWrapperService } from './keycloak-wrapper.service';

describe('KeycloakWrapperService', () => {
  let service: KeycloakWrapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeycloakWrapperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
