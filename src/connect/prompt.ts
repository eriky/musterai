// File: src/connect/prompt.ts
//
// Minimal masked stdin prompt for pasting a PAT into `muster login` without
// echoing it to the terminal/scrollback.

import readline from 'node:readline';

export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const output = rl as unknown as { _writeToOutput?: (s: string) => void };
    let muted = false;
    output._writeToOutput = (str: string) => {
      if (!muted || str === '\n' || str === '\r\n') {
        process.stdout.write(str);
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = true;
  });
}

export function promptVisible(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
