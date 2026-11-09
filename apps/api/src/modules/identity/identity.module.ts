import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtSecret } from '../../config';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as `${number}d`,
      },
    }),
  ],
  controllers: [IdentityController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class IdentityModule {}
