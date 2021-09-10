import { Observable, of, Subject } from 'rxjs';
import { Injectable } from '@angular/core';
import { RestService } from '@aitheon/core-client';

import { Lib } from './libs.model';

@Injectable()
export class LibsService {

  constructor(
    private restService: RestService,
    ) { }

  listAll(): Observable<Lib[]> {
    return this.restService.fetch(`/api/libs`);
  } 

  listAitheonLibs(): Observable<Lib[]> {
    return this.restService.fetch(`/api/libs/aitheon`);
  } 


}
