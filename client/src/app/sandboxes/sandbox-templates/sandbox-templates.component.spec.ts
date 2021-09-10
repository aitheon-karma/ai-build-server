import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SandboxTemplatesComponent } from './sandbox-templates.component';

describe('SandboxTemplatesComponent', () => {
  let component: SandboxTemplatesComponent;
  let fixture: ComponentFixture<SandboxTemplatesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SandboxTemplatesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SandboxTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
