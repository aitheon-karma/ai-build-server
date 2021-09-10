import { Pipe, PipeTransform } from '@angular/core';
import { Build } from '@aitheon/build-server';

@Pipe({
  name: 'buildStatus'
})
export class BuildStatusPipe implements PipeTransform {

  transform(value: Build.StatusEnum, args?: any): any {
    switch (value) {
      case Build.StatusEnum.SUCCESS:
        return 'text-success';
      case Build.StatusEnum.ERROR:
        return 'text-danger';
      case Build.StatusEnum.IN_PROGRESS:
        return 'text-primary';
    }
    return '';
  }

}
