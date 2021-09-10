import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SandboxTemplatesComponent } from './sandbox-templates/sandbox-templates.component';

const routes: Routes = [
  {
    path: 'sandbox-templates',
    component: SandboxTemplatesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SandboxesRoutingModule { }
