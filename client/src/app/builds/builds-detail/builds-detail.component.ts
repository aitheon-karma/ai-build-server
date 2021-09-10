import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildsRestService, Build } from '@aitheon/build-server';
import { MonacoFile } from 'ngx-monaco';
import { Subscription } from 'rxjs';

@Component({
  selector: 'ai-builds-detail',
  templateUrl: './builds-detail.component.html',
  styleUrls: ['./builds-detail.component.scss']
})
export class BuildsDetailComponent implements OnInit, OnDestroy {
  @ViewChild('scrollMe') private myScrollContainer: ElementRef;

  currentBuild = {} as Build;
  buildId: string;
  refreshInterval: any;
  $getById: Subscription;

  constructor(
    private activatedRoute: ActivatedRoute,
    private buildsRestService: BuildsRestService,
    private router: Router
  ) { }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.$getById) {
      this.$getById.unsubscribe();
    }
  }

  ngOnInit() {
    this.buildId = this.activatedRoute.snapshot.params['buildId'];
    this.load();
  }

  startRefresh() {
    this.refreshInterval = setTimeout(() => {
      this.load();
    }, 3 * 1000);
  }

  scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }, 1);
    } catch (err) { }
  }

  load() {
    this.buildsRestService.getById(this.buildId).subscribe((build: Build) => {
      this.currentBuild = build;
      if (this.currentBuild.status === Build.StatusEnum.IN_PROGRESS || this.currentBuild.status === Build.StatusEnum.PENDING) {
        this.startRefresh();
      }
      this.scrollToBottom();

    });
  }

}
