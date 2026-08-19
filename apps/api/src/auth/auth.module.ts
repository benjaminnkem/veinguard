import { Global, Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AuditService],
  exports: [AuthService, AuthGuard, AuditService],
})
export class AuthModule {}
