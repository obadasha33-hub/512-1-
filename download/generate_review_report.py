#!/usr/bin/env python3
"""Generate Code Logic Review Report PDF for our-sanctuary-gemini project."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate

# ━━ Color Palette (auto-generated) ━━
ACCENT       = colors.HexColor('#2292b8')
TEXT_PRIMARY  = colors.HexColor('#232527')
TEXT_MUTED    = colors.HexColor('#83898f')
BG_SURFACE   = colors.HexColor('#d5dadf')
BG_PAGE      = colors.HexColor('#f3f4f5')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('Tinos', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))
pdfmetrics.registerFont(TTFont('Tinos-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'))
registerFontFamily('Tinos', normal='Tinos', bold='Tinos-Bold')
registerFontFamily('Carlito', normal='Carlito', bold='Carlito')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

# ━━ Styles ━━
TITLE_STYLE = ParagraphStyle(
    name='Title', fontName='Tinos', fontSize=26, leading=34,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=6,
)
H1_STYLE = ParagraphStyle(
    name='H1', fontName='Tinos', fontSize=18, leading=24,
    textColor=ACCENT, spaceBefore=18, spaceAfter=8,
)
H2_STYLE = ParagraphStyle(
    name='H2', fontName='Tinos', fontSize=14, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6,
)
H3_STYLE = ParagraphStyle(
    name='H3', fontName='Tinos', fontSize=12, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4,
)
BODY_STYLE = ParagraphStyle(
    name='Body', fontName='Tinos', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6,
)
CODE_STYLE = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, leftIndent=18, spaceAfter=4,
)
HEADER_CELL_STYLE = ParagraphStyle(
    name='HeaderCell', fontName='Tinos', fontSize=10,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER,
)
CELL_STYLE = ParagraphStyle(
    name='Cell', fontName='Tinos', fontSize=9.5,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, leading=13,
)
CELL_CENTER = ParagraphStyle(
    name='CellCenter', fontName='Tinos', fontSize=9.5,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER, leading=13,
)
CRITICAL_STYLE = ParagraphStyle(
    name='Critical', fontName='Tinos', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=colors.HexColor('#c0392b'), spaceAfter=6,
)
WARNING_STYLE = ParagraphStyle(
    name='Warning', fontName='Tinos', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=colors.HexColor('#e67e22'), spaceAfter=6,
)
META_STYLE = ParagraphStyle(
    name='Meta', fontName='Tinos', fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=4,
)

# ━━ Page dimensions ━━
PAGE_W, PAGE_H = A4
MARGIN = 0.85 * inch
AVAIL_W = PAGE_W - 2 * MARGIN

# ━━ Doc Template with TOC ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

import hashlib

def heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def para(text):
    return Paragraph(text, BODY_STYLE)

def code(text):
    return Paragraph(text, CODE_STYLE)

def make_table(headers, rows, col_widths=None):
    if col_widths is None:
        col_widths = [AVAIL_W / len(headers)] * len(headers)
    data = [[Paragraph('<b>%s</b>' % h, HEADER_CELL_STYLE) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), CELL_STYLE) for c in row])
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t


# ━━ Build Story ━━
story = []

# --- Cover ---
story.append(Spacer(1, 120))
story.append(Paragraph('<b>Code Logic Review Report</b>', TITLE_STYLE))
story.append(Spacer(1, 12))
story.append(Paragraph('our-sanctuary-gemini-main', META_STYLE))
story.append(Spacer(1, 8))
story.append(Paragraph('A Couples Private Sanctuary App (React + Capacitor + Supabase)', META_STYLE))
story.append(Spacer(1, 40))
story.append(Paragraph('Prepared by: Z.ai Code Logic Reviewer', META_STYLE))
story.append(Paragraph('Date: 2026-05-22', META_STYLE))
story.append(Spacer(1, 40))

summary_data = [
    ['Category', 'Count'],
    ['Critical (Security / Data Loss)', '6'],
    ['High (Logic Errors / Race Conditions)', '9'],
    ['Medium (Incorrect Behavior / UX Bugs)', '7'],
    ['Low (Code Smell / Minor Issues)', '4'],
    ['Total Findings', '26'],
]
st = Table(summary_data, colWidths=[AVAIL_W * 0.6, AVAIL_W * 0.4], hAlign='CENTER')
st.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('BACKGROUND', (0, 1), (-1, -2), colors.white),
    ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#eaf4f9')),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(st)
story.append(PageBreak())

# --- TOC ---
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle(name='TOC1', fontName='Tinos', fontSize=12, leftIndent=20, leading=20),
    ParagraphStyle(name='TOC2', fontName='Tinos', fontSize=10, leftIndent=40, leading=16),
]
story.append(Paragraph('<b>Table of Contents</b>', H1_STYLE))
story.append(Spacer(1, 8))
story.append(toc)
story.append(PageBreak())


# ============================================================
# 1. EXECUTIVE SUMMARY
# ============================================================
story.append(heading('1. Executive Summary', H1_STYLE, 0))
story.append(para(
    'This report documents the results of a comprehensive code-logic review of the '
    '<b>our-sanctuary-gemini</b> project, a React/TypeScript couples sanctuary application '
    'that was recently migrated from Firebase to Supabase. The review focused on logical '
    'correctness, race conditions, security vulnerabilities, data integrity issues, and '
    'migration-related bugs. A total of <b>26 findings</b> were identified across 6 severity levels, '
    'including 6 critical issues that could lead to data loss, unauthorized access, or application crashes.'
))
story.append(para(
    'The most severe findings include: (1) hardcoded Supabase credentials in client-side code, '
    '(2) trivially bypassable Row Level Security policies, (3) a stale Firebase dependency that '
    'will crash at runtime, (4) a race condition in the Firestore-compat layer that causes data '
    'overwrites on concurrent writes, (5) encryption that stores both ciphertext and plaintext in '
    'the same localStorage key, and (6) message ID collisions between app messages and imported '
    'WhatsApp messages. These issues should be addressed before any production deployment.'
))

# ============================================================
# 2. CRITICAL FINDINGS
# ============================================================
story.append(heading('2. Critical Findings (Security / Data Loss)', H1_STYLE, 0))

story.append(heading('2.1 Hardcoded Supabase Credentials in Client Bundle', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/supabase.ts</font> (lines 3-4)<br/>'
    '<b>Severity:</b> CRITICAL<br/>'
    '<b>Impact:</b> Anyone who inspects the bundled JavaScript can extract the Supabase URL and '
    'anon key. While the anon key is designed to be public, the hardcoded fallback URL means '
    'attackers can directly query the Supabase instance, especially given the weak RLS policies (see 2.2). '
    'The MIGRATION_CHANGES.md also notes that the service_role key was previously exposed and needs rotation.'
))
story.append(code(
    'const supabaseUrl = import.meta.env.VITE_SUPABASE_URL<br/>'
    '  || \'https://fqtooqlafypnhryfnpfo.supabase.co\';<br/>'
    'const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY<br/>'
    '  || \'sb_publishable_gkXzmAefCJMmSctPpuAXZg_IddPU2yq\';'
))
story.append(para(
    '<b>Fix:</b> Remove the hardcoded fallback values. If environment variables are missing, the app '
    'should display a configuration error rather than silently connecting to a specific instance. '
    'Rotate the Supabase anon key and verify that the previously-exposed service_role key has been rotated.'
))

story.append(heading('2.2 Trivially Bypassable Row Level Security Policies', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">supabase-setup.sql</font> (lines 27-39)<br/>'
    '<b>Severity:</b> CRITICAL<br/>'
    '<b>Impact:</b> The RLS policies grant full CRUD access to any row where the primary key '
    'length is at least 6 characters. Since vault codes are always 6-character strings, any '
    'client with the anon key can read, modify, or delete any couple\'s data. There is no '
    'authentication requirement whatsoever.'
))
story.append(code(
    'create policy "couple_state app access"<br/>'
    'on public.couple_state for all<br/>'
    'using (length(vault_id) &gt;= 6)<br/>'
    'with check (length(vault_id) &gt;= 6);'
))
story.append(para(
    '<b>Fix:</b> Implement proper authentication (Supabase Auth) and tie RLS policies to authenticated '
    'user identities. At minimum, use a vault-specific secret that is not the vault_id itself. '
    'The current design relies entirely on security through obscurity (the 6-char vault code).'
))

story.append(heading('2.3 Firebase Dependency Will Crash at Runtime', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/fcm.ts</font> (lines 1-2)<br/>'
    '<b>Severity:</b> CRITICAL<br/>'
    '<b>Impact:</b> The file imports from <font name="DejaVuSans" size="8.5">firebase/app</font> and '
    '<font name="DejaVuSans" size="8.5">firebase/messaging</font>, but Firebase packages were removed '
    'from package.json during the Supabase migration. This means the import will throw a module-not-found '
    'error at runtime. The <font name="DejaVuSans" size="8.5">initFCM()</font> function is called '
    'unconditionally in App.tsx (line 130), so the app will crash on startup unless the try/catch in '
    'initFCM somehow prevents the import error from propagating - but dynamic imports are not used here, '
    'so the crash is guaranteed.'
))
story.append(code(
    'import { initializeApp } from \'firebase/app\'<br/>'
    'import { getMessaging, getToken, onMessage } from \'firebase/messaging\''
))
story.append(para(
    '<b>Fix:</b> Either (a) re-add Firebase as a dependency if FCM push notifications are still needed, '
    'or (b) replace fcm.ts with a Supabase-native push notification solution and remove the Firebase '
    'imports entirely. The MIGRATION_CHANGES.md already notes that remote push notifications require '
    'backend infrastructure, so option (b) is recommended.'
))

story.append(heading('2.4 Race Condition in supabaseFirestoreCompat setDoc', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/supabaseFirestoreCompat.ts</font> (lines 81-97)<br/>'
    '<b>Severity:</b> CRITICAL<br/>'
    '<b>Impact:</b> When <font name="DejaVuSans" size="8.5">{ merge: true }</font> is used, '
    '<font name="DejaVuSans" size="8.5">setDoc</font> first reads the current row, deep-merges the '
    'updates, then upserts. If two clients call <font name="DejaVuSans" size="8.5">setDoc</font> '
    'concurrently (e.g., both partners sending messages simultaneously), both read the same base state, '
    'each merges their own changes independently, and the second upsert overwrites the first client\'s '
    'changes. This is a classic read-modify-write race condition that will cause silent data loss.'
))
story.append(code(
    'export async function setDoc(ref, updates, options) {<br/>'
    '  const currentSnap = options?.merge ? await getDoc(ref) : null;<br/>'
    '  const currentData = currentSnap?.exists() ? currentSnap.data() : {};<br/>'
    '  const nextData = options?.merge ? deepMerge(currentData, updates) : updates;<br/>'
    '  // ... upsert(nextData) -- last writer wins!'
))
story.append(para(
    '<b>Fix:</b> Use Supabase RPC functions (Postgres functions) for atomic merge operations, or '
    'implement optimistic concurrency control using a version/timestamp column. Alternatively, '
    'restructure the data model so that each update targets a separate row (e.g., individual message '
    'rows instead of a single JSON blob containing all messages).'
))

story.append(heading('2.5 Encryption Stores Both Ciphertext and Plaintext', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/App.tsx</font> (lines 219-232)<br/>'
    '<b>Severity:</b> CRITICAL<br/>'
    '<b>Impact:</b> When encryption is enabled, the local persistence logic encrypts the state but sets '
    '<font name="DejaVuSans" size="8.5">messages: []</font> in the encrypted payload. However, the '
    'object spread <font name="DejaVuSans" size="8.5">{ ...state, messages: [], isEncrypted: true, '
    'encryptedPayload: encryptData({ ...state, messages: [] }, key) }</font> still includes all other '
    'state properties (batmanName, princessName, moods, events, etc.) in plaintext alongside the '
    'encrypted payload. An attacker with access to localStorage gets both the plaintext fields and '
    'the encrypted blob, severely undermining the purpose of encryption.'
))
story.append(code(
    'let storageData: any = state;<br/>'
    'if (state.encryptionKey) {<br/>'
    '  storageData = {<br/>'
    '    ...state,    // All fields still in plaintext!<br/>'
    '    messages: [],<br/>'
    '    isEncrypted: true,<br/>'
    '    encryptedPayload: encryptData({ ...state, messages: [] }, key)<br/>'
    '  };<br/>'
    '}'
))
story.append(para(
    '<b>Fix:</b> When encryption is enabled, store ONLY the encrypted payload and the isEncrypted flag. '
    'Do not spread the full state object. The correct structure should be: '
    '<font name="DejaVuSans" size="8.5">{ isEncrypted: true, encryptedPayload: encryptData(state, key) }</font>. '
    'The same issue applies to the cloud sync path (line 247) where decrypted data is spread alongside encrypted data.'
))

story.append(heading('2.6 Message ID Collision Between App and WhatsApp Imports', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/ChatScreen.tsx</font> (lines 329-342)<br/>'
    '<b>Severity:</b> CRITICAL<br/>'
    '<b>Impact:</b> App-generated messages use <font name="DejaVuSans" size="8.5">Date.now() + '
    'Math.floor(Math.random() * 1000)</font> as IDs, while imported WhatsApp messages use '
    'Unix timestamps as IDs. Since <font name="DejaVuSans" size="8.5">Date.now()</font> returns a '
    'Unix timestamp in milliseconds, there is a high probability of ID collisions. When merging messages '
    'in the <font name="DejaVuSans" size="8.5">Map</font>, later entries overwrite earlier ones with '
    'the same ID, causing messages to silently disappear.'
))
story.append(code(
    '// App messages:<br/>'
    'id: Date.now() + Math.floor(Math.random() * 1000)<br/>'
    '// Imported messages:<br/>'
    'id: ts  // where ts = new Date(...).getTime()'
))
story.append(para(
    '<b>Fix:</b> Use a more robust ID generation strategy. For example, prefix imported messages with '
    '<font name="DejaVuSans" size="8.5">"wa-"</font> or use UUIDs. Alternatively, use separate ID '
    'namespaces so that app messages and imported messages never collide in the merge Map.'
))


# ============================================================
# 3. HIGH SEVERITY FINDINGS
# ============================================================
story.append(heading('3. High Severity Findings (Logic Errors / Race Conditions)', H1_STYLE, 0))

story.append(heading('3.1 onSnapshot Deduplication Bug Can Suppress Legitimate Updates', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/supabaseFirestoreCompat.ts</font> (lines 103-152)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">onSnapshot</font> function compares the initial '
    'data hash with the realtime event hash to skip the duplicate initial-load event. However, if a '
    'different client updates the data between the initial fetch and the realtime subscription becoming '
    'active, the realtime event will carry the same data as the initial fetch (which is now stale). '
    'The hash comparison will match, and the update will be silently dropped. Additionally, after the '
    'first realtime event, <font name="DejaVuSans" size="8.5">initialDataHash</font> is set to null, '
    'so the dedup logic only works for the very first event and cannot prevent duplicates from reconnections.'
))

story.append(heading('3.2 Realtime Payload Structure Mismatch', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/supabaseFirestoreCompat.ts</font> (lines 130-139)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">makeSnapshot</font> function assumes that '
    'the data is either wrapped in a <font name="DejaVuSans" size="8.5">.data</font> property or is the '
    'raw object. For the initial load via <font name="DejaVuSans" size="8.5">getDoc</font>, the Supabase '
    'row returns <font name="DejaVuSans" size="8.5">{ vault_id, data, updated_at }</font>, and '
    '<font name="DejaVuSans" size="8.5">makeSnapshot</font> correctly extracts <font name="DejaVuSans" '
    'size="8.5">.data</font>. However, the realtime payload\'s <font name="DejaVuSans" size="8.5">'
    'payload.new</font> also has the same structure <font name="DejaVuSans" size="8.5">{ vault_id, data, '
    'updated_at }</font>, but it is passed directly to <font name="DejaVuSans" size="8.5">makeSnapshot</font> '
    'which will call <font name="DejaVuSans" size="8.5">.data()</font> on it, returning the nested JSON. '
    'This means the realtime snapshot structure differs from the initial snapshot, causing inconsistent '
    'data access patterns in the consumer.'
))

story.append(heading('3.3 Infinite Re-render Loop in ChatScreen "Seen" Status', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/ChatScreen.tsx</font> (lines 394-409)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The useEffect for marking messages as "seen" depends on '
    '<font name="DejaVuSans" size="8.5">[selectedChat, state.messages]</font>. When unseen messages are '
    'found, it calls <font name="DejaVuSans" size="8.5">setState</font> to update the message status, '
    'which changes <font name="DejaVuSans" size="8.5">state.messages</font>, triggering the effect again. '
    'The <font name="DejaVuSans" size="8.5">seenMessageIds</font> ref prevents re-processing the same '
    'messages, but the effect still runs on every state change, causing unnecessary re-renders and '
    'redundant <font name="DejaVuSans" size="8.5">syncMessages</font> calls. In the worst case, '
    'if <font name="DejaVuSans" size="8.5">syncMessages</font> triggers a cloud update that produces a '
    'new snapshot, this can create a feedback loop.'
))

story.append(heading('3.4 Presence Update Race Condition', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/App.tsx</font> (lines 358-447)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The presence update reads the current <font name="DejaVuSans" size="8.5">'
    'stateRef.current.presenceStatus</font>, modifies it locally, then writes it back via '
    '<font name="DejaVuSans" size="8.5">setDoc</font>. Since <font name="DejaVuSans" size="8.5">'
    'setDoc({ merge: true })</font> uses the read-modify-write pattern (see finding 2.4), two '
    'concurrent presence updates will overwrite each other. This means one partner\'s online status '
    'can be lost when both update simultaneously.'
))

story.append(heading('3.5 Typing Status Race Condition', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/ChatScreen.tsx</font> (lines 466-491)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> Same race condition as presence updates. The typing status is read from local state, '
    'modified, then written back via <font name="DejaVuSans" size="8.5">setDoc({ merge: true })</font>. '
    'Concurrent updates from both partners will cause one partner\'s typing status to be lost.'
))

story.append(heading('3.6 Network Detection Listener Leak', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/networkDetection.ts</font> (lines 14-31)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">initNetworkDetection()</font> function adds '
    '"online" and "offline" event listeners to the window but never returns an unsubscribe function. '
    'Each call to <font name="DejaVuSans" size="8.5">initNetworkDetection()</font> adds new listeners '
    'without removing the previous ones. In React strict mode (which is enabled in main.tsx), effects '
    'run twice during development, causing duplicate listeners. The event listeners are never cleaned up '
    'on component unmount, leading to memory leaks and duplicate callback invocations.'
))

story.append(heading('3.7 Game Session Auto-Creation Side Effect in onSnapshot', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/SanctuaryScreen.tsx</font> (lines 118-132)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">onSnapshot</font> callback for game sessions '
    'calls <font name="DejaVuSans" size="8.5">setDoc</font> to create a new session when the snapshot '
    'doesn\'t exist. This write triggers another realtime event, which calls the snapshot handler again, '
    'potentially in an infinite loop. While the second call would find the document exists, it still '
    'represents a side effect inside a read callback that can cause unexpected behavior, especially if '
    'the initial write fails or is delayed.'
))

story.append(heading('3.8 Missing Return from onForegroundMessage', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/fcm.ts</font> (line 67)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">onForegroundMessage</font> function returns '
    '<font name="DejaVuSans" size="8.5">() =&gt; {}</font> (a no-op) when messaging is not initialized, '
    'but in App.tsx (line 185) the return value is used as the cleanup function for a useEffect. If '
    'messaging fails to initialize (which is likely given finding 2.3), the useEffect will store this '
    'no-op unsubscribe. The actual <font name="DejaVuSans" size="8.5">onMessage</font> listener from '
    'Firebase (if it were working) would never be cleaned up, causing a listener leak.'
))

story.append(heading('3.9 session.cookie.secure=true Breaks HTTP Development', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">server.ts</font> (line 47)<br/>'
    '<b>Severity:</b> HIGH<br/>'
    '<b>Impact:</b> The session cookie is configured with <font name="DejaVuSans" size="8.5">'
    'secure: true</font>, which means cookies will only be sent over HTTPS. During local development '
    'with <font name="DejaVuSans" size="8.5">npm run dev</font> (which serves HTTP on port 3000), '
    'the session cookie will never be sent, making the session middleware non-functional. This is '
    'especially problematic since the README instructs users to run locally via HTTP.'
))


# ============================================================
# 4. MEDIUM SEVERITY FINDINGS
# ============================================================
story.append(heading('4. Medium Severity Findings (Incorrect Behavior / UX Bugs)', H1_STYLE, 0))

story.append(heading('4.1 Error Message References "Firebase" After Migration', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/media.ts</font> (lines 28-30)<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> The error messages still reference "Firebase Storage" even though the project has '
    'been migrated to Supabase. The error message reads: "Media upload failed. Enable Firebase Storage '
    'and deploy storage.rules." This is confusing for developers and users who are now using Supabase, '
    'not Firebase. Similarly, line 27 logs "Firebase Storage upload failed."'
))

story.append(heading('4.2 Backup Restore Does Not Sync to Cloud', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/backup.ts</font> (lines 110-122)<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">restoreBackupToState</font> function returns '
    'a partial state object but does not sync the restored data to the cloud. After importing a backup, '
    'the data only exists locally. If the user expects the restore to also update the cloud copy (which '
    'is a reasonable expectation), they will lose the restored data when the next cloud sync overwrites '
    'the local state with the older cloud version.'
))

story.append(heading('4.3 Date Parsing in WhatsApp Import Assumes Specific Format', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/ChatScreen.tsx</font> (lines 232-242)<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">parseMsg</font> function assumes the WhatsApp '
    'date format is <font name="DejaVuSans" size="8.5">DD/MM/YYYY</font> and the time format uses 12-hour '
    'AM/PM notation. WhatsApp exports from different locales or regions may use different date/time formats '
    '(e.g., MM/DD/YYYY, 24-hour time). Messages with unrecognized formats are silently dropped, leading '
    'to incomplete chat imports with no user feedback about skipped messages.'
))

story.append(heading('4.4 Search Only Filters Deleted Messages, Not Imported', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/App.tsx</font> (line 687)<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> The search modal filters messages with <font name="DejaVuSans" size="8.5">'
    '!m.deleted</font> but does not check <font name="DejaVuSans" size="8.5">!m.imported</font>. '
    'This means imported WhatsApp messages will appear in search results, which may be unexpected. '
    'While not strictly a bug, it creates an inconsistency: the search shows imported messages but '
    'they are not part of the "real" message state.'
))

story.append(heading('4.5 PWA Manifest Name is "512" Instead of App Name', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">vite.config.ts</font> (lines 17-18)<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> The PWA manifest has <font name="DejaVuSans" size="8.5">name: "512"</font> and '
    '<font name="DejaVuSans" size="8.5">short_name: "512"</font>, which appears to be a placeholder '
    '(likely the days-together count) instead of the actual app name. When users install the PWA, it '
    'will appear as "512" on their home screen, which is confusing. The theme_color and background_color '
    'are also set to <font name="DejaVuSans" size="8.5">#0F172A</font> (dark navy) which does not match '
    'any of the app\'s themes.'
))

story.append(heading('4.6 Suboptimal setDoc Usage Across Multiple Screens', H2_STYLE, 1))
story.append(para(
    '<b>Files:</b> HomeScreen.tsx, SanctuaryScreen.tsx, MemoriesScreen.tsx, SettingsScreen.tsx<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> Multiple screens call <font name="DejaVuSans" size="8.5">setDoc(doc(db, "couples", '
    'vaultId), { aiMemory: { ...state.aiMemory, explicitMemories: updatedMemories } }, { merge: true })'
    '</font>. Because <font name="DejaVuSans" size="8.5">merge: true</font> does a deep merge, the '
    'partial <font name="DejaVuSans" size="8.5">aiMemory</font> object will be deep-merged with whatever '
    'is currently in the database row. This means if the local <font name="DejaVuSans" size="8.5">'
    'state.aiMemory</font> is stale (due to a missed realtime update), the merge will overwrite the '
    'cloud\'s version of nested fields like <font name="DejaVuSans" size="8.5">chosenInteractions</font> '
    'with stale local values, causing data regression.'
))

story.append(heading('4.7 Vite Define Injects GEMINI_API_KEY Into Client Bundle', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">vite.config.ts</font> (lines 50-52)<br/>'
    '<b>Severity:</b> MEDIUM<br/>'
    '<b>Impact:</b> The Vite config defines <font name="DejaVuSans" size="8.5">process.env.GEMINI_API_KEY</font> '
    'as a compile-time replacement, which means the API key will be embedded in the client-side JavaScript '
    'bundle. Anyone who inspects the bundle can extract the key. The app also stores the API key in '
    'localStorage (SettingsScreen), but the server.ts uses a separate OPENROUTER_API_KEY environment '
    'variable. The GEMINI_API_KEY client-side injection serves no purpose since the AI calls go through '
    'the Supabase Edge Function or server, not directly from the client.'
))


# ============================================================
# 5. LOW SEVERITY FINDINGS
# ============================================================
story.append(heading('5. Low Severity Findings (Code Smell / Minor Issues)', H1_STYLE, 0))

story.append(heading('5.1 Unused firebase.ts File', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/firebase.ts</font><br/>'
    '<b>Severity:</b> LOW<br/>'
    '<b>Impact:</b> This file contains only <font name="DejaVuSans" size="8.5">export const db = {};</font> '
    'and is a leftover from the Firebase migration. It is not imported anywhere in the current codebase. '
    'While harmless, it adds confusion and should be removed.'
))

story.append(heading('5.2 Duplicate Notification Logic in notifications.ts', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/lib/notifications.ts</font><br/>'
    '<b>Severity:</b> LOW<br/>'
    '<b>Impact:</b> The <font name="DejaVuSans" size="8.5">showSystemNotification</font> function in '
    'notifications.ts duplicates most of the logic in notificationService.ts\'s '
    '<font name="DejaVuSans" size="8.5">showLocalNotification</font>. They both handle Capacitor and '
    'web notification display, but with slightly different parameters (e.g., different vibration '
    'durations: 500ms vs 300ms). This creates maintenance burden and inconsistent notification behavior.'
))

story.append(heading('5.3 Hardcoded Partner Names in ChatScreen Import Logic', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/ChatScreen.tsx</font> (lines 326-327)<br/>'
    '<b>Severity:</b> LOW<br/>'
    '<b>Impact:</b> The WhatsApp import logic hardcodes <font name="DejaVuSans" size="8.5">'
    'obadaName = "Obada Shabanieh"</font> and <font name="DejaVuSans" size="8.5">'
    'wifeName = "My Lovely Wife"</font> as the sender name mapping. This makes the import feature '
    'only work for one specific couple\'s chat export. The ImportedChatViewer component also hardcodes '
    '"Obada Shabanieh" as the sender check (line 67). This should be configurable or derived from '
    'the app\'s identity settings.'
))

story.append(heading('5.4 Background Upload Button Does the Same as Profile Upload', H2_STYLE, 1))
story.append(para(
    '<b>File:</b> <font name="DejaVuSans" size="8.5">src/screens/SettingsScreen.tsx</font> (lines 506-519)<br/>'
    '<b>Severity:</b> LOW<br/>'
    '<b>Impact:</b> In the ProfileCard component, both the "Bg" button and "Profile" button call '
    '<font name="DejaVuSans" size="8.5">onPhotoChange(url)</font>, which updates the profile photo. '
    'The "Bg" (background) button should update a different field (e.g., a background photo), but it '
    'calls the same handler. This is likely a copy-paste bug where the background upload handler was '
    'not properly differentiated from the profile upload handler.'
))


# ============================================================
# 6. FINDINGS SUMMARY TABLE
# ============================================================
story.append(heading('6. Findings Summary Table', H1_STYLE, 0))
story.append(Spacer(1, 8))

summary_rows = [
    ['2.1', 'Hardcoded Supabase Credentials', 'CRITICAL', 'supabase.ts'],
    ['2.2', 'Bypassable RLS Policies', 'CRITICAL', 'supabase-setup.sql'],
    ['2.3', 'Firebase Import Will Crash', 'CRITICAL', 'fcm.ts'],
    ['2.4', 'setDoc Race Condition', 'CRITICAL', 'supabaseFirestoreCompat.ts'],
    ['2.5', 'Encryption Plaintext Leak', 'CRITICAL', 'App.tsx'],
    ['2.6', 'Message ID Collisions', 'CRITICAL', 'ChatScreen.tsx'],
    ['3.1', 'onSnapshot Dedup Bug', 'HIGH', 'supabaseFirestoreCompat.ts'],
    ['3.2', 'Realtime Payload Mismatch', 'HIGH', 'supabaseFirestoreCompat.ts'],
    ['3.3', 'Infinite Re-render in Seen Status', 'HIGH', 'ChatScreen.tsx'],
    ['3.4', 'Presence Update Race', 'HIGH', 'App.tsx'],
    ['3.5', 'Typing Status Race', 'HIGH', 'ChatScreen.tsx'],
    ['3.6', 'Network Listener Leak', 'HIGH', 'networkDetection.ts'],
    ['3.7', 'Game Session Auto-Create Loop', 'HIGH', 'SanctuaryScreen.tsx'],
    ['3.8', 'Missing Cleanup in FCM', 'HIGH', 'fcm.ts'],
    ['3.9', 'Session Cookie Secure Flag', 'HIGH', 'server.ts'],
    ['4.1', 'Firebase Error Messages', 'MEDIUM', 'media.ts'],
    ['4.2', 'Backup No Cloud Sync', 'MEDIUM', 'backup.ts'],
    ['4.3', 'WhatsApp Date Parsing', 'MEDIUM', 'ChatScreen.tsx'],
    ['4.4', 'Search Shows Imported', 'MEDIUM', 'App.tsx'],
    ['4.5', 'PWA Manifest Name Wrong', 'MEDIUM', 'vite.config.ts'],
    ['4.6', 'Stale Deep Merge Overwrites', 'MEDIUM', 'Multiple files'],
    ['4.7', 'API Key in Client Bundle', 'MEDIUM', 'vite.config.ts'],
    ['5.1', 'Unused firebase.ts', 'LOW', 'firebase.ts'],
    ['5.2', 'Duplicate Notification Logic', 'LOW', 'notifications.ts'],
    ['5.3', 'Hardcoded Partner Names', 'LOW', 'ChatScreen.tsx'],
    ['5.4', 'Bg Button Same as Profile', 'LOW', 'SettingsScreen.tsx'],
]

col_w = [AVAIL_W * 0.08, AVAIL_W * 0.42, AVAIL_W * 0.15, AVAIL_W * 0.35]
story.append(make_table(['#', 'Finding', 'Severity', 'File'], summary_rows, col_w))


# ============================================================
# 7. RECOMMENDATIONS
# ============================================================
story.append(heading('7. Recommendations', H1_STYLE, 0))

story.append(heading('7.1 Immediate Actions (Before Any Deployment)', H2_STYLE, 1))
story.append(para(
    '<b>1. Remove hardcoded credentials</b> from supabase.ts. Use environment variables exclusively '
    'and fail gracefully when they are not configured. Rotate all exposed keys including the Supabase '
    'anon key and the previously-exposed service_role key.'
))
story.append(para(
    '<b>2. Fix or remove the Firebase dependency</b> in fcm.ts. Since Firebase packages are not in '
    'package.json, the app will crash on startup. Either add Firebase back as a dependency or replace '
    'FCM with a Supabase-native push notification solution.'
))
story.append(para(
    '<b>3. Fix the encryption logic</b> so that when encryption is enabled, only the encrypted payload '
    'is stored in localStorage and synced to the cloud. Never store plaintext state alongside the '
    'encrypted payload.'
))
story.append(para(
    '<b>4. Implement proper RLS policies</b> that require authentication. The current policies that '
    'only check key length provide zero security against anyone with the anon key.'
))

story.append(heading('7.2 Short-Term Fixes (Next Sprint)', H2_STYLE, 1))
story.append(para(
    '<b>5. Fix the read-modify-write race condition</b> in supabaseFirestoreCompat.ts by either (a) '
    'using Supabase RPC functions for atomic operations, (b) implementing optimistic concurrency '
    'control with version columns, or (c) restructuring the data model to use individual rows instead '
    'of a single JSON blob.'
))
story.append(para(
    '<b>6. Fix message ID collisions</b> by using UUIDs or namespaced IDs that distinguish between '
    'app-generated messages and imported WhatsApp messages.'
))
story.append(para(
    '<b>7. Fix the network detection listener leak</b> by returning an unsubscribe function from '
    '<font name="DejaVuSans" size="8.5">initNetworkDetection()</font> and calling it in the useEffect '
    'cleanup.'
))
story.append(para(
    '<b>8. Fix the realtime payload structure mismatch</b> so that both the initial load and realtime '
    'events produce consistent snapshot structures. The <font name="DejaVuSans" size="8.5">payload.new'
    '</font> should be unwrapped the same way as the getDoc result.'
))

story.append(heading('7.3 Medium-Term Improvements', H2_STYLE, 1))
story.append(para(
    '<b>9. Refactor the data model</b> from a single JSON blob per couple to a normalized schema with '
    'separate tables for messages, memories, events, letters, etc. This eliminates the race condition '
    'problems inherent in read-modify-write patterns on a shared JSON blob and enables proper Supabase '
    'realtime subscriptions on granular data changes.'
))
story.append(para(
    '<b>10. Add comprehensive error handling</b> across the app. Many async operations catch errors '
    'with <font name="DejaVuSans" size="8.5">console.error</font> only, without informing the user. '
    'Failed syncs, failed uploads, and failed real-time connections should surface meaningful errors '
    'to the user, not just log to the console.'
))
story.append(para(
    '<b>11. Remove all Firebase references</b> including the stale fcm.ts, the unused firebase.ts, '
    'error messages mentioning "Firebase Storage", and the Vite alias that redirects '
    '<font name="DejaVuSans" size="8.5">firebase/firestore</font> to the compat layer. The migration '
    'is incomplete and these remnants will confuse future developers.'
))
story.append(para(
    '<b>12. Add unit tests</b> for the critical supabaseFirestoreCompat layer, the encryption logic, '
    'and the message merge logic. These are the most bug-prone areas and currently have zero test coverage.'
))


# ━━ Build PDF ━━
OUTPUT_DIR = '/home/z/my-project/download'
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'code_logic_review_report.pdf')

doc = TocDocTemplate(
    OUTPUT_FILE,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
    title='Code Logic Review Report - our-sanctuary-gemini',
    author='Z.ai',
    creator='Z.ai',
)

doc.multiBuild(story)
print(f'PDF generated: {OUTPUT_FILE}')
