import { Component, OnInit } from '@angular/core';
import { AuthService } from '@aitheon/core-client';
import { SettingsService } from 'src/app/settings/shared/settings.service';
import { BuildsRestService } from '@aitheon/build-server';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'ai-deployment',
  templateUrl: './deployment.component.html',
  styleUrls: ['./deployment.component.scss']
})
export class DeploymentComponent implements OnInit {

  services: Array<any>;
  images: Array<any>;
  selectedService: any;
  selectedImage: any;

  constructor(
    private settingsService: SettingsService,
    private buildsRestService: BuildsRestService,
    public toastr: ToastrService,
    private router: Router
    // private usersService: Users
  ) { }

  ngOnInit() {
    this.settingsService.servicesList().subscribe((services: any) => {
      this.services = services.map((svc: any) => {
        svc.repositoryName = 'ai-' + svc._id.replace('_', '-', 'g').toLowerCase();
        return svc;
      }).sort((a, b) => a._id.localeCompare(b._id));
    });
  }

  selectService(service: any) {
    this.selectedService = service;
    this.images = [];
    this.buildsRestService.listImages(this.selectedService.repositoryName).subscribe((images: any) => {
      this.images = images.map((img) => {
        img.commitTag = img.imageTags.filter((tag) => { return ['beta', 'prod', 'master'].indexOf(tag) === -1; });
        img.branchTags = img.imageTags.filter((tag) => { return ['beta', 'prod', 'master'].indexOf(tag) > -1; });
        return img;
      });
    });
  }

  deploy(image: any) {
    this.buildsRestService.deployByTag(this.selectedService._id, image.commitTag).subscribe((build: any) => {
      this.router.navigateByUrl(`/builds/${ build._id }`)
    });
  }

}
