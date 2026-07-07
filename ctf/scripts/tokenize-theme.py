#!/usr/bin/env python3
import sys, re

CHROME = {
    "#0F1117":"BG", "#0D0F14":"HEADER", "#090B0F":"RAIL",
    "#E8EAF0":"TEXT", "#F9FAFB":"TITLE", "#9CA3AF":"SUBTLE",
    "#6B7280":"MUTED", "#4B5563":"FAINT",
}
RGBA = {
    "rgba(255,255,255,0.06)":"BORDER", "rgba(255, 255, 255, 0.06)":"BORDER",
    "rgba(255,255,255,0.08)":"BORDER_STRONG", "rgba(255, 255, 255, 0.08)":"BORDER_STRONG",
    "rgba(255,255,255,0.1)":"BORDER_HI", "rgba(255,255,255,0.10)":"BORDER_HI", "rgba(255, 255, 255, 0.1)":"BORDER_HI",
    "rgba(255,255,255,0.04)":"INPUT_BG", "rgba(255, 255, 255, 0.04)":"INPUT_BG",
}

def match_close(text, i, opench, closech):
    depth=0; n=len(text)
    while i<n:
        c=text[i]
        if c==opench: depth+=1
        elif c==closech:
            depth-=1
            if depth==0: return i
        i+=1
    return -1

def find_bodies(text, accent_hex=None):
    # returns list of (body_open_index) for PascalCase components that reference t.
    bodies=[]
    for m in re.finditer(r'(?:export\s+)?(?:function\s+([A-Z]\w*)\s*|const\s+([A-Z]\w*)\s*(?::[^=\n]+)?=\s*)', text):
        j=m.end()
        # skip to '(' that starts params
        while j<len(text) and text[j] in ' \t\n': j+=1
        if j>=len(text) or text[j] != '(':
            continue
        close=match_close(text, j, '(', ')')
        if close<0: continue
        k=close+1
        # for arrow: expect optional ': ret' then '=>' then '{'
        # for function: expect optional ': ret' then '{'
        # find next '{' or '=>' 
        seg=text[k:k+200]
        arrow = '=>' in seg[:seg.find('{')] if '{' in seg else False
        brace=text.find('{', k)
        if brace<0: continue
        bodies.append(brace)
    return bodies

def main():
    path=sys.argv[1]; getter=sys.argv[2]; shared=sys.argv[3]
    accent=sys.argv[4] if len(sys.argv)>4 else "COLOR"
    accent_hex=sys.argv[5] if len(sys.argv)>5 else None
    src=open(path).read(); orig=src

    for hx,tok in CHROME.items():
        for q in ("'",'"'):
            src=re.sub(re.escape(q)+re.escape(hx)+re.escape(q), "t."+tok, src, flags=re.IGNORECASE)
    for rg,tok in RGBA.items():
        for q in ("'",'"'):
            src=src.replace(q+rg+q, "t."+tok)
    if accent_hex:
        for q in ("'",'"'):
            src=re.sub(q+re.escape(accent_hex)+q, "t.ACCENT", src, flags=re.IGNORECASE)
    src=re.sub(r'\b'+re.escape(accent)+r'\b', 't.ACCENT', src)
    src=re.sub(r'^\s*const t\.ACCENT = [^\n]*\n', '', src, flags=re.MULTILINE)

    lines=src.split('\n'); last_imp=-1
    for i,l in enumerate(lines):
        if l.startswith('import '): last_imp=i
    inserts=[]
    if "from '@/hooks/useTheme'" not in src: inserts.append("import { useTheme } from '@/hooks/useTheme';")
    if ("from '"+shared+"'") not in src: inserts.append("import { "+getter+" } from '"+shared+"';")
    if inserts and last_imp>=0:
        lines=lines[:last_imp+1]+inserts+lines[last_imp+1:]
    src='\n'.join(lines)

    hook="\n  const { theme } = useTheme();\n  const t = "+getter+"(theme);"
    edits=[]
    for brace in find_bodies(src):
        end=match_close(src, brace, '{','}')
        if end<0: continue
        body=src[brace+1:end]
        if 't.' in body and 'const t =' not in body and 'const { theme }' not in body:
            edits.append(brace+1)
    for pos in sorted(set(edits), reverse=True):
        src=src[:pos]+hook+src[pos:]

    # detect module-scope t. leakage (t. used before any 'const t =' scope) -> warn
    if src!=orig:
        open(path,'w').write(src); print("CHANGED "+path)
    else:
        print("nochange "+path)

main()
