interface OtpEmailProps {
  otp: string
  name: string
  expiresInMinutes: number
}

export function renderOtpEmail({ otp, name, expiresInMinutes }: OtpEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <h2 style="margin:0 0 8px">Verify your email</h2>
  <p style="color:#555;margin:0 0 24px">Hi ${name}, use the code below to verify your Advan AI workspace.</p>
  <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;letter-spacing:0.25em;font-size:32px;font-weight:700;font-family:monospace">
    ${otp}
  </div>
  <p style="color:#888;font-size:13px;margin:16px 0 0">This code expires in ${expiresInMinutes} minutes. If you didn't sign up for Advan AI, ignore this email.</p>
</body>
</html>`
}
