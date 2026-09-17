import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, RolesGuard } from './roles.guard';

@Controller()
export class IdentityController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPTION, Role.AGENT)
  me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }
}
