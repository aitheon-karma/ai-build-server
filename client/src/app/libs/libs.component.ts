import { Component, OnInit } from '@angular/core';
import { LibsService } from './shared/libs.service';
import { Lib } from './shared/libs.model';

@Component({
  selector: 'ai-libs',
  templateUrl: './libs.component.html',
  styleUrls: ['./libs.component.scss']
})
export class LibsComponent implements OnInit {

  libsAitheon: Lib[];
  loading = false;

  constructor(
    private libsService: LibsService
  ) { }

  ngOnInit() {
    this.loading = true;
    this.libsService.listAitheonLibs().subscribe((result: Lib[]) => {
      this.libsAitheon = result.map((lib) => {
        lib.name = `@` + lib.from.slice(1).split('@')[0];
        this.loading = false;
        return lib;
      }, err => {
        this.loading = false;
      });
      console.log(result);
    });
  }

  detail(lib) {
    console.log(lib);
  }

}
