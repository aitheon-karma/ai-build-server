import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BuildsRoutingModule } from './builds-routing.module';
import { BuildsListComponent } from './builds-list/builds-list.component';
import { CoreClientModule } from '@aitheon/core-client';
import { BuildsDetailComponent } from './builds-detail/builds-detail.component';
import { MonacoEditorModule } from 'ngx-monaco';
import { BuildStatusPipe } from './pipes/build-status.pipe';
import { BuildStatusIconPipe } from './pipes/build-status-icon.pipe';
import { DeploymentComponent } from './deployment/deployment.component';

@NgModule({
  declarations: [
    BuildsListComponent,
    BuildsDetailComponent,
    BuildStatusPipe,
    BuildStatusIconPipe,
    DeploymentComponent
  ],
  imports: [
    CommonModule,
    BuildsRoutingModule,
    CoreClientModule,
    MonacoEditorModule
  ],
  providers: [
  ]
})
export class BuildsModule { }
