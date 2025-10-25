export type SettingsTab = {
  id: string;
  name: string;
  description: string;
  status: "ok" | "review" | "setup";
  owner: string;
};

export type RoleDefinition = {
  id: string;
  name: string;
  members: number;
  scope: string;
  permissions: string[];
  critical?: boolean;
};

export type ShiftPolicy = {
  id: string;
  name: string;
  description: string;
  requirement: string;
  lastUpdated: string;
};

export type IntegrationConfig = {
  id: string;
  name: string;
  provider: string;
  status: "connected" | "warning" | "disconnected";
  lastSync: string;
  detail: string;
};

export type NotificationPreference = {
  id: string;
  channel: string;
  usage: string;
  enabled: boolean;
  recipients: string[];
};

export type AuditSnapshot = {
  id: string;
  event: string;
  actor: string;
  scope: string;
  timestamp: string;
  status: "logged" | "warning" | "error";
};
