import { Component, OnInit } from '@angular/core';
import { AuthService } from '@aitheon/core-client';

@Component({
  selector: 'ai-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: [
    './dashboard.component.scss',
    './dashboard.component.dark.scss'
  ]
})
export class DashboardComponent implements OnInit {

  currentOrganization: any;
  currentUser: any;

  constructor(
    public authService: AuthService
  ) { }

  ngOnInit() {
    this.authService.activeOrganization.subscribe((organization: any) => {
      console.log('activeOrganization:', organization);
      this.currentOrganization = organization;
    });

    this.authService.currentUser.subscribe((user: any) => {
      this.currentUser = user;
    });
  }

}
