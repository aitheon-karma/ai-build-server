import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreClientModule } from '@aitheon/core-client';

import { LibsRoutingModule } from './libs-routing.module';
import { LibsComponent } from './libs.component';
import { LibsService } from './shared/libs.service';

@NgModule({
  declarations: [LibsComponent],
  imports: [
    CommonModule,
    LibsRoutingModule,
    CoreClientModule
  ],
  providers: [
    LibsService
  ]
})
export class LibsModule { }
