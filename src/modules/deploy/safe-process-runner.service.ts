import { execFile } from 'node:child_process';
import { normalize, resolve } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const execFileAsync = promisify(execFile);

export type SafeProcessResult = {
  stdout: string;
  stderr: string;
};

@Injectable()
export class SafeProcessRunner {
  async run(
    executable: string,
    args: string[],
    workingDirectory: string,
  ): Promise<SafeProcessResult> {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      cwd: workingDirectory,
      timeout: 120_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    return {
      stdout,
      stderr,
    };
  }

  resolvePathWithinDirectory(
    rootDirectory: string,
    candidatePath: string,
  ): string {
    const normalizedRoot = normalize(resolve(rootDirectory));
    const resolvedCandidate = normalize(resolve(rootDirectory, candidatePath));

    if (
      resolvedCandidate !== normalizedRoot &&
      !resolvedCandidate.startsWith(`${normalizedRoot}\\`) &&
      !resolvedCandidate.startsWith(`${normalizedRoot}/`)
    ) {
      throw new Error('Resolved path escapes the deployment target directory.');
    }

    return resolvedCandidate;
  }
}
