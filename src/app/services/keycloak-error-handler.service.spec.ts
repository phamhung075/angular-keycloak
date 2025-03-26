import { TestBed } from '@angular/core/testing';

import { KeycloakErrorHandlerService } from './keycloak-error-handler.service';

describe('KeycloakErrorHandlerService', () => {
  let service: KeycloakErrorHandlerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeycloakErrorHandlerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
