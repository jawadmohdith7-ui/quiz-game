import nodemailer from "nodemailer";

const transporter =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

export async function sendVerificationEmail(toEmail, username, code) {
  if (!transporter) {
    console.log("========================================");
    console.log(`[EMAIL DEV] Destinatari: ${toEmail} (${username})`);
    console.log(`[EMAIL DEV] Codi de verificació: ${code}`);
    console.log("========================================");
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"HowMuch" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Codi de verificació del teu compte",
    text: `Hola ${username},\n\nEl teu codi de verificació és: ${code}\nCaduca en 15 minuts.`,
    html: `<p>Hola <strong>${username}</strong>,</p><p>El teu codi de verificació és:</p><h2>${code}</h2><p>Caduca en 15 minuts.</p>`,
  });
}
