const nodemailer = require('nodemailer');

class MailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendActivationMail(userEmail, userLink, adminMail, adminLink) {
    //Email to user
    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: userEmail,
      subject: 'Activation link for ' + process.env.API_URL,
      text: '',
      html: `
        <div>
          <h1>Please activate your account</h1>
          <a href="${userLink}">${userLink}</a>
        </div>
      `,
    });

    // Email to administrator
    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: adminMail,
      subject: 'A new user requires approval',
      text: '',
      html: `
        <div>
          <h1>A new user has registered</h1>
          <p>Please approve the user by clicking the following link:</p>
          <a href="${adminLink}">${adminLink}</a>
        </div>
      `,
    });
  }

  async sendPasswordResetMail(to, link) {
    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: 'Reset password',
      html: `
      <div>
        <h1>Reset password</h1>
        <p>Click the following link to reset your password:</p>
        <a href="${link}">${link}</a>
        <p>This link is valid for 1 hour</p>
      </div>
      `,
    });
  }
}

module.exports = new MailService();
