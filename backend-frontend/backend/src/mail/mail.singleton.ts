/**
 * Singleton MailService instance for use outside NestJS DI context
 * (e.g., auth.instance.ts which is initialized before the NestJS app).
 *
 * NestJS modules should use the injected MailService instead.
 */
import { MailService } from './mail.service';

export const mailService = new MailService();
