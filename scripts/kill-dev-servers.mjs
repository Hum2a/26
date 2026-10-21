#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { platform } from "node:os";

const DEV_PROCESS_NAMES = new Set([
  "node",
  "node.exe",
  "workerd",
  "workerd.exe",
  "esbuild",
  "esbuild.exe",
]);
const DEV_COMMAND_PATTERNS = [
  /\bvite\b/i,
  /\bwrangler\b/i,
  /\bworkerd\b/i,
  /\bminiflare\b/i,
  /\b@cloudflare\/vite-plugin\b/i,
  /\breact-scripts\b.*\bstart\b/i,
  /\bnext\b.*\bdev\b/i,
  /\bwebpack-dev-server\b/i,
  /\bastro\b.*\bdev\b/i,
  /\bnpm\b.*\brun\b.*\bdev\b/i,
  /\bpnpm\b.*\bdev\b/i,
  /\byarn\b.*\bdev\b/i,
];

function isDevCommandLine(commandLine) {
  if (!commandLine) {
    return false;
  }
  return DEV_COMMAND_PATTERNS.some((pattern) => pattern.test(commandLine));
}

function uniqueTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.pid}:${target.name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function killTargets(targets) {
  if (targets.length === 0) {
    console.log("No dev server processes found.");
    return;
  }

  for (const target of targets) {
    const label = target.port
      ? `${target.name} (pid ${target.pid}, port ${target.port})`
      : `${target.name} (pid ${target.pid})`;
    try {
      if (platform() === "win32") {
        execFileSync("taskkill", ["/PID", String(target.pid), "/T", "/F"], {
          stdio: "pipe",
        });
      } else {
        execFileSync("kill", ["-TERM", String(target.pid)], { stdio: "pipe" });
      }
      console.log(`Stopped ${label}`);
    } catch {
      console.warn(`Could not stop ${label}`);
    }
  }
}

function findWindowsTargets() {
  const processes = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json -Compress",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );

  const parsed = JSON.parse(processes || "[]");
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const listeningPorts = getWindowsListeningPorts();

  const targets = [];
  for (const row of rows) {
    const name = String(row.Name ?? "");
    const pid = Number(row.ProcessId);
    const commandLine = String(row.CommandLine ?? "");
    if (!pid || !DEV_PROCESS_NAMES.has(name.toLowerCase())) {
      continue;
    }
    if (!isDevCommandLine(commandLine)) {
      continue;
    }
    const ports = listeningPorts.get(pid) ?? [];
    if (ports.length === 0) {
      targets.push({ pid, name, port: undefined, commandLine });
      continue;
    }
    for (const port of ports) {
      targets.push({ pid, name, port, commandLine });
    }
  }

  return uniqueTargets(targets);
}

function getWindowsListeningPorts() {
  const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
  const portsByPid = new Map();

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) {
      continue;
    }
    const localAddress = parts[1];
    const pid = Number(parts[parts.length - 1]);
    if (!pid) {
      continue;
    }
    const port = Number(localAddress.split(":").at(-1));
    if (!port) {
      continue;
    }
    const ports = portsByPid.get(pid) ?? [];
    ports.push(port);
    portsByPid.set(pid, ports);
  }

  return portsByPid;
}

function findUnixTargets() {
  const output = execFileSync("ps", ["-axo", "pid=,comm=,command="], {
    encoding: "utf8",
  });
  const listeningPorts = getUnixListeningPorts();
  const targets = [];

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^(\d+)\s+(\S+)\s+(.*)$/);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    const name = match[2];
    const commandLine = match[3];
    if (!DEV_PROCESS_NAMES.has(name) && !DEV_PROCESS_NAMES.has(`${name}.exe`)) {
      continue;
    }
    if (!isDevCommandLine(commandLine)) {
      continue;
    }
    const ports = listeningPorts.get(pid) ?? [];
    if (ports.length === 0) {
      targets.push({ pid, name, port: undefined, commandLine });
      continue;
    }
    for (const port of ports) {
      targets.push({ pid, name, port, commandLine });
    }
  }

  return uniqueTargets(targets);
}

function getUnixListeningPorts() {
  let output = "";
  try {
    output = execFileSync("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return new Map();
  }

  const portsByPid = new Map();
  let pid;
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
      continue;
    }
    if (line.startsWith("n") && pid) {
      const portMatch = line.match(/:(\d+)$/);
      if (!portMatch) {
        continue;
      }
      const port = Number(portMatch[1]);
      const ports = portsByPid.get(pid) ?? [];
      ports.push(port);
      portsByPid.set(pid, ports);
    }
  }

  return portsByPid;
}

const targets = platform() === "win32" ? findWindowsTargets() : findUnixTargets();
killTargets(targets);
