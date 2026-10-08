from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
font_pairs = [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]
from pathlib import Path
embedded_fonts = False
for regular, bold in font_pairs:
    if Path(regular).exists() and Path(bold).exists():
        pdfmetrics.registerFont(TTFont("RoadSans", regular))
        pdfmetrics.registerFont(TTFont("RoadBold", bold))
        embedded_fonts = True
        break
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import simpleSplit
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
tracks=[
('L1','P0','Choose the launch scope','Foundation', 'Existing app and public website; product scope still needs an operator decision.',[
'Choose one-restaurant pilot, multi-branch operation, or paid SaaS; document who the first users are.',
'For a restaurant pilot, defer billing, public signup and industry-specific workflows.',
'Publish a supported-feature list and identify appointments, floor plans and WhatsApp/email as unavailable until implemented.',
'Assign one owner for operations, one for product decisions, and one for support.',
'Set a pilot start date, measurable goals and rollback criteria; avoid promising a launch date before gates pass.'],
'Launch scope, owners and supported features are written down; no unavailable capability is sold as live.'),
('L2','P0','Database, deployment and backups','L1', 'Persistent SQLite is connected; it is suitable for a pilot on a single persistent application instance.',[
'Deploy with Node.js 24, a persistent writable database volume, production admin credentials and a configured APP_URL.',
'Use a real domain and HTTPS. Keep the database outside build artifacts and preserve it across deployments.',
'Keep one application instance for SQLite; do not place the database on ephemeral/serverless storage or an unsuitable shared filesystem.',
'Schedule encrypted backups with the SQLite backup API or a verified consistent snapshot. Do not copy only the live .sqlite file while ignoring WAL files.',
'Restore a backup into a separate environment, then verify accounts, queues, customers, logos and branch permissions.',
'Define recovery-point and recovery-time targets. For horizontally scaled paid SaaS, plan PostgreSQL migration, tenant scoping and tested migration/rollback.'],
'A redeploy retains data; a restore drill succeeds; backup alerts have a named owner. PostgreSQL is optional for the initial single-instance pilot.'),
('L3','P0','Security, privacy and account access','L1 + L2', 'Sessions, role/branch access checks, origin checks and input validation exist; production review remains.',[
'Remove development credentials from production, protect environment secrets, and confirm administrator account recovery procedures.',
'Test admin/staff boundaries, assigned-branch isolation, expired sessions and password-reset access revocation.',
'Review authorization on every new endpoint; add business/tenant isolation before multi-company SaaS.',
'Define data retention, deletion/export requests, consent records, and who may see customer notes or contact details.',
'Replace website policy drafts with the actual operator identity, privacy contact and organization-specific policies.',
'Keep dependency updates and security review on a schedule; document incident response and support escalation.'],
'No default production login; access-isolation tests pass; approved operating policies and a recovery/support process exist.'),
('L4','P0','Production notifications','L2 + L3', 'Browser push and configured Twilio SMS exist. Live delivery depends on production setup.',[
'Configure valid Web Push keys, HTTPS and the public app URL; start and supervise the notification worker.',
'Configure a real Twilio sender, destination permissions and an SMS budget. Validate guest consent before delivery.',
'Test provider failure, retries, expired subscriptions and stale/cancelled visits without duplicate notifications.',
'Run an actual end-to-end check on Android and iPhone; verify the iPhone Home Screen/PWA requirement where applicable.',
'Keep the live guest page usable when push is denied or SMS is unavailable; tell guests what notifications are enabled.',
'Monitor delivery failures and worker health; publish instructions for staff when a guest cannot receive alerts.'],
'A real guest receives a table-ready alert in production; denied permissions and provider outages have usable fallbacks.'),
('L5','P0','Responsive and accessible verification','L1', 'Responsive layouts and mobile/desktop browser workflows are tested; all real devices are not yet certified.',[
'Check 360/390 px phones, 768 px tablets, 1024 px small laptops, 1440+ px desktops and landscape orientation.',
'Test current iOS Safari, Android Chrome, desktop Chrome/Edge/Firefox and Safari where available.',
'Exercise every tab, CMS form, account menu, logo upload, date picker, QR dialog, queue actions and the public website.',
'Test Urdu RTL, long translated labels, large system text, 200% zoom and on-screen keyboards.',
'Check keyboard navigation, visible focus, modal trapping/restoration, labels, contrast and screen-reader status updates.',
'Confirm touch targets, scrolling, chart/table overflow and network-reconnect behavior on slow connections.'],
'No clipped controls or unwanted horizontal page scrolling; core actions work on the agreed device/browser matrix.'),
('L6','P0','Operations, monitoring and pilot rollout','L2-L5', 'Build, unit and browser tests exist; hosted operational controls still need setup.',[
'Run production build and regression suites against an isolated database before every release.',
'Add health/worker/backup monitoring, error reporting and storage/disk-space alerts without logging private guest tokens or contacts.',
'Load-test the expected guest and manager concurrency, including polling and notification delivery.',
'Prepare deployment rollback and database migration recovery instructions; rehearse them in staging.',
'Train hosts on call/seat/free/cancel/no-show flows, branch selection and offline fallback procedures.',
'Pilot at one restaurant, review results, fix blocking issues, and explicitly approve the rollout scope.'],
'Staging checks, restore/rollback drills and a real pilot pass; the responsible operator signs off on production readiness.'),
('F1','P1','Optional service-based wait estimates','L1; branch capacity configured', 'Implemented in this update: off by default, optional per branch. Validate accuracy during the pilot.',[
'Allow an administrator to enable estimates and set average service/dining duration; retain the simple estimate when disabled.',
'Use seat capacity, occupied seats, party sizes, elapsed seated time and priority/FIFO order.',
'Keep called seats reserved; never automatically free a table just because estimated time elapsed.',
'Use an overdue buffer and show an unavailable estimate for a party that cannot fit; offer host guidance.',
'Validate empty queues, full capacity, mixed party sizes, priority parties, cancelled/released visits and per-branch independence.',
'Compare estimates with actual pilot waits; document the limits until individual table allocation is implemented.'],
'A restaurant can operate without setup; enabling/disabling estimates is reversible; estimates never alter actual queue/capacity state.'),
('F2','P1','Individual tables and floor plans','F1; stable capacity model', 'Current app tracks seat capacity, not individual tables or a digital floor plan.',[
'Model tables with branch, name, seats, state and optional joinable-table groups.',
'Build a floor-plan editor with add/move/resize tables, sections and mobile-friendly viewing.',
'Assign called or seated parties to valid tables; require explicit release and prevent double booking.',
'Handle closed sections, table combinations, accessibility requests and manual overrides with history.',
'Integrate actual table availability into optional estimates while preserving the simpler seat-capacity mode.',
'Test simultaneous hosts, oversized parties, merges/splits and reservation conflicts.'],
'Two managers cannot allocate the same table; release restores availability; the simple capacity-only workflow remains usable.'),
('F3','P1','Reservations and appointments','F2 preferred; timezone policy', 'Walk-in queues exist; scheduled bookings and availability calendars do not.',[
'Define branch timezone, opening hours, service durations, booking lead time and capacity per slot.',
'Add manager calendar, booking CRUD and a customer booking page with a stable confirmation link.',
'Prevent overlapping capacity/table reservations transactionally; integrate arrivals with walk-in queues.',
'Add cancellation, reschedule, late-arrival, no-show and reminder rules with clear manager overrides.',
'Include upcoming visits in customer activity and enable Next visit sorting.',
'Test daylight saving, closed days, concurrent bookings, guest privacy and mobile calendar usability.'],
'Two guests cannot book the same unavailable capacity; a reservation can be confirmed, changed, checked in and cancelled end to end.'),
('F4','P1','Multiple service lists','F3 if appointment lists are needed', 'There is one queue per branch; takeaway and service-specific lists are missing.',[
'Model named lists under a branch with type, ordering, status transitions and optional capacity/duration settings.',
'Provide a manager list switcher and a guest-facing choice of available services.',
'Add separate walk-in, takeaway/order and appointment workflows rather than reusing incorrect restaurant labels.',
'Define customer transfers, list membership, notification routing and per-list permission rules.',
'Add list-aware analytics/export filters and avoid mixing unrelated service wait times.',
'Test simultaneous list operations, priority ordering and independent branch/list capacity.'],
'A guest joins the intended service; list actions and notifications never affect another list accidentally.'),
('F5','P2','Event guest lists and admission','F4; guest privacy policy', 'Customer profiles exist; event registration and admission check-in do not.',[
'Model events, dates, registration fields, quotas and event managers.',
'Provide registration links and optional CSV guest import with validation and duplicate handling.',
'Generate guest admission/check-in codes distinct from private wait-status tokens.',
'Build mobile staff check-in, search, attendance counts and duplicate-entry handling.',
'Apply event-specific privacy, marketing-consent and post-event retention rules.',
'Test capacity limits, repeated scans, concurrent staff and loss/recovery of network access.'],
'An attendee registers and checks in once; admission status and exports remain scoped to the event.'),
('F6','P1/P2','Email and WhatsApp notifications','L4; sender/provider approval', 'Push/SMS exist. Email and WhatsApp delivery are not implemented.',[
'Choose an email provider; verify the sending domain and configure SPF/DKIM/DMARC.',
'Choose WhatsApp Business delivery; register the sender and obtain any required template approval.',
'Record channel-specific consent/preferences and build localized, branch-branded message templates.',
'Extend the durable notification outbox with idempotent delivery, retries and provider callbacks.',
'Handle bounced emails, invalid numbers, revoked consent, WhatsApp session/template rules and budget limits.',
'Test with real provider accounts before enabling a channel; preserve live-page and in-person fallbacks.'],
'An authorized real guest receives each enabled channel; callbacks and retries cannot create duplicate or unauthorized messages.'),
('F7','P2','Public queue display / TV mode','F4 helpful; privacy design', 'Guests have private live pages; a public display is missing.',[
'Create a branch/list display with now-calling and next-up sections using guest-safe identifiers.',
'Never show phone numbers, emails, notes or private guest URLs on public screens.',
'Add fullscreen controls, auto-refresh/reconnect, visible offline state and configurable branding.',
'Decide display access through a revocable display key or approved public endpoint.',
'Support large-distance readability, landscape screens and reduced-motion preferences.',
'Test updates, stale screens, token revocation and overnight operation.'],
'The display stays current and readable while exposing only approved public queue information.'),
('F8','P2','Custom check-in fields','L3; stable customer/visit schemas', 'The guest form uses fixed basic fields.',[
'Model per-branch/list fields with label, type, required flag, choices, order and active state.',
'Add administrator form configuration and localized labels with an accessible guest preview.',
'Validate answers server-side; store field versions so historical answers remain understandable.',
'Decide which answers belong to a visit versus a customer profile and who may see them.',
'Include approved fields in manager views and safe exports; apply retention and data minimization.',
'Test disabled/renamed fields, required choices, RTL, malicious inputs and old guest links.'],
'Configured forms validate correctly without breaking old visits or exposing sensitive answers publicly.'),
('F9','P2','Optional geofencing','L3; guest fallback policy', 'Check-in does not require a guest to be near the restaurant.',[
'Add optional branch coordinates and a permitted check-in radius; keep it disabled by default.',
'Request browser location permission only when the guest chooses to check in.',
'Validate coordinates/radius consistently and explain unavailable, inaccurate or denied location.',
'Provide host-assisted/manual check-in so permission denial does not prevent restaurant operations.',
'Define minimal location retention and explain that browser location can be spoofed.',
'Test boundary points, poor indoor GPS, mobile permissions and branches without a geofence.'],
'Off-mode behaves exactly as before; configured checks have a usable fallback and do not claim fraud-proof enforcement.'),
('F10','P3','Paid SaaS, signup and subscriptions','L2-L6; business/tenant model', 'Pricing is illustrative. Checkout, trials, plan quotas and public signup are not live.',[
'First add businesses/tenants, owner accounts and strong isolation across every data/media endpoint.',
'Define actual prices, currency, taxes, plans, branch/staff limits, trials and cancellation policy.',
'Integrate a payment provider with hosted checkout, customer portal and verified idempotent webhooks.',
'Implement signup, email verification, secure recovery and onboarding; keep existing manager access working.',
'Persist entitlements and enforce changes server-side; handle renewals, failed payments, grace periods and downgrades without deleting data.',
'Test provider sandbox, webhook replay/order, refund/cancellation flows and tenant-isolation failures before taking live payments.'],
'A real subscription lifecycle controls access correctly; no cross-company data leaks or destructive downgrade behavior occurs.'),
('F11','P3','Notification credit purchases','F10 + L4/F6; provider cost model', 'Provider SMS fees apply; there is no prepaid-credit ledger or top-up checkout.',[
'Define billable units, supported destinations, multi-segment messages and channel-specific costs.',
'Build an append-only credit ledger with purchase, reservation, debit, reversal and adjustment entries.',
'Apply atomic balance checks before sending; reconcile retries and provider acceptance without double charges.',
'Add top-up checkout and low-balance alerts; publish expiry/refund and tax policies.',
'Keep delivery status separate from provider acceptance and define when credits are charged/refunded.',
'Test concurrent sends, payment replay, failed delivery, reconciliation and account disputes.'],
'Purchases and notification charges reconcile exactly; retries and webhook replay cannot debit the same notification twice.'),
('F12','P2/P3','Industry-specific services','F3 + F4; optional staffing resources', 'Current logic is restaurant parties and seating, not barber/salon resource scheduling.',[
'Decide which industries are actually supported first rather than launching all marketing use cases.',
'Model services, durations, staff/resources, opening shifts and service-specific capacity.',
'Add per-barber/stylist queues and resource calendars with transactional availability checks.',
'Adapt guest labels, forms, estimates and notifications without weakening restaurant workflows.',
'Introduce industry-specific analytics and reusable setup templates with optional modules.',
'Pilot each supported industry with real operators before advertising it as fully supported.'],
'The service/resource model fits the chosen industry; scheduled and walk-in use cases do not double-book a staff resource.'),
('L7','P0/P1','Website and customer onboarding','L1; F10 only for paid SaaS', 'Public homepage, pricing examples, menus, help content, FAQs and ROI calculator are built; the botanical visual redesign is built.',[
'Approve the TableQ brand, final wording, real product screenshots and supported-feature claims.',
'Keep example prices clearly marked until subscriptions are live; use real company contact/legal details.',
'Check every CTA and footer/menu link; keep Open TableQ connected to the real manager sign-in.',
'Write restaurant setup, guest QR, push-permission and staff-training instructions.',
'Check mobile navigation, keyboard use, readable contrasts, SEO titles and performance.',
'For a paid public offering, connect signup/onboarding to F10 and define support ownership and response expectations.'],
'The website promises only available capabilities; visitors can reach the actual app and understand how to get access.')]
tracks += [
('D1','P0/P3','Launch documentation','L1 + L3; F10 for paid subscriptions','Website terms/privacy currently describe the software; organization-specific policies are still needed.',[
'Publish Terms of Service, Privacy Policy and a clear operator/company contact for the markets you serve.',
'Document retention/deletion, customer data access, visit-update consent and separate marketing consent.',
'For hosted restaurant customers, prepare a data-processing agreement and a subprocessors/provider list.',
'For paid SaaS, publish billing, cancellation/refund, acceptable-use and support/service-level terms.',
'Describe essential browser storage; add consent controls if non-essential analytics/marketing trackers are introduced.',
'Write staff/onboarding guides, deployment/backup/restore and incident-response runbooks; review policies for your jurisdiction.'],
'Documents match actual behavior, identify the operator and contact details, and are reviewed before their applicable launch scope.'),
('D2','P1','Choose the final product name','L1; before public promotion','TableQ is the working name. Hostlane, Gatherlane, Seatwell, WelcomeLoop and QueueNest are unverified ideas.',[
'Shortlist names that are memorable, easy to pronounce and sufficiently distinct from competitors.',
'Check domain availability, trademark registries in your operating markets, company names and social handles.',
'Select the name and record the decision; do not treat an unverified suggestion as cleared for use.',
'Update logos, website/app copy, page metadata, manifest, notification messages and documentation consistently.',
'Preserve existing account/database records and public links when changing branding or domain names.',
'Rerun navigation, guest QR, notification and install/PWA checks after rebranding.'],
'The approved name is used consistently and brand/domain checks are recorded; existing guest and manager links remain valid.')]
tracks += [
('G1','P0 global','Global SaaS launch readiness','L1-L6 + F10 + D1 + D2','Goal: operate globally. The current installation is not yet a globally launch-ready multi-company SaaS.',[
'Choose initial countries and supported languages; verify a distinctive name in target trademark registries and plan international brand protection.',
'Deploy tenant-isolated persistent data and hosting; define data regions, cross-border transfers, retention and incident/breach ownership.',
'Prepare operator terms/privacy, restaurant data-processing contracts and subprocessors disclosures; review obligations in each supported market.',
'Validate signup/recovery, multi-currency billing, local taxes/invoices, payments, cancellation/refunds and country-specific restrictions.',
'Use branch timezones and locale-aware dates/numbers; validate RTL, accessibility and regional email/SMS/WhatsApp sender rules, consent and opt-outs.',
'Publish country/channel coverage, support hours and escalation; run local pilots, monitor incidents and costs, and enable markets in stages.'],
'The approved initial markets have legal, technical, billing, notification and support evidence. Global marketing does not promise unsupported countries or channels.')]
# Global SaaS is the chosen product direction; tenant and billing work is a launch foundation.
tracks=[(id,'P0 global' if id=='F10' else priority,title,deps,current,tasks,gate) for id,priority,title,deps,current,tasks,gate in tracks]
(ROOT/'docs'/'roadmap-data.json').write_text(json.dumps(tracks,indent=2)+'\n')
W,H=595.28,841.89;green=HexColor('#23664f');ink=HexColor('#20382f');muted=HexColor('#63766b');pale=HexColor('#eef3e5')
out=ROOT/'public'/'tableq-roadmap.pdf';c=canvas.Canvas(str(out),pagesize=(W,H));c.setTitle('TableQ Launch and Feature Roadmap');c.setAuthor('TableQ');f=c.acroForm
page=0
def text(s,x,y,size=10,color=ink,font='Helvetica',width=490,leading=None):
 if embedded_fonts: font="RoadBold" if font=="Helvetica-Bold" else "RoadSans"
 c.setFont(font,size);c.setFillColor(color);lines=simpleSplit(s,font,size,width)
 for line in lines:c.drawString(x,y,line);y-=leading or size*1.45
 return y

