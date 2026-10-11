export type WorkflowRun = {
  job: string;
  name: string | null;
  command: string;
  workingDirectory: string | null;
};

export type LocalRun = {
  command: string;
  note: string | null;
};

const BLOCK_INDICATOR = /^(?:\|[+-]?|>[+-]?)$/;

export function parseWorkflowRuns(source: string): WorkflowRun[] {
  const lines = source.split(/\r?\n/);
  const runs: WorkflowRun[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (isBlankOrComment(lines[index]) || indent(lines[index]) !== 0) continue;
    if (!/^jobs:\s*$/.test(lines[index])) continue;

    const jobsEnd = blockEnd(lines, index);
    for (const job of childKeys(lines, index + 1, jobsEnd)) {
      const jobEnd = blockEnd(lines, job.index);
      const steps = childKeys(lines, job.index + 1, jobEnd).find(
        (key) => key.key === "steps",
      );
      if (!steps) continue;
      runs.push(...parseSteps(lines, steps.index, jobEnd, job.key));
    }
  }

  return runs;
}

export function localRunCommand(command: string, platform: NodeJS.Platform): LocalRun {
  if (command.includes("${{")) {
    throw new Error(`GitHub expressions cannot run locally: ${command}`);
  }

  let next = command;
  let note: string | null = null;
  if (
    platform !== "linux" &&
    /\bplaywright\s+install\b/.test(next) &&
    /\s--with-deps\b/.test(next)
  ) {
    next = next.replace(/\s--with-deps\b/g, "");
    note =
      "System packages are installed on the Ubuntu runner, so this machine runs Playwright without --with-deps.";
  }

  if (platform === "win32" && next.includes("\n")) {
    next = next
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .join(" && ");
  }

  return { command: next, note };
}

function parseSteps(
  lines: string[],
  stepsIndex: number,
  blockLimit: number,
  job: string,
): WorkflowRun[] {
  const runs: WorkflowRun[] = [];
  const headerIndent = indent(lines[stepsIndex]);
  let index = stepsIndex + 1;

  while (index < blockLimit) {
    if (isBlankOrComment(lines[index])) {
      index += 1;
      continue;
    }
    if (indent(lines[index]) <= headerIndent) break;

    const trimmed = lines[index].trim();
    if (!trimmed.startsWith("- ")) {
      index += 1;
      continue;
    }

    const stepIndent = indent(lines[index]);
    const fields = new Map<string, string>();
    let cursor = index + 1;
    readField(
      lines,
      trimmed.slice(2),
      stepIndent,
      cursor,
      blockLimit,
      fields,
      (next) => {
        cursor = next;
      },
    );

    while (cursor < blockLimit) {
      if (isBlankOrComment(lines[cursor])) {
        cursor += 1;
        continue;
      }
      if (indent(lines[cursor]) <= stepIndent) break;
      const text = lines[cursor].trim();
      const keyIndent = indent(lines[cursor]);
      cursor += 1;
      readField(lines, text, keyIndent, cursor, blockLimit, fields, (next) => {
        cursor = next;
      });
    }

    index = cursor;
    const command = fields.get("run")?.trim();
    if (!command) continue;
    runs.push({
      job,
      name: emptyToNull(fields.get("name")),
      command,
      workingDirectory: emptyToNull(fields.get("working-directory")),
    });
  }

  return runs;
}

function readField(
  lines: string[],
  text: string,
  keyIndent: number,
  index: number,
  blockLimit: number,
  fields: Map<string, string>,
  setIndex: (next: number) => void,
) {
  const match = text.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if (!match) return;
  const read = readValue(lines, match[2], keyIndent, index, blockLimit);
  fields.set(match[1], read.value);
  setIndex(read.index);
}

function readValue(
  lines: string[],
  rawValue: string,
  keyIndent: number,
  index: number,
  blockLimit: number,
): { value: string; index: number } {
  const indicator = rawValue.trim();
  if (indicator === "") {
    while (
      index < blockLimit &&
      (isBlankOrComment(lines[index]) || indent(lines[index]) > keyIndent)
    ) {
      index += 1;
    }
    return { value: "", index };
  }

  if (!BLOCK_INDICATOR.test(indicator)) {
    return { value: unquote(indicator), index };
  }

  const collected: string[] = [];
  let contentIndent = -1;
  while (index < blockLimit) {
    if (lines[index]?.trim() === "") {
      let look = index + 1;
      while (look < blockLimit && lines[look]?.trim() === "") look += 1;
      if (look >= blockLimit || indent(lines[look] ?? "") <= keyIndent) break;
      collected.push("");
      index += 1;
      continue;
    }
    if (indent(lines[index]) <= keyIndent) break;
    if (contentIndent === -1) contentIndent = indent(lines[index]);
    collected.push(lines[index].slice(contentIndent));
    index += 1;
  }

  const text = collected.join("\n").replace(/\n+$/, "");
  return {
    value: indicator.startsWith(">") ? fold(text) : text,
    index,
  };
}

function fold(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n");
}

function childKeys(
  lines: string[],
  start: number,
  end: number,
): { key: string; index: number; indent: number }[] {
  let childIndent = -1;
  const keys: { key: string; index: number; indent: number }[] = [];
  for (let index = start; index < end; index += 1) {
    if (isBlankOrComment(lines[index])) continue;
    const lineIndent = indent(lines[index]);
    if (childIndent === -1) childIndent = lineIndent;
    if (lineIndent !== childIndent) continue;
    const match = lines[index].trim().match(/^([A-Za-z0-9_-]+):\s*/);
    if (!match) continue;
    keys.push({ key: match[1], index, indent: lineIndent });
  }
  return keys;
}

function blockEnd(lines: string[], headerIndex: number): number {
  const headerIndent = indent(lines[headerIndex]);
  let index = headerIndex + 1;
  while (index < lines.length) {
    if (isBlankOrComment(lines[index])) {
      index += 1;
      continue;
    }
    if (indent(lines[index]) <= headerIndent) break;
    index += 1;
  }
  return index;
}

function indent(line: string): number {
  return line.match(/^[ \t]*/)?.[0].length ?? 0;
}

function isBlankOrComment(line: string | undefined): boolean {
  if (!line) return true;
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
