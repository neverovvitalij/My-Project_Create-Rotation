// services/mail-service.js
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

  async sendActivationMail(userEmail, userLink, adminEmail, adminLink) {
    const messages = [
      {
        From: this.from,
        To: [{ Email: userEmail }],
        Subject: `Activation link for ${process.env.API_URL}`,
        HTMLPart: `
          <div>
            <h1>Please activate your account</h1>
            <a href="${userLink}">${userLink}</a>
          </div>
        `,
        TextPart: `Please activate your account using the following link: ${userLink}`,
      },
      {
        From: this.from,
        To: [{ Email: adminEmail }],
        Subject: 'A new user requires approval',
        HTMLPart: `
          <div>
            <h1>A new user ${userEmail} has registered</h1>
            <p>Please approve the user by clicking the following link:</p>
            <a href="${adminLink}">${adminLink}</a>
          </div>
        `,
        TextPart: `A new user has registered. Approve the user by clicking: ${adminLink}`,
      },
    ];

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({ Messages: messages });
      console.log('Activation emails sent via Mailjet');
    } catch (e) {
      console.error('Mailjet activation email error:', e?.response?.data || e);
      throw e;
    }
  }

  async sendPasswordResetMail(toEmail, resetLink) {
    const message = {
      From: this.from,
      To: [{ Email: toEmail }],
      Subject: 'Reset password',
      HTMLPart: `
        <div>
          <h1>Reset password</h1>
          <p>Click the following link to reset your password (valid for 1 hour):</p>
          <a href="${resetLink}">${resetLink}</a>
        </div>
      `,
      TextPart: `Reset your password using the link (valid 1 hour): ${resetLink}`,
    };

    try {
      await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({ Messages: [message] });
      console.log('Password‑reset email sent via Mailjet');
    } catch (e) {
      console.error(
        'Mailjet password‑reset email error:',
        e?.response?.data || e
      );
      throw e;
    }
  }
}

module.exports = new MailService();
