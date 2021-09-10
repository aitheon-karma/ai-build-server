import { Component, OnInit, OnDestroy } from '@angular/core';
import { BuildsRestService, Build } from '@aitheon/build-server';
import { Router } from '@angular/router';

@Component({
  selector: 'ai-builds-list',
  templateUrl: './builds-list.component.html',
  styleUrls: ['./builds-list.component.scss']
})
export class BuildsListComponent implements OnInit, OnDestroy {

  loading = false;
  builds: Build[] = [];
  refreshInterval: any;

  constructor(
    private buildsRestService: BuildsRestService,
    private router: Router
  ) {

  }

  ngOnDestroy(): void {
    console.log('ngOnDestroy');
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  ngOnInit() {
   this.loadList();
    this.refreshInterval = setInterval(() => {
      this.loadList();
    }, 60 * 1000);
  }

  loadList() {
    this.loading = true;
    this.buildsRestService.list().subscribe((result: Build[]) => {
      this.builds = result;
      this.loading = false;
    });
  }

  cancelBuild(build: Build, event: any) {
    event.stopPropagation();
    this.buildsRestService.cancel(build._id).subscribe(() => {
      build.status = Build.StatusEnum.CANCELED;
    });
  }

  restartBuild(build: Build, event: any) {
    event.stopPropagation();
    this.buildsRestService.restart(build._id).subscribe(() => {
      this.loadList();
    });
  }

  goToDetail(build) {
    this.router.navigate(['builds', build._id]);
  }

}
