import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeycloakDiagnosticComponent } from './keycloak-diagnostic.component';

describe('KeycloakDiagnosticComponent', () => {
  let component: KeycloakDiagnosticComponent;
  let fixture: ComponentFixture<KeycloakDiagnosticComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeycloakDiagnosticComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeycloakDiagnosticComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
