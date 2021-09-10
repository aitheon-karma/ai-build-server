import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { Settings, Language } from '../shared/settings.model';
import { SettingsService } from '../shared/settings.service';
import { MonacoFile } from 'ngx-monaco';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-docker',
  templateUrl: './docker.component.html',
  styleUrls: ['./docker.component.scss']
})
export class DockerComponent implements OnInit {

  @Input() currentType: Settings;
  @Output() onChangeType: EventEmitter<Settings> = new EventEmitter<Settings>();
  monacoOptions = { theme: 'vs-light' };
  settingsForm: FormGroup;
  submitted = false;
  loading = false;
  languages: any[] = [
    { id: Language.JAVASCRIPT, name: 'JavaScript' },
    { id: Language.PYTHON, name: 'Python' },
    { id: Language.BLOCKLY, name: 'Blockly' },
    { id: Language.C, name: 'C' },
    { id: Language.CPP, name: 'C++' }
  ];

  file: MonacoFile = {
    uri: 'index.js',
    language: 'javascript',
    content: ''
  };
  dockerFile: String;

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
      this.settingsForm = this.fb.group({
        languages: [this.currentType.languages, Validators.required],
      });
      if (this.currentType._id) {
        this.settingsService.listById(this.currentType._id).subscribe((settings: Settings) => {
          this.currentType = settings;
          this.file = {
            ...this.file,
            content: this.currentType.dockerFile,
            language: 'dockerfile'
          };
        });
      }

    }
  }

  onSubmit() {
    this.submitted = true;
    if (this.settingsForm.invalid) {
      return;
    }

    this.currentType = Object.assign({} as Settings, this.currentType, this.settingsForm.value, { dockerFile: this.dockerFile });

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
        this.onChangeType.emit(this.currentType);
        this.toastr.success('Settings updated!');
      });
    }
  }

  onFileChange(file: MonacoFile) {
    this.dockerFile = file.content;
  }



}
