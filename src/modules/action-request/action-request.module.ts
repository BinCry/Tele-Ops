import { Module } from '@nestjs/common';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { ActionRequestService } from './action-request.service';

@Module({
  imports: [SettingsModule],
  providers: [ActionRequestService],
  exports: [ActionRequestService],
})
export class ActionRequestModule {}
