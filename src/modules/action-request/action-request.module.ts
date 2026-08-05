import { Module } from '@nestjs/common';
import { ActionRequestService } from './action-request.service';

@Module({
  providers: [ActionRequestService],
  exports: [ActionRequestService],
})
export class ActionRequestModule {}
