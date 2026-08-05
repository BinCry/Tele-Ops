import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PERMISSIONS, Permission } from './permissions';

const ROLE_PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.serverView,
    PERMISSIONS.dockerView,
    PERMISSIONS.logsView,
    PERMISSIONS.deployRun,
    PERMISSIONS.databaseView,
    PERMISSIONS.backupRun,
    PERMISSIONS.monitoringView,
    PERMISSIONS.usersManage,
    PERMISSIONS.auditView,
  ],
  OPERATOR: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.serverView,
    PERMISSIONS.dockerView,
    PERMISSIONS.logsView,
    PERMISSIONS.deployRun,
    PERMISSIONS.databaseView,
    PERMISSIONS.backupRun,
    PERMISSIONS.monitoringView,
  ],
  VIEWER: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.serverView,
    PERMISSIONS.logsView,
    PERMISSIONS.monitoringView,
    PERMISSIONS.auditView,
  ],
};

@Injectable()
export class RbacService {
  hasPermission(role: UserRole, permission: Permission): boolean {
    return ROLE_PERMISSION_MATRIX[role].includes(permission);
  }

  getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSION_MATRIX[role];
  }
}
