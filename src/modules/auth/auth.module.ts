import { Module } from '@nestjs/common';
import { UsersModule } from 'src/modules/users/users.module';
import { AuthBootstrapService } from './auth-bootstrap.service';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule],
  providers: [AuthBootstrapService, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
