import { Component, OnInit } from '@angular/core';
import { SettingsService } from './shared/settings.service';
import { BuildType, Settings } from './shared/settings.model';
import { from } from 'rxjs';

@Component({
  selector: 'ai-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  monacoOptions = { theme: 'vs-light' };
  selectedType = BuildType.AITHEON_SERVICE;

  types: Settings[];
  currentType: Settings;
  constructor(
    private settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.buildForm();
    this.settingsService.listAll().subscribe((result: Settings[]) => {
      console.log(result);
      this.types = result;
      this.buildForm();
    });
  }

  buildForm() {
    if (this.types && this.types.length) {
      this.currentType = this.types.find((t) => {
        return t.buildType.toString() === this.selectedType.toString();
      });
      if (!this.currentType) {
        this.currentType = {} as Settings;
        this.currentType.buildType = this.selectedType;
      }
    } else {
      this.currentType = {} as Settings;
      this.currentType.buildType = this.selectedType;
    }
  }

  loadType(type: any) {
    this.selectedType = type;
    this.settingsService.listAll().subscribe((result: Settings[]) => {
      console.log(result);
      this.types = result;
      this.buildForm();
    });
    if (this.types && this.types.length) {
      this.currentType = this.types.find((t) => {
        return t.buildType.toString() === this.selectedType.toString();
      });
      if (!this.currentType) {
        this.currentType = {} as Settings;
        this.currentType.buildType = this.selectedType;
      }
    } else {
      this.currentType = {} as Settings;
      this.currentType.buildType = this.selectedType;
    }
    console.log('this.currentType', this.currentType);
  }

  onChangeType(type: Settings) {
    this.currentType = type;
  }


}
