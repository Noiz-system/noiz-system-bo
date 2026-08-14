/**
 * Notification e-mail à l'équipe support à chaque nouveau ticket.
 *
 * Configuration : SUPPORT_NOTIFICATION_EMAIL (destinataire) + les variables
 * SMTP_* consommées par `config/plugins.ts`. Sans destinataire, rien n'est
 * envoyé — la création du ticket reste évidemment inchangée.
 */

interface SupportRecord {
  id?: number;
  documentId?: string;
  type?: string;
  status?: string;
  name?: string;
  firstname?: string;
  email?: string;
  subject?: string;
  message?: string;
}

/** Neutralise le HTML fourni par le visiteur avant de l'injecter dans le corps du mail. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmail(ticket: SupportRecord) {
  const fullName = [ticket.firstname, ticket.name].filter(Boolean).join(' ').trim() || 'Client';
  const subject = ticket.subject ?? 'Sans sujet';
  const message = ticket.message ?? '';
  const from = `${fullName} <${ticket.email ?? 'adresse inconnue'}>`;

  const text = [
    `Application : ${ticket.type ?? 'inconnue'}`,
    `De : ${from}`,
    `Sujet : ${subject}`,
    '',
    message,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Nouveau ticket de support</h2>
      <p>
        <strong>Application :</strong> ${escapeHtml(ticket.type ?? 'inconnue')}<br />
        <strong>De :</strong> ${escapeHtml(from)}<br />
        <strong>Sujet :</strong> ${escapeHtml(subject)}
      </p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  return { subject: `[Support ${ticket.type ?? '?'}] ${subject}`, text, html };
}

export default {
  /**
   * L'envoi est encapsulé : un SMTP indisponible ne doit jamais faire échouer
   * l'enregistrement d'un ticket déjà accepté côté client.
   */
  async afterCreate(event: { result: SupportRecord }) {
    const recipient = process.env.SUPPORT_NOTIFICATION_EMAIL;
    if (!recipient) return;

    const ticket = event.result;

    try {
      await strapi.plugin('email').service('email').send({
        to: recipient,
        // Répondre au mail écrit directement au client qui a ouvert le ticket.
        replyTo: ticket.email,
        ...buildEmail(ticket),
      });
    } catch (error) {
      strapi.log.error(
        `[support] notification e-mail impossible pour le ticket ${ticket.documentId ?? ticket.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  },
};