def base(title,kicker):
 global page;page+=1;c.setFillColor(pale);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(white);c.roundRect(25,35,W-50,H-65,14,fill=1,stroke=0)
 text('TABLEQ',45,H-58,15,green,'Helvetica-Bold');text('LAUNCH + FEATURE ROADMAP',330,H-55,8,muted,width=220)
 text(kicker.upper(),45,H-95,9,green,'Helvetica-Bold');text(title,45,H-122,23,ink,'Helvetica-Bold',width=500,leading=28)
 text('Prepared October 8, 2026 | Update statuses after each review',45,25,8,muted)
 text(str(page),W-55,25,9,muted)

def field(name,label,x,y,w=150,value='',height=22,multi=False):
 text(label,x,y+height+6,8,muted,'Helvetica-Bold',width=w)
 f.textfield(name=name,x=x,y=y,width=w,height=height,value=value,fontSize=9,borderColor=HexColor('#c9d8c8'),fillColor=HexColor('#fafcf8'),textColor=ink,forceBorder=True,fieldFlags='multiline' if multi else '')

def check(name,label,y,x=45,width=460):
 f.checkbox(name=name,x=x,y=y-2,size=12,borderColor=green,fillColor=white,textColor=green,buttonStyle='check',forceBorder=True)
 return text(label,x+23,y,10,width=width-23,leading=14)-15

