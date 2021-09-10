import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './settings.component';
import { SettingsService } from './shared/settings.service';
import { CoreClientModule } from '@aitheon/core-client';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { MonacoEditorModule } from 'ngx-monaco';
import { DockerComponent } from './docker/docker.component';
import { BuildQueueComponent } from './build-queue/build-queue.component';

@NgModule({
  declarations: [SettingsComponent, DockerComponent, BuildQueueComponent],
  imports: [
    CommonModule,
    BrowserModule,
    SettingsRoutingModule,
    CoreClientModule,
    TabsModule.forRoot(),
    MonacoEditorModule
  ],
  providers: [
    SettingsService
  ]
})
export class SettingsModule { }
