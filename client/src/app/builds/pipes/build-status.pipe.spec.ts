import { BuildStatusPipe } from './build-status.pipe';

describe('BuildStatusPipe', () => {
  it('create an instance', () => {
    const pipe = new BuildStatusPipe();
    expect(pipe).toBeTruthy();
  });
});
