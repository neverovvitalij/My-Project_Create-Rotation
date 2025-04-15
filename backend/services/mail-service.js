const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class MailService {
  async sendActivationMail(userEmail, userLink, adminEmail, adminLink) {
    // Email to user
    const msgUser = {
      to: userEmail,
      from: process.env.SENDGRID_SENDER,
      subject: 'Activation link for ' + process.env.API_URL,
      text: `Please activate your account using the following link: ${userLink}`,
      html: `
        <div>
          <h1>Please activate your account</h1>
          <a href="${userLink}">${userLink}</a>
        </div>
      `,
    };

    // Email to administrator
    const msgAdmin = {
      to: adminEmail,
      from: process.env.SENDGRID_SENDER,
      subject: 'A new user requires approval',
      text: `A new user has registered. Approve the user by clicking the following link: ${adminLink}`,
      html: `
        <div>
          <h1>A new user has registered</h1>
          <p>Please approve the user by clicking the following link:</p>
          <a href="${adminLink}">${adminLink}</a>
        </div>
      `,
    };

    try {
      await sgMail.send(msgUser);
      await sgMail.send(msgAdmin);
      console.log('Activation emails sent successfully.');
    } catch (error) {
      console.error(
        'Error sending activation email:',
        error.response ? error.response.body : error
      );
      throw error;
    }
  }

  async sendPasswordResetMail(to, link) {
    const msg = {
      to,
      from: process.env.SENDGRID_SENDER,
      subject: 'Reset password',
      text: `Reset your password by clicking the following link: ${link}`,
      html: `
        <div>
          <h1>Reset password</h1>
          <p>Click the following link to reset your password:</p>
          <a href="${link}">${link}</a>
          <p>This link is valid for 1 hour.</p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log('Password reset email sent successfully.');
    } catch (error) {
      console.error(
        'Error sending password reset email:',
        error.response ? error.response.body : error
      );
      throw error;
    }
  }
}

module.exports = new MailService();
