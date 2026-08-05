import { SafeProcessRunner } from './safe-process-runner.service';

describe('SafeProcessRunner', () => {
  it('rejects compose paths that escape the target directory', () => {
    const runner = new SafeProcessRunner();

    expect(() =>
      runner.resolvePathWithinDirectory('/opt/teleops', '../secret.yml'),
    ).toThrow('Resolved path escapes the deployment target directory.');
  });
});
