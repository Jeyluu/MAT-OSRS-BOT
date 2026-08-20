import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { getHttpPort } from './config/http-port';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const port = getHttpPort(app.get(ConfigService).get<string>('PORT'));

  await app.listen(port);
}
void bootstrap();
