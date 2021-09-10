import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LibsComponent } from './libs.component';

const routes: Routes = [
  {
    path: 'libs', component: LibsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LibsRoutingModule { }
