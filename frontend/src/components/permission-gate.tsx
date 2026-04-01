"use client";

import { useAuth } from "@/lib/auth-context";

type PermissionGateProps = {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
