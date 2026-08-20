import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DISCORD_CLIENT } from './../src/discord/discord.constants';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let discordClient: {
    destroy: jest.Mock;
    login: jest.Mock;
    on: jest.Mock;
    once: jest.Mock;
  };

  beforeEach(async () => {
    discordClient = {
      destroy: jest.fn(),
      login: jest.fn().mockResolvedValue('discord-token'),
      on: jest.fn(),
      once: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DISCORD_CLIENT)
      .useValue(discordClient)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  afterEach(async () => {
    await app.close();
    expect(discordClient.destroy).toHaveBeenCalledTimes(1);
  });
});
