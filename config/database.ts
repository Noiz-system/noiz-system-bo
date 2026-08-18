import path from 'path';
import type { Core } from '@strapi/strapi';
import { isDatabaseClientKind } from '@strapi/database';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Database => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  if (!isDatabaseClientKind(client)) {
    throw new Error(
      `Unsupported DATABASE_CLIENT: ${client}. Use "postgres", "mysql", or "sqlite".`
    );
  }

  const connections: Record<Core.Config.Database.ClientKind, Core.Config.Database['connection']> = {
    mysql: {
      client: 'mysql',
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false) && {
          key: env('DATABASE_SSL_KEY', undefined),
          cert: env('DATABASE_SSL_CERT', undefined),
          ca: env('DATABASE_SSL_CA', undefined),
          capath: env('DATABASE_SSL_CAPATH', undefined),
          cipher: env('DATABASE_SSL_CIPHER', undefined),
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },
    /**
     * Deux environnements, une seule configuration :
     *
     *  - développement → champs discrets vers le Postgres de la machine, sans TLS ;
     *  - production    → `DATABASE_URL` fournie par la console Neon, avec TLS.
     *
     * Quand `DATABASE_URL` est renseignée, `pg` la fait gagner sur tout le
     * reste : il fusionne par `Object.assign({}, config, parse(connectionString))`.
     * Les champs discrets ci-dessous sont donc simplement ignorés dans ce
     * mode — ils restent présents parce que le type `SharedConnection` les
     * exige, pas parce qu'ils servent.
     *
     * Le piège du `sslmode` tient à cette même fusion :
     *  - une URL portant `?sslmode=require` définit `ssl` et écrase la valeur
     *    calculée ici — comportement correct, TLS vérifié ;
     *  - une URL SANS `sslmode` laisse au contraire passer le `ssl` ci-dessous.
     *    Avec l'ancien défaut (`DATABASE_SSL` à false), on obtenait `ssl: false`
     *    et Neon refusait la connexion, en exigeant du TLS.
     *
     * D'où le défaut retenu : TLS activé dès qu'une `DATABASE_URL` est
     * présente. Les deux chemins convergent, avec ou sans `sslmode` dans l'URL.
     * `DATABASE_SSL` reste prioritaire pour trancher explicitement.
     */
    postgres: {
      client: 'postgres',
      connection: {
        connectionString: env('DATABASE_URL'),
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', Boolean(env('DATABASE_URL'))) && {
          key: env('DATABASE_SSL_KEY', undefined),
          cert: env('DATABASE_SSL_CERT', undefined),
          ca: env('DATABASE_SSL_CA', undefined),
          capath: env('DATABASE_SSL_CAPATH', undefined),
          cipher: env('DATABASE_SSL_CIPHER', undefined),
          // Neon présente un certificat d'autorité publique : la vérification
          // passe sans CA à installer. Ne descendre à false que pour dépanner.
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
        schema: env('DATABASE_SCHEMA', 'public'),
      },
      /**
       * Neon suspend le compute au repos et ferme les connexions inactives :
       * garder un minimum ouvert provoque des erreurs au réveil. On vise donc
       * `DATABASE_POOL_MIN=0` en production (voir .env.example).
       */
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },
    sqlite: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  return {
    connection: {
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};

export default config;