base('A practical path to launch','Plan, build, verify, review')
y=text('Goal: a globally operated multi-company SaaS. Prove the platform with a controlled restaurant pilot, then enable countries and broader functionality in verified releases. A pricing page or a passing build is not proof that every feature is live.',45,655,13,width=490,leading=20)
y=text('How to use this PDF',45,y-24,15,font='Helvetica-Bold')
for s in ['Open it in a PDF viewer that supports forms, such as Adobe Acrobat Reader.','Fill in owners, target dates and evidence; save a copy after each review.','Check a task only after its acceptance evidence exists.','Mark a track Done only when its completion gate passes.','Use P0 items for launch readiness; P1/P2/P3 are product-priority suggestions, not promises.']:
 y=text('- '+s,45,y-10,11,width=485)-4
text('Choose your launch scope',45,y-24,14,font='Helvetica-Bold');y-=62
for i,s in enumerate(['Single restaurant pilot','Multi-branch production','Paid multi-company SaaS']):y=check('scope'+str(i),s,y)
field('program_owner','PROGRAM OWNER',45,150,230);field('next_review','NEXT REVIEW DATE',300,150,245)
text('Snapshot: SQLite storage, queue CRUD, branches/managers, customer history, QR check-in, push/configured SMS, logos, themes, seven app languages and public website exist. Optional estimates and the new visual identity are included in this update. Production hosting, real-device validation and operating policies still require launch work.',45,122,9,width=495,leading=13)
c.showPage()
base('Sequence and dependencies','Recommended release tracks')
y=665
phases=[('Phase A - Launch foundations','L1-L6 and the launch portions of L7. Set scope, deploy with persistent data, prove backups, secure access and test real phones.'),('Phase B - Global SaaS foundations','F10 tenants/signup/subscriptions plus G1, D1 and D2. Resolve scalable storage, supported markets, naming, policies, payments and support before public paid launch.'),('Phase C - Restaurant upgrades','F1 optional estimates, F2 tables/floor plans, F3 reservations, F4 service lists and F6 more notification channels. Keep new modules optional where practical.'),('Phase D - Market-led expansion','F5 event lists, F7 display, F8 fields, F9 geofencing, F11 credits and F12 industry workflows. Roll out only where operations and verification support them.')]
for h,p in phases:y=text(h,45,y,14,font='Helvetica-Bold');y=text(p,45,y-10,11,width=490,leading=16)-28
text('Planning rules',45,y,14,font='Helvetica-Bold');y-=30
for i,s in enumerate(['Assign an owner and target date to every active track.','Limit parallel work to what the team can review and test.','Schedule estimates after scope, dependencies and staffing are agreed.','Review blockers weekly; record a decision, not just a status.','Repeat relevant regression and rollout checks after meaningful changes.']):y=check('rule'+str(i),s,y)
c.showPage()
base('Master progress tracker','Review weekly')
y=672
for id,priority,title,deps,current,tasks,gate in tracks:
 text(id,45,y,9,green,'Helvetica-Bold');text(title,77,y,9,width=325);text(priority,411,y,8,muted)
 f.checkbox(name='master_'+id,x=513,y=y-2,size=11,borderColor=green,buttonStyle='check',forceBorder=True)
 y-=23
