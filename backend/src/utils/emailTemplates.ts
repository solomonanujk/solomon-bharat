/** Small helpers for transactional email HTML (inline styles only — email clients strip <style>). */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A button-style link with inline styles (table wrapper for Outlook). */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td style="border-radius:6px;background:#8a3b12;">
<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Wraps body HTML in a simple, centred layout. */
export function emailLayout(bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:600px;margin:0 auto;padding:16px;">${bodyHtml}
<p style="margin-top:32px;font-size:12px;color:#888888;">Solomon Bharat</p></div>`;
}

/** Welcome email for a newly approved account: direct set-password link + temporary password fallback. */
export function accountReadyEmailHtml(opts: {
  intro: string;
  email: string;
  tempPassword: string;
  setupUrl: string;
  signInUrl: string;
  extraHtml?: string;
}): string {
  const setup = escapeHtml(opts.setupUrl);
  const signIn = escapeHtml(opts.signInUrl);
  return emailLayout(`<p>${opts.intro}</p>
<p>Click the button below to choose your password and sign in:</p>
${emailButton(opts.setupUrl, 'Set your password and sign in')}
<p style="font-size:13px;color:#555555;">This link works once and expires in 7 days. If the button doesn't work, copy this address into your browser:<br/><a href="${setup}" style="color:#8a3b12;word-break:break-all;">${setup}</a></p>
<p style="font-size:13px;color:#555555;">Or sign in at <a href="${signIn}" style="color:#8a3b12;">${signIn}</a> (click "Sign In" in the top navigation) with:<br/>
Email: ${escapeHtml(opts.email)}<br/>Temporary password: <strong>${escapeHtml(opts.tempPassword)}</strong><br/>
You will then be asked to choose your own password.</p>${opts.extraHtml ?? ''}`);
}
