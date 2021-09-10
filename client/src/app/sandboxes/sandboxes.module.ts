import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SandboxesRoutingModule } from './sandboxes-routing.module';
import { SandboxTemplatesComponent } from './sandbox-templates/sandbox-templates.component';
import { CoreClientModule } from '@aitheon/core-client';
import { SandboxesService } from './shared/sandboxes.service';

@NgModule({
  declarations: [SandboxTemplatesComponent],
  imports: [
    CoreClientModule,
    SandboxesRoutingModule
  ],
  providers: [SandboxesService]
})
export class SandboxesModule { }
