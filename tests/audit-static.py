"""Auditoría estática del proyecto. Solo usa la biblioteca estándar de Python 3."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = []


class PageParser(HTMLParser):
    """Recoge IDs, anchors y referencias locales del HTML estático."""

    def __init__(self):
        super().__init__()
        self.ids = []
        self.anchors = []  # (href, data-action)
        self.refs = []     # rutas locales a scripts, hojas de estilo, imágenes e iconos
        self.tag_stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'a' and a.get('href'):
            self.anchors.append((a['href'], a.get('data-action')))
        if tag == 'script' and a.get('src'):
            self.refs.append(a['src'])
        elif tag == 'link' and a.get('href') and (a.get('rel') or '') in ('stylesheet', 'icon', 'manifest', 'preload'):
            self.refs.append(a['href'])
        elif tag == 'img' and a.get('src'):
            self.refs.append(a['src'])
        if tag not in ('meta', 'link', 'img', 'br', 'input', 'hr'):
            self.tag_stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.tag_stack:
            while self.tag_stack and self.tag_stack.pop() != tag:
                pass


def is_remote(path):
    return path.startswith(('https://', 'http://', 'data:', '//'))


html = (ROOT / 'index.html').read_text(encoding='utf-8')
page = PageParser()
page.feed(html)
page.close()
checks.append('HTML parseable')

for item in sorted({i for i in page.ids if page.ids.count(i) > 1}):
    errors.append(f'duplicated HTML id: {item}')
checks.append('Unique static HTML IDs')

for path in page.refs:
    if not is_remote(path) and not (ROOT / path.split('?')[0]).exists():
        errors.append(f'missing referenced file: {path}')
checks.append('Local scripts, stylesheet, icons and static images exist')

for href, action in page.anchors:
    if href.startswith('#') and href[1:] not in page.ids and action != 'privacy':
        errors.append(f'anchor target missing: {href}')
checks.append('Static in-page anchors resolve or are handled by an action')

for needle, label in [
    ('<meta name="description"', 'meta description'),
    ('property="og:title"', 'Open Graph title'),
    ('property="og:image"', 'Open Graph image'),
    ('name="twitter:card"', 'Twitter card'),
    ('rel="icon"', 'favicon'),
]:
    if needle not in html:
        errors.append(f'missing SEO metadata: {label}')
checks.append('SEO and social metadata present')

if 'fonts.googleapis.com' in html or 'fonts.gstatic.com' in html:
    errors.append('HTML depends on Google Fonts; fonts must be served from assets/fonts/')
checks.append('No external font dependencies')

# Sistema tipográfico: cada @font-face apunta a un archivo local existente, cada fuente precargada existe y
# solo hay dos familias en uso (serif editorial y sans de interfaz), siempre a través de las variables.
css_text = (ROOT / 'styles.css').read_text(encoding='utf-8')
face_files = re.findall(r'@font-face\s*{[^}]*url\("([^"]+)"\)', css_text)
if len(face_files) < 3:
    errors.append('CSS: se esperaban al menos 3 @font-face (DM Sans, Cormorant Garamond y su cursiva)')
for path in face_files:
    if not path.startswith('assets/fonts/') or not (ROOT / path).exists():
        errors.append(f'font file missing or not local: {path}')
for preload in re.findall(r'<link rel="preload" href="([^"]+)" as="font"[^>]*>', html):
    if preload not in face_files:
        errors.append(f'preloaded font is not declared in CSS: {preload}')
    if 'crossorigin' not in re.search(r'<link rel="preload" href="' + re.escape(preload) + r'"[^>]*>', html).group(0):
        errors.append(f'font preload without crossorigin (it would be downloaded twice): {preload}')
for family in re.findall(r'(?<![-\w])font-family:\s*([^;}]+)', css_text):
    family = family.strip()
    if not (family.startswith('var(--sans)') or family.startswith('var(--serif)') or family.startswith('"DM Sans"') or family.startswith('"Cormorant Garamond"')):
        errors.append(f'font-family outside the system (use var(--sans) or var(--serif)): {family[:50]}')
checks.append('Typography system: local fonts declared and preloaded, only DM Sans and Cormorant Garamond in use')

# Alt text en todas las imágenes estáticas.
for match in re.finditer(r'<img\b[^>]*>', html):
    if 'alt=' not in match.group(0):
        errors.append(f'<img> without alt: {match.group(0)[:60]}')
checks.append('Static images have alt text')


def balanced(text, open_ch, close_ch):
    """Comprueba el balance de llaves ignorando cadenas y comentarios simples."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '', text)
    depth = 0
    for ch in text:
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


css = (ROOT / 'styles.css').read_text(encoding='utf-8')
if not balanced(css, '{', '}'):
    errors.append('CSS: unbalanced braces')
if not balanced(css, '(', ')'):
    errors.append('CSS: unbalanced parentheses')
checks.append('Stylesheet braces and parentheses are balanced')

js_files = ['app.js', 'data.js', 'pricing.js', 'assistant.js']
for filename in js_files:
    text = (ROOT / filename).read_text(encoding='utf-8')
    if '\x00' in text:
        errors.append(f'NUL character in {filename}')
    for reference in re.findall(r'assets/[A-Za-z0-9._-]+', text):
        if not (ROOT / reference).exists():
            errors.append(f'missing referenced asset in {filename}: {reference}')
for reference in re.findall(r'assets/[A-Za-z0-9._-]+', css):
    if not (ROOT / reference).exists():
        errors.append(f'missing CSS asset: {reference}')
checks.append('JavaScript source files and referenced demo assets exist')

if errors:
    print('FAIL')
    for error in errors:
        print(' -', error)
    raise SystemExit(1)
print('PASS: ' + '; '.join(checks))
