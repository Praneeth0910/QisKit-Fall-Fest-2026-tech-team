#!/usr/bin/env python3
"""
Mail / Notification Utility for Tech Reels Google Drive Submitters
Qiskit Fall Fest 2026 (SRM University-AP)

Identifies participants who submitted Google Drive links for the Tech Reels
competition, exports a CSV for mail merge, and provides SMTP dispatch to
notify them to publish their reel on Instagram/LinkedIn with official logos.
"""

import os
import sys
import argparse
import csv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Participants identified from Supabase competition_submissions
DRIVE_SUBMITTERS = [
    {
        "email": "shaliniregalla@gmail.com",
        "name": "Quantum Syndicate",
        "url": "https://drive.google.com/file/d/14XBw_Hi9fL8hpmm8uPwwtL64inkDtqCl/view?usp=drive_link",
        "submitted_at": "2026-10-11 06:53:17+00",
    },
    {
        "email": "jeeshma6995@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/1jbBTNFxecmQjhEHd0T98RzEha3k6RaT9/view?usp=drivesdk",
        "submitted_at": "2026-10-11 06:29:01+00",
    },
    {
        "email": "skreshu7786@gmail.com",
        "name": "Quantum Syndicate",
        "url": "https://drive.google.com/file/d/1dF94-iHF9J8iMkCeeOfSKWgP5s_E63n1/view?usp=sharing",
        "submitted_at": "2026-10-10 05:57:27+00",
    },
    {
        "email": "23jr1a05i2@gmail.com",
        "name": "QuantumMedx",
        "url": "https://drive.google.com/file/d/130_F0KClQaS2fpAee2An7hC7lraXsAhU/view?usp=sharing",
        "submitted_at": "2026-10-09 05:26:26+00",
    },
    {
        "email": "m482719@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/1IbQcQz-zgPTWzx4XcQFdlr0jEyDhIy3Q/view?usp=sharing",
        "submitted_at": "2026-10-08 18:29:03+00",
    },
    {
        "email": "debosmita_mukhopadhyay@srmap.edu.in",
        "name": "Debosmita Mukhopadhyay",
        "url": "https://drive.google.com/file/d/1mdQMysaW-MmJfJB5_uwCAnTJXQURzdcg/view?usp=sharing",
        "submitted_at": "2026-10-08 17:58:29+00",
    },
    {
        "email": "sairamyellala27@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/1jY0acQNYFdxvkxWDJEOuDDB31-BrNmmG/view?usp=sharing",
        "submitted_at": "2026-10-08 17:45:33+00",
    },
    {
        "email": "amaralikhith15@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/16gjkV1GxH1TCQYUD4mL_98LHoYxgk5pz/view?usp=drivesdk",
        "submitted_at": "2026-10-08 17:37:20+00",
    },
    {
        "email": "kavyakanala0507@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/1AOdCw5EV5LFv-sjjTfkgENK1gmKTVDBe/view?usp=drivesdk",
        "submitted_at": "2026-10-08 17:13:27+00",
    },
    {
        "email": "komarapuvenkatasaikrishna@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/1KnTGfcCAq5gABly587gp5-vV50IYRyD2/view?usp=sharing",
        "submitted_at": "2026-10-08 17:13:01+00",
    },
    {
        "email": "chinmaivemula421@gmail.com",
        "name": "Participant",
        "url": "https://drive.google.com/file/d/1kVDbhPE3hx7YhGpJV5TcHK_86pOYnoRN/view?usp=sharing",
        "submitted_at": "2026-10-08 16:28:01+00",
    },
    {
        "email": "padaladinesh08@gmail.com",
        "name": "Padala Dinesh",
        "url": "https://drive.google.com/drive/folders/14sRjCyLGZpkFGBjNS8ax4bED0vk0XTCL",
        "submitted_at": "2026-10-08 13:45:56+00",
    },
]

EMAIL_SUBJECT = "Action Required: Update your Tech Reels Submission with Instagram/LinkedIn Post Link"

PORTAL_URL = "https://www.qffsrmap2026.com/learning?challenge=1"
BADGE_URL = "https://www.qffsrmap2026.com/brand/qiskit-fall-fest-2026-badge.png"
SRMAP_LOGO_URL = "https://www.qffsrmap2026.com/brand/srm-ap-logo.png"

def generate_plaintext_email(recipient_name: str, current_url: str) -> str:
    greeting = f"Dear {recipient_name}," if recipient_name != "Participant" else "Dear Participant,"
    return f"""{greeting}

Thank you for participating in the Tech Reels Competition for IBM Qiskit Fall Fest 2026 at SRM University-AP.

We noticed that your current submission is recorded as a Google Drive link:
{current_url}

Please note: As per competition evaluation guidelines, the Tech Reels track is designed for public community engagement and festival visibility. Submissions must be published on Instagram (as a Reel) or LinkedIn (as a Video post) with our official branding.

ACTION REQUIRED BEFORE DEADLINE (Monday, 12 October 2026, 11:59 PM IST):
1. Download Official Logos:
   - Qiskit Fall Fest 2026 Badge: {BADGE_URL}
   - SRM University-AP Logo: {SRMAP_LOGO_URL}
   (Feature these logos in your reel watermark, intro, or outro).

2. Publish Your Reel:
   - Instagram: Tag @qiskitfallfest and @srmuap, use hashtags #QiskitFallFest2026 #QiskitFallFestSRMAP #SRMUniversityAP
   - LinkedIn: Mention SRM University-AP and Qiskit, use hashtags #QiskitFallFest2026 #QiskitFallFestSRMAP

3. Update Your Link on the Learning Portal:
   Go to: {PORTAL_URL}
   Paste your live Instagram Reel or LinkedIn post URL into the submission box and click "Update with Social Link". Ensure your post privacy is set to Public so our jury can evaluate and track engagement.

If you have already republished your video, please update your URL on the portal immediately to ensure your entry is evaluated with full marks.

Best regards,
Organizing Committee
IBM Qiskit Fall Fest 2026 - SRM University-AP
Website: https://www.qffsrmap2026.com/learning
Contact: qiskitfallfest@srmap.edu.in
"""

