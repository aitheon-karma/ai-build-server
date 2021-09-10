import { Pipe, PipeTransform } from '@angular/core';
import { Build } from '@aitheon/build-server';

@Pipe({
  name: 'buildStatusIcon'
})
export class BuildStatusIconPipe implements PipeTransform {

  transform(value: Build.StatusEnum, args?: any): any {
    switch (value) {
      case Build.StatusEnum.SUCCESS:
        return 'fa-check-circle';
      case Build.StatusEnum.ERROR:
        return 'fa-exclamation-triangle';
      case Build.StatusEnum.PENDING:
        return 'fa-clock-o';
      case Build.StatusEnum.IN_PROGRESS:
        return 'fa-cog fa-spin';
      case Build.StatusEnum.CANCELED:
        return 'fa-times';
    }
    return '';
  }

}
