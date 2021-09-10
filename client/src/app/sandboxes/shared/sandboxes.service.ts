import { Observable, of, Subject } from 'rxjs';
import { Injectable } from '@angular/core';
import { RestService } from '@aitheon/core-client';
import { SandboxSettings } from './sandbox-settings.model';
import { environment } from '../../../environments/environment';

@Injectable()
export class SandboxesService {

  constructor(
    private restService: RestService
    ) { }

  getSettings(): Observable<SandboxSettings> {
    return this.restService.fetch(`/api/sandboxes/settings`);
  }

  saveSettings(sandboxSettings: SandboxSettings): Observable<SandboxSettings> {
    return this.restService.post(`/api/sandboxes/settings`, sandboxSettings);
  }

  updateHotSandboxImage(): Observable<void> {
    return this.restService.put(`/api/sandboxes/images`, {});
  }

  terminateAllTemplates(): Observable<void> {
    return this.restService.delete(`/api/sandboxes/hot-templates`);
  }

}
