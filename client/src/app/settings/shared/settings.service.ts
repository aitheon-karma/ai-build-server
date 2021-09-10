import { Observable, of, Subject } from 'rxjs';
import { Injectable } from '@angular/core';
import { RestService } from '@aitheon/core-client';

import { Settings } from './settings.model';
import { MonacoEditorService } from 'ngx-monaco';
import { BuildType } from './settings.model';
import { environment } from '../../../environments/environment';

@Injectable()
export class SettingsService {

  monacoOptions = { theme: 'vs-light' };

  constructor(
    private restService: RestService,
    private monacoEditorService: MonacoEditorService,
    ) { }

  listAll(): Observable<Settings[]> {
    return this.restService.fetch(`/api/settings`);
  }

  listById(settingsId: string): Observable<Settings> {
    return this.restService.fetch(`/api/settings/${ settingsId }`);
  }

  create(settings: Settings): Observable<Settings> {
    return this.restService.post(`/api/settings`, settings);
  }

  update(settings: Settings): Observable<void> {
    return this.restService.put(`/api/settings/${ settings._id }`, settings);
  }

  servicesList(): Observable<any> {
    return this.restService.fetch(`${ environment.production ? '' : environment.baseApi }/users/api/services`, null, true);
  }

}
