import { UserRole } from '@prisma/client';
import { PERMISSIONS } from './permissions';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  const service = new RbacService();

  it('grants owner access to settings management', () => {
    expect(
      service.hasPermission(UserRole.OWNER, PERMISSIONS.settingsManage),
    ).toBe(true);
  });

  it('denies viewer access to deployments', () => {
    expect(service.hasPermission(UserRole.VIEWER, PERMISSIONS.deployRun)).toBe(
      false,
    );
  });

  it('allows operator access to docker and backup actions', () => {
    expect(
      service.hasPermission(UserRole.OPERATOR, PERMISSIONS.dockerView),
    ).toBe(true);
    expect(
      service.hasPermission(UserRole.OPERATOR, PERMISSIONS.dockerManage),
    ).toBe(true);
    expect(
      service.hasPermission(UserRole.OPERATOR, PERMISSIONS.backupRun),
    ).toBe(true);
  });
});
