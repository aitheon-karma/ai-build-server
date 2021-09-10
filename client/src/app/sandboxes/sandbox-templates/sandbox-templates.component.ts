import { Component, OnInit } from '@angular/core';
import { SandboxesService } from '../shared/sandboxes.service';
import { SandboxSettings } from '../shared/sandbox-settings.model';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-sandbox-templates',
  templateUrl: './sandbox-templates.component.html',
  styleUrls: ['./sandbox-templates.component.scss']
})
export class SandboxTemplatesComponent implements OnInit {

  settings: SandboxSettings;
  loading = false;
  settingsForm: FormGroup;
  submitted = false;
  error: string;

  constructor(
    private sandboxesService: SandboxesService,
    private toastr: ToastrService,
    private fb: FormBuilder,
  ) { }

  ngOnInit() {
    this.sandboxesService.getSettings().subscribe((settings: SandboxSettings) => {
      this.settings = settings;
      this.buildForm(this.settings);
    });
  }

  buildForm(sandboxSettings: SandboxSettings) {
    this.settingsForm = this.fb.group({
      sandboxRunnerVersion: [sandboxSettings.sandboxRunnerVersion, [Validators.required]],
      sandboxVersion: [sandboxSettings.sandboxVersion, [Validators.required]],
      maxAvailableHotSandboxes: [sandboxSettings.maxAvailableHotSandboxes, [Validators.required]]
    });
  }

  onSubmit() {
    this.submitted = true;
    if (this.settingsForm.invalid) {
      return;
    }
    const settings = Object.assign({}, this.settings, this.settingsForm.value);

    this.error = null;
    this.sandboxesService.saveSettings(settings).subscribe((result: SandboxSettings) => {
      this.submitted = false;
      this.settings = result;
      this.toastr.success('Settings saved');
    }, (err) => {
      this.submitted = false;
      this.error = err;
    });
  }

  updateHotSandboxImage() {
    this.sandboxesService.updateHotSandboxImage().subscribe(() => {
      this.toastr.success('Updated');
    }, (err) => {
      this.toastr.error(err);
    });
  }

  terminateAllTemplates() {
    if (confirm('Sure?')) {
      this.sandboxesService.terminateAllTemplates().subscribe(() => {
        this.toastr.success('Hot Template Terminated');
      }, (err) => {
        this.toastr.error(err);
      });
    }
  }

}