def generate_html_email(recipient_name: str, current_url: str) -> str:
    greeting = f"Dear {recipient_name}," if recipient_name != "Participant" else "Dear Participant,"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Update Tech Reels Submission</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 24px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="background-color: #7A0C16; padding: 24px 32px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">IBM Qiskit Fall Fest 2026</h1>
        <p style="color: #fca5a5; font-size: 13px; margin: 4px 0 0 0;">SRM University-AP · Tech Reels Competition</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px 32px 24px 32px;">
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">{greeting}</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Thank you for participating in the <strong>Tech Reels Competition</strong>. We noticed that your entry is currently submitted as a Google Drive link:
        </p>

        <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #475569; word-break: break-all; margin-bottom: 20px; border-left: 4px solid #94a3b8;">
          {current_url}
        </div>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
          <strong style="color: #991b1b; font-size: 13px; display: block; margin-bottom: 4px;">Action Required for Evaluation:</strong>
          <span style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
            The Tech Reels track evaluates community engagement and festival reach. Drive links do not generate public engagement. To qualify for full jury marks and cash awards up to &#8377;10,000, please post your reel on Instagram or LinkedIn with official branding and update your submission link.
          </span>
        </div>

        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Next Steps Before Deadline (12 October 2026, 11:59 PM IST):</h3>
        
        <ol style="font-size: 13px; color: #334155; line-height: 1.6; margin: 0 0 24px 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">
            <strong>Incorporate Official Branding:</strong> Include the <a href="{BADGE_URL}" style="color: #7A0C16; font-weight: 600;">Qiskit Fall Fest Badge</a> and <a href="{SRMAP_LOGO_URL}" style="color: #7A0C16; font-weight: 600;">SRM University-AP Logo</a> as a watermark or in your intro/outro frames.
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Post to Instagram or LinkedIn:</strong>
            <ul style="margin-top: 4px; padding-left: 18px; color: #475569;">
              <li><strong>Instagram:</strong> Tag <code>@qiskitfallfest</code> &amp; <code>@srmuap</code>, use <code>#QiskitFallFest2026 #QiskitFallFestSRMAP #SRMUniversityAP</code></li>
              <li><strong>LinkedIn:</strong> Mention <strong>SRM University-AP</strong> &amp; <strong>Qiskit</strong>, use <code>#QiskitFallFest2026 #QiskitFallFestSRMAP</code></li>
            </ul>
          </li>
          <li>
            <strong>Update Your Submission URL:</strong> Visit the official portal and update your submission with the public post link. Ensure post privacy is set to Public.
          </li>
        </ol>

        <div style="text-align: center; margin: 28px 0;">
          <a href="{PORTAL_URL}" style="background-color: #7A0C16; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px; display: inline-block;">
            Update Submission on Portal &rarr;
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
        <p style="margin: 0 0 4px 0;"><strong>IBM Qiskit Fall Fest 2026 · SRM University-AP</strong></p>
        <p style="margin: 0;">Portal: <a href="https://www.qffsrmap2026.com/learning" style="color: #7A0C16;">www.qffsrmap2026.com/learning</a> &middot; Email: qiskitfallfest@srmap.edu.in</p>
      </td>
    </tr>
  </table>
</body>
</html>"""

def main():
    parser = argparse.ArgumentParser(description="Export or send email reminders to Tech Reels Drive submitters.")
    parser.add_argument("--export-csv", default="tech_reels_drive_submitters.csv", help="Output CSV path")
    parser.add_argument("--send", action="store_true", help="Send emails via SMTP")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Preview emails without sending")
    args = parser.parse_args()

    # 1. Export CSV
    with open(args.export_csv, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["email", "name", "url", "submitted_at"])
        writer.writeheader()
        for sub in DRIVE_SUBMITTERS:
            writer.writerow(sub)

    print(f"Exported {len(DRIVE_SUBMITTERS)} Drive submitters to {args.export_csv}")

    # 2. Preview
    sample = DRIVE_SUBMITTERS[0]
    print("\n--- SAMPLE EMAIL PREVIEW ---")
    print(f"Subject: {EMAIL_SUBJECT}")
    print(f"To: {sample['email']} ({sample['name']})")
    print("\n" + generate_plaintext_email(sample['name'], sample['url']))
    print("----------------------------\n")

    if args.send:
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")

        if not (smtp_host and smtp_user and smtp_pass):
            print("ERROR: SMTP environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS) are required to send emails.")
            sys.exit(1)

        print(f"Connecting to SMTP server {smtp_host}:{smtp_port}...")
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            for sub in DRIVE_SUBMITTERS:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = EMAIL_SUBJECT
                msg["From"] = f"Qiskit Fall Fest SRMAP <{smtp_user}>"
                msg["To"] = sub["email"]

                part_plain = MIMEText(generate_plaintext_email(sub["name"], sub["url"]), "plain")
                part_html = MIMEText(generate_html_email(sub["name"], sub["url"]), "html")
                msg.attach(part_plain)
                msg.attach(part_html)

                server.sendmail(smtp_user, [sub["email"]], msg.as_string())
                print(f"Sent email to {sub['email']}")

        print("All notification emails successfully sent.")

if __name__ == "__main__":
    main()
