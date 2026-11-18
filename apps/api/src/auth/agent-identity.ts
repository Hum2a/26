import type { AppEnvironment } from "@26/shared";

const agentDomain = "agents.26.humza.invalid";
const agentName = /^[a-z][a-z0-9-]{0,31}$/;

export function agentAdminEmail(environment: AppEnvironment, name: string) {
  if ((environment !== "local" && environment !== "staging") || !agentName.test(name))
    return undefined;
  return `${name}.${environment}@${agentDomain}`;
}

export function isAgentIdentity(email: string) {
  return email.toLowerCase().endsWith(`@${agentDomain}`);
}

export function isAgentAdministrator(environment: AppEnvironment, email: string) {
  const name = email.split(".")[0];
  return !!name && agentAdminEmail(environment, name) === email;
}