text('The master checkbox means the track completion gate passed. Detailed owner/status/evidence fields follow.',45,y-10,9,muted,width=495)
field('master_review','REVIEW DATE',45,65,150);field('master_reviewer','REVIEWED BY',220,65,325)
c.showPage()
for id,priority,title,deps,current,tasks,gate in tracks:
 base(title,id+' | '+priority)
 y=text('DEPENDS ON: '+deps,45,663,9,muted,'Helvetica-Bold',width=490)
 y=text('CURRENT STATE: '+current,45,y-12,10,width=490,leading=14)
 field(id+'_owner','OWNER',45,572,155);field(id+'_date','TARGET DATE',218,572,150)
 text('STATUS',385,599,8,muted,'Helvetica-Bold');f.choice(name=id+'_status',x=385,y=572,width=160,height=22,options=['Not started','In progress','Blocked','Done'],value='Not started',fontSize=9,borderColor=HexColor('#c9d8c8'),fillColor=HexColor('#fafcf8'),textColor=ink,forceBorder=True)
 text('IMPLEMENTATION CHECKLIST',45,548,10,green,'Helvetica-Bold');y=522
 for i,task in enumerate(tasks):y=check(id+'_task_'+str(i),task,y)
 y=min(y-6,290);text('COMPLETION GATE',45,y,10,green,'Helvetica-Bold');y=text(gate,45,y-20,10,width=490,leading=14)
 field(id+'_evidence','EVIDENCE / LINKS / TEST RESULTS',45,127,500,height=47,multi=True)
 field(id+'_blockers','BLOCKERS / NEXT ACTION',45,56,500,height=40,multi=True)
 c.showPage()
base('Launch decision and review log','Release gate')
y=665
for i,s in enumerate(['Scope and supported-feature claims approved (L1, L7).','HTTPS deployment and persistence verified (L2).','Backup restore and rollback drills passed (L2, L6).','Production accounts, authorization and privacy review complete (L3).','Actual enabled notifications verified on real phones (L4).','Agreed responsive/accessibility device matrix passed (L5).','Monitoring, support ownership and staff training ready (L6).','Restaurant pilot passed; remaining limitations accepted by the operator.','For global SaaS: F10, G1 and applicable D1/D2 gates passed for initial supported markets.']):y=check('launch_gate_'+str(i),s,y)
field('decision','LAUNCH DECISION (GO / HOLD / LIMITED PILOT)',45,270,500)
field('signoff','OPERATOR / REVIEWER',45,216,230);field('signoff_date','DECISION DATE',300,216,245)
field('accepted_limits','ACCEPTED LIMITATIONS / ROLLBACK TRIGGERS',45,122,500,height=55,multi=True)
text('After launch: review failures, actual waits, customer feedback, support volume and backup health. Continue the feature roadmap in separate verified releases.',45,86,10,muted,width=490)
c.showPage();c.save();print(str(out));print('Pages:',page)
