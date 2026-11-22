import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function configureApp(app: INestApplication) {
  app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000" });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const config = new DocumentBuilder().setTitle("Mini shop API").build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  return app;
}
