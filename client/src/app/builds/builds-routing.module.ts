import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BuildsListComponent } from './builds-list/builds-list.component';
import { BuildsDetailComponent } from './builds-detail/builds-detail.component';
import { DeploymentComponent } from './deployment/deployment.component';

const routes: Routes = [
  {
    path: 'builds', component: BuildsListComponent
  },
  {
    path: 'builds/:buildId', component: BuildsDetailComponent
  },
  {
    path: 'deployments', component: DeploymentComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BuildsRoutingModule { }
