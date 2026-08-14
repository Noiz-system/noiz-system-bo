import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::support.support', () => ({
  /**
   * `status` is driven from the back-office only: a ticket submitted from an app
   * always lands as `opened`, whatever the client sends.
   */
  async create(ctx) {
    const data = ctx.request.body?.data ?? {};

    ctx.request.body = { ...ctx.request.body, data: { ...data, status: 'opened' } };

    return super.create(ctx);
  },
}));
