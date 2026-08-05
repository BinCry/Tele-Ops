import { Module } from '@nestjs/common';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

@Module({
  providers: [
    TelegramMenuRenderer,
    TelegramNavigationService,
    TelegramService,
    TelegramUpdate,
  ],
})
export class TelegramModule {}
