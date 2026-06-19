const nodemailer = require('nodemailer');

async function generateCredentials() {
  const testAccount = await nodemailer.createTestAccount();
  console.log('Ethereal test credentials generated!');
  console.log('Add these to your .env file:');
  console.log('EMAIL_USER=' + testAccount.user);
  console.log('EMAIL_PASS=' + testAccount.pass);
}

generateCredentials().catch(console.error);
