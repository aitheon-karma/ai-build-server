import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { AuthService } from '@aitheon/core-client';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  currentUser: any;

  constructor(
    public authService: AuthService,
    public toastr: ToastrService, vcr: ViewContainerRef
  ) {
    // this.toastr.setRootViewContainerRef(vcr);
  }

  ngOnInit() {
    this.authService.currentUser.subscribe((user: any) => {
      this.currentUser = user;
    });

  }

}
