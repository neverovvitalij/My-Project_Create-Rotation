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
            <h2> Plant: ${plant}, Shift: ${shift}, CostCenter: ${costCenter}, Role: ${role}</h2>
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
      console.warn('Admin notify failed:', e?.response?.data || e.message);
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

  async sendPasswordChangedMail(toEmail) {
    const message = {
      From: this.from,
      To: [{ Email: toEmail }],
      Subject: 'Your password has been changed',
      HTMLPart: `
        <div>
          <h1>Password Changed</h1>
          <p>Your password was successfully changed. If you did not do this, please contact support immediately.</p>
        </div>
      `,
      TextPart: `Your password was successfully changed. If you did not do this, please contact support immediately.`,
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
