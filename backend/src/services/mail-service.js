const Mailjet = require('node-mailjet');

class MailService {
  constructor() {
    this.mailjet = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY,
      process.env.MAILJET_API_SECRET
    );
    this.from = {
      Email: process.env.MAILJET_SENDER_EMAIL,
      Name: process.env.MAILJET_SENDER_NAME || 'Rotation Plan Service',
    };
  }

  async sendActivationMail(
    userEmail,
    userLink,
    adminEmail,
    adminLink,
    role,
    costCenter,
    shift,
    plant
  ) {
    const brand = 'Rotation Plan Service';

    const messages = [
      {
        From: this.from,
        To: [{ Email: userEmail }],
        Subject: `Confirm your account — ${brand}`,
        HTMLPart: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827">
            <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Welcome to ${brand}</h1>
            <p style="margin:0 0 16px;">Hi ${userEmail},</p>
            <p style="margin:0 0 16px;">Please confirm your email address to activate your account.</p>
            <p style="margin:0 0 20px;">
              <a href="${userLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">Confirm my account</a>
            </p>
            <p style="margin:0 0 8px;">If the button doesn’t work, copy and paste this link into your browser:</p>
            <p style="margin:0 20px 16px;word-break:break-all;">
              <a href="${userLink}" style="color:#2563eb;">${userLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
            <p style="margin:0;color:#6b7280;font-size:12px;">If you didn’t create this account, you can safely ignore this email.</p>
          </div>
        `,
        TextPart: [
          `Welcome to ${brand}`,
          ``,
          `Please confirm your email to activate your account:`,
          `${userLink}`,
          ``,
          `If you didn’t create this account, ignore this message.`,
        ].join('\n'),
      },

      {
        From: this.from,
        To: [{ Email: adminEmail }],
        Subject: `New user pending approval — ${brand}`,
        HTMLPart: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827">
            <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">New user awaiting approval</h1>
            <p style="margin:0 0 10px;"><strong>User:</strong> ${userEmail}</p>
            <p style="margin:0 0 16px;"><strong>Plant:</strong> ${plant} &nbsp; • &nbsp; <strong>Shift:</strong> ${shift} &nbsp; • &nbsp; <strong>CostCenter:</strong> ${costCenter} &nbsp; • &nbsp; <strong>Role:</strong> ${role}</p>
            <p style="margin:0 0 20px;">
              <a href="${adminLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">Approve user</a>
            </p>
            <p style="margin:0 0 8px;">Direct link:</p>
            <p style="margin:0 20px 0;word-break:break-all;">
              <a href="${adminLink}" style="color:#2563eb;">${adminLink}</a>
            </p>
          </div>
        `,
        TextPart: [
          `New user awaiting approval`,
          `User: ${userEmail}`,
          `Plant: ${plant} | Shift: ${shift} | CostCenter: ${costCenter} | Role: ${role}`,
          `Approve: ${adminLink}`,
        ].join('\n'),
      },
    ];

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({ Messages: messages });
      console.log('Activation emails sent via Mailjet');
    } catch (e) {
      console.warn('Admin notify failed:', e?.response?.data || e.message);
    }
  }

  async sendPasswordResetMail(toEmail, resetLink) {
    const brand = 'Rotation Plan Service';

    const message = {
      From: this.from,
      To: [{ Email: toEmail }],
      Subject: `Reset your password — ${brand}`,
      HTMLPart: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827">
          <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Reset your password</h1>
          <p style="margin:0 0 16px;">We received a request to reset the password for <strong>${toEmail}</strong>.</p>
          <p style="margin:0 0 8px;color:#6b7280;">This link is valid for 1 hour.</p>
          <p style="margin:0 0 20px;">
            <a href="${resetLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">Create a new password</a>
          </p>
          <p style="margin:0 0 8px;">If the button doesn’t work, use this link:</p>
          <p style="margin:0 20px 16px;word-break:break-all;">
            <a href="${resetLink}" style="color:#2563eb;">${resetLink}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="margin:0;color:#6b7280;font-size:12px;">If you didn’t request a password reset, you can ignore this email.</p>
        </div>
      `,
      TextPart: [
        `Reset your password — ${brand}`,
        ``,
        `We received a request to reset the password for ${toEmail}.`,
        `This link is valid for 1 hour:`,
        `${resetLink}`,
        ``,
        `If you didn’t request this, ignore this email.`,
      ].join('\n'),
    };

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({ Messages: [message] });
      console.log('Password-reset email sent via Mailjet');
    } catch (e) {
      console.error(
        'Mailjet password-reset email error:',
        e?.response?.data || e
      );
      throw e;
    }
  }

  async sendPasswordChangedMail(toEmail) {
    const brand = 'Rotation Plan Service';

    const message = {
      From: this.from,
      To: [{ Email: toEmail }],
      Subject: `Your password was changed — ${brand}`,
      HTMLPart: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111827">
          <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Password changed</h1>
          <p style="margin:0 0 16px;">This is a confirmation that your password for <strong>${toEmail}</strong> has been changed.</p>
          <p style="margin:0 0 16px;">If you did not make this change, please reset your password immediately or contact support.</p>
          <p style="margin:0;color:#6b7280;font-size:12px;">This is an automated message; no reply is necessary.</p>
        </div>
      `,
      TextPart: [
        `Password changed — ${brand}`,
        ``,
        `Your password for ${toEmail} has been changed.`,
        `If this wasn't you, reset your password immediately or contact support.`,
      ].join('\n'),
    };

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({ Messages: [message] });
      console.log('Password-changed confirmation email sent');
    } catch (e) {
      console.error(
        'Error sending password-changed email:',
        e?.response?.data || e
      );
    }
  }
}

module.exports = new MailService();
