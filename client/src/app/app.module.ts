import { NgModule } from '@angular/core';
import { CoreClientModule } from '@aitheon/core-client';

import { AppComponent } from './app.component';
import { environment } from '../environments/environment';
import { DashboardModule } from './dashboard/dashboard.module';
import { BuildsModule } from './builds/builds.module';
import { SettingsModule } from './settings/settings.module';
import { LibsModule } from './libs/libs.module';
import { AppRoutingModule } from './app-routing.module';
import { MonacoEditorModule } from 'ngx-monaco';
import { BuildServerModule, Configuration, ConfigurationParameters } from '@aitheon/build-server';
import { SandboxesModule } from './sandboxes/sandboxes.module';

export function apiConfigFactory (): Configuration {
  const params: ConfigurationParameters = {
    basePath: '.'
  };
  return new Configuration(params);
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    CoreClientModule.forRoot({
      baseApi: environment.baseApi,
      production: environment.production
    }),
    MonacoEditorModule.forRoot(),
    AppRoutingModule,

    DashboardModule,
    BuildsModule,
    LibsModule,
    SettingsModule,
    SandboxesModule,

    BuildServerModule.forRoot(apiConfigFactory)
  ],
  providers: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
