import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Settings } from '../shared/settings.model';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { SettingsService } from '../shared/settings.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-build-queue',
  templateUrl: './build-queue.component.html',
  styleUrls: ['./build-queue.component.scss']
})
export class BuildQueueComponent implements OnInit {

  @Input() currentType: Settings;
  @Output() onChangeType: EventEmitter<Settings> = new EventEmitter<Settings>();
  buildForm: FormGroup;
  submitted = false;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private settingsService: SettingsService,
    public toastr: ToastrService
  ) { }

  ngOnInit() {
  }

  ngOnChanges(): void {
    this.loadSettings();
  }

  loadSettings() {
    if (this.currentType) {
      this.buildForm = this.fb.group({
        maxParallel: [this.currentType.maxParallel, Validators.required],
      });
      if (this.currentType._id) {
        this.settingsService.listById(this.currentType._id).subscribe((settings: Settings) => {
          this.currentType = settings;
        });
      }
    }
  }

  onSubmit() {
    this.submitted = true;
    if (this.buildForm.invalid) {
      return;
    }
    this.currentType = Object.assign({} as Settings, this.currentType, this.buildForm.value);
    if (!this.currentType._id) {
      this.loading = true;
      this.settingsService.create(this.currentType).subscribe((settings: Settings) => {
        this.loading = false;
        this.currentType = settings;
        this.onChangeType.emit(this.currentType);
        this.toastr.success('Settings created!');
      });
    } else {
      this.loading = true;
      this.settingsService.update(this.currentType).subscribe(() => {
        this.loading = false;
        console.log(this.currentType);
        this.onChangeType.emit(this.currentType);
        this.toastr.success('Settings updated!');
      });
    }
  }


}
