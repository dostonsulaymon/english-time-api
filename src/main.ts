import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

dotenv.config(); // This will load the environment variables from the .env file

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: '*',
  });

  app.useStaticAssets(join(process.cwd(), 'public'));

  app.setViewEngine('ejs');
  app.setBaseViewsDir(join(process.cwd(), 'view'));

  // app.use(morgan('dev'));




  const port = process.env.PORT || 3000; // Use the PORT from the .env file or default to 3000

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
