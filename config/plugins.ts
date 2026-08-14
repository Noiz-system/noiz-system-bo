import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        httpOnly: true,
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes: deniedExecutableTypes,
      },
    },
  },
  /**
   * SMTP via nodemailer. Le provider `sendmail` par défaut suppose un MTA local
   * et ne délivre rien en conteneur — on passe donc par le SMTP de Resend, déjà
   * utilisé par les Cloud Functions BD Market (hôte `smtp.resend.com`, port 587,
   * utilisateur `resend`, mot de passe = la clé d'API Resend).
   *
   * Sans SMTP_HOST, l'envoi échoue proprement et la création du ticket continue.
   */
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST'),
        port: env.int('SMTP_PORT', 587),
        // 587 utilise STARTTLS : `secure` doit rester false, sinon la
        // négociation TLS échoue avant l'authentification.
        secure: env.bool('SMTP_SECURE', false),
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
      },
      settings: {
        defaultFrom: env('SMTP_DEFAULT_FROM'),
        defaultReplyTo: env('SMTP_DEFAULT_REPLY_TO', env('SMTP_DEFAULT_FROM')),
      },
    },
  },
});

export default config;
