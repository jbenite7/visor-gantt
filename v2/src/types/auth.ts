export interface AuthUser {
  id: string;
  email: string;
  name: string;
  provider: "password" | "microsoft";
  roles: string[];
}

export type PermissionKey =
  | "project:read"
  | "project:create"
  | "project:update"
  | "project:delete"
  | "auth:manage"
  | "rbac:manage";
