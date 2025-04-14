import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import * as dotenv from 'dotenv';

dotenv.config(); // This will load the environment variables from the .env file

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
  });

  app.use(morgan('dev'));

  const port = process.env.PORT || 3000; // Use the PORT from the .env file or default to 3000

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
