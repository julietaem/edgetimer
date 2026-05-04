import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CitasModule } from './citas/citas.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, CitasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
