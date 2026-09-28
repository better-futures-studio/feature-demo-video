"""Wrap a sent email's HTML (saved from the project's dev mailer: Mailpit, MailHog, a log mailer,
letter_opener, ...) in a simple phone mail-app screen, written to $DEMO_DIR/email.html, so a phone
segment can show the real email and tap its button. Prints the output path.

usage: python3 make-email.py --html body.html --subject "Your link" [--theme light|dark] [--from App] [--to Dana]
"""
import argparse
import html
import os
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--html', required=True, help='the email HTML file')
parser.add_argument('--subject', required=True)
parser.add_argument('--theme', choices=['light', 'dark'], default='light')
parser.add_argument('--from', dest='sender', default='The app')
parser.add_argument('--to', dest='recipient', default='you')
parser.add_argument('--out', default=os.path.join(os.environ.get('DEMO_DIR', '/tmp/feature-demo'), 'email.html'))
args = parser.parse_args()

raw = Path(args.html).read_text()
subject = args.subject
styles = ''.join(re.findall(r'<style[^>]*>.*?</style>', raw, re.S))
match = re.search(r'<body[^>]*>(.*)</body>', raw, re.S)
body = match.group(1) if match else raw
# Mail buttons open a new tab; the recording keeps filming the old one, so open links in place.
body = re.sub(r'\s+target="_blank"', '', body)

dark = args.theme == 'dark'
bg, fg, muted, line, bar = ('#000', '#f2f2f7', '#8e8e93', '#2c2c2e', '#1c1c1e') if dark else ('#fff', '#111', '#8a8a8e', '#e5e5ea', '#f7f7f9')
initials = ''.join(word[0] for word in args.sender.split()[:2]).upper() or '?'

page = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{{box-sizing:border-box}} body{{margin:0;background:{bg};color:{fg};font:15px -apple-system,system-ui,sans-serif}}
.bar{{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;background:{bar};border-bottom:1px solid {line};color:#0a84ff;font-size:17px}}
.head{{padding:16px 16px 12px;border-bottom:1px solid {line}}}
.row{{display:flex;gap:12px;align-items:center}}
.av{{width:40px;height:40px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600}}
.from{{font-weight:600}} .to{{color:{muted};font-size:13px}} .time{{margin-left:auto;color:{muted};font-size:13px}}
h1{{font-size:20px;margin:14px 0 0}}
.mail{{background:#fff}}
</style></head><body>
<div class="bar"><span>&lsaquo; Inbox</span><span style="color:{muted};font-size:13px">1 of 3</span></div>
<div class="head"><div class="row"><div class="av">{html.escape(initials)}</div><div><div class="from">{html.escape(args.sender)}</div><div class="to">to {html.escape(args.recipient)}</div></div><div class="time">9:41 AM</div></div>
<h1>{html.escape(subject)}</h1></div>
{styles}<div class="mail">{body}</div>
</body></html>'''

out = Path(args.out).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page)
print(out)
