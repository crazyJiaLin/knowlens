import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SmsCode, SmsCodeSchema } from './schemas/sms-code.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AliyunModule } from '../aliyun/aliyun.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SmsCode.name, schema: SmsCodeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret =
          configService.get<string>('jwt.secret') ||
          'your-jwt-secret-key-at-least-32-characters';
        const expiresIn: string =
          configService.get<string>('jwt.expiresIn') || '7d';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as string | number,
          },
        } as JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
    AliyunModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
