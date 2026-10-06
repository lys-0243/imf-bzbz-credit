import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'agent.a@imf.local',
    description: 'Email du compte IMF (démo : reception@imf.local, agent.a@imf.local, …)',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Agent1!',
    minLength: 4,
    description: 'Mot de passe du compte',
  })
  @IsString()
  @MinLength(4)
  password!: string;
}
