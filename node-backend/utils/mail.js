const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

async function sendUserRegistrationVerificationEmail(user) {
  const content = `Dear ${user.username},<br><br>` +
    `<p>Thank you for joining us! We are glad to have you on board.</p><br>` +
    `<p>To complete the sign up process, enter the verification code in your device.</p><br>` +
    `<p>verification code: <strong>${user.verification_code}</strong></p><br>` +
    `<p><strong>Please note that the above verification code will be expired within 15 minutes.</strong></p>` +
    `<br>Thank you,<br>Your company name.`;

  await transporter.sendMail({
    from: `"Company" <${process.env.MAIL_USER}>`,
    to: user.email,
    subject: 'Please verify your registration',
    html: content,
  });
}

async function sendForgotPasswordVerificationEmail(user) {
  const content = `Dear ${user.username},<br><br>` +
    `<p>To change your password, enter the verification code in your device.</p><br>` +
    `<p>verification code: <strong>${user.verification_code}</strong></p><br>` +
    `<p><strong>Please note that the above verification code will be expired within 15 minutes.</strong></p>` +
    `<br>Thank you,<br>Your company name.`;

  await transporter.sendMail({
    from: `"Company" <${process.env.MAIL_USER}>`,
    to: user.email,
    subject: 'Forgot password - Please verify your Account',
    html: content,
  });
}

module.exports = { sendUserRegistrationVerificationEmail, sendForgotPasswordVerificationEmail };
