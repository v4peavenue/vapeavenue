import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = process.env.NODE_ENV === "production" ? Number(process.env.PORT || 8080) : 3000;

  app.use(express.json());

  // API health route
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Test SMTP connection endpoint
  app.post("/api/test-smtp", async (req, res) => {
    try {
      const { smtpConfig } = req.body;
      const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
      const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
      const secure = smtpConfig?.secure !== undefined ? smtpConfig.secure : (port === 465);
      const user = smtpConfig?.user || process.env.SMTP_USER;
      const pass = smtpConfig?.pass || process.env.SMTP_PASS;

      if (!user || !pass) {
        return res.status(400).json({ error: "Username/email and password are required" });
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
      });

      await transporter.verify();
      return res.json({ success: true, message: "SMTP connection verified successfully!" });
    } catch (error: any) {
      console.error("[SMTP Test] Error verifying connection:", error);
      return res.status(500).json({ 
        success: false, 
        error: error?.message || "Failed to verify SMTP credentials. Please check your email and app password." 
      });
    }
  });

  // Direct Invitation Email Dispatch endpoint
  app.post("/api/send-invite-email", async (req, res) => {
    try {
      const { to, role, locationName, appUrl, invitedByName, smtpConfig } = req.body;

      if (!to) {
        return res.status(400).json({ error: "Recipient email is required" });
      }

      // Check configuration from request or environment
      const host = smtpConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
      const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 465);
      const secure = smtpConfig?.secure !== undefined ? smtpConfig.secure : (port === 465);
      const user = smtpConfig?.user || process.env.SMTP_USER;
      const pass = smtpConfig?.pass || process.env.SMTP_PASS;
      const fromEmail = smtpConfig?.fromEmail || user;
      const fromName = smtpConfig?.fromName || "Vape Avenue POS";

      if (!user || !pass) {
        return res.status(422).json({
          error: "SMTP_NOT_CONFIGURED",
          message: "Email sender is not configured yet. Please configure your email sender settings."
        });
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const targetUrl = appUrl || process.env.APP_URL || req.headers.origin || "http://localhost:3000";
      const roleCapitalized = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : "Staff";
      const branchText = locationName && locationName !== "none" ? ` (${locationName})` : "";
      const subject = `Invitation to join Vape Avenue POS - ${roleCapitalized} Access`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .header { background: #064E3B; padding: 28px 24px; text-align: center; color: #ffffff; }
            .badge { display: inline-block; background: #10B981; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; letter-spacing: 0.05em; margin-bottom: 8px; }
            .title { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; }
            .content { padding: 32px 28px; line-height: 1.6; font-size: 14px; }
            .role-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0; }
            .role-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #15803d; letter-spacing: 0.05em; }
            .role-value { font-size: 16px; font-weight: 700; color: #14532d; margin-top: 4px; }
            .btn-container { text-align: center; margin: 28px 0; }
            .btn { display: inline-block; background: #1A2B4B; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(26,43,75,0.25); }
            .steps { background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0; font-size: 13px; color: #475569; }
            .steps ol { margin: 8px 0 0 0; padding-left: 20px; }
            .steps li { margin-bottom: 6px; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="badge">Vape Avenue Retail ERP</span>
              <h1 class="title">You've Been Invited!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You have been authorized by <strong>${invitedByName || "the Store Administrator"}</strong> to access the <strong>Vape Avenue POS & Inventory System</strong>.</p>
              
              <div class="role-box">
                <div class="role-label">Assigned Access</div>
                <div class="role-value">${roleCapitalized} Role${branchText}</div>
              </div>

              <div class="btn-container">
                <a href="${targetUrl}" class="btn" target="_blank">Log In to the App</a>
              </div>

              <div class="steps">
                <strong>How to get started:</strong>
                <ol>
                  <li>Click the <strong>Log In to the App</strong> button above (or open: <a href="${targetUrl}">${targetUrl}</a>).</li>
                  <li>Click <strong>"Continue with Google"</strong> using this email address: <strong>${to}</strong>.</li>
                  <li>Your account is pre-approved and will activate automatically upon first sign-in.</li>
                </ol>
              </div>
              
              <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">If you have any questions, please contact your store administrator.</p>
            </div>
            <div class="footer">
              Vape Avenue Point of Sale & Inventory Management System &bull; Secure Cloud Portal
            </div>
          </div>
        </body>
        </html>
      `;

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text: `Hello,\n\nYou have been invited to join Vape Avenue POS as ${roleCapitalized}${branchText}.\n\nLog in here: ${targetUrl}\n\nSign in using Google with your email (${to}) to activate your account.`,
        html: htmlContent,
      });

      console.log(`[Email] Invitation sent to ${to}, messageId: ${info.messageId}`);
      return res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("[Email] Error sending invite email:", error);
      return res.status(500).json({
        error: "SEND_FAILED",
        message: error?.message || "Failed to send email"
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    // Development mode: attach Vite as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
      ? path.join(process.cwd(), "dist")
      : fs.existsSync(path.join(process.cwd(), "index.html"))
      ? process.cwd()
      : __dirname;

    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
