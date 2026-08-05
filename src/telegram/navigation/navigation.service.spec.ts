import { UserRole } from '@prisma/client';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { TelegramNavigationService } from './navigation.service';

describe('TelegramNavigationService', () => {
  const service = new TelegramNavigationService(new RbacService());

  it('hides privileged actions from viewers', () => {
    const screen = service.buildHomeScreen({
      displayName: 'Viewer User',
      role: UserRole.VIEWER,
    });

    const buttonTexts = screen.keyboard.inline_keyboard
      .flat()
      .map((button) => button.text);

    expect(buttonTexts).toContain('📊 Dashboard');
    expect(buttonTexts).not.toContain('🚀 Deploy');
    expect(buttonTexts).not.toContain('👥 Users');
    expect(buttonTexts).not.toContain('⚙️ Settings');
  });
});
