import re

with open('index.html', 'r') as f:
    content = f.read()

replacements = [
    # Hex
    (r'#FAF7F2', r'#FCFAEF'),
    (r'#344C4B', r'#0C5446'),
    # rgb(52, 76, 75) -> rgb(12, 84, 70)
    (r'rgb\(52,\s*76,\s*75\)', r'rgb(12, 84, 70)'),
    (r'rgba\(52,\s*76,\s*75,', r'rgba(12, 84, 70,'),
    # rgb(238, 95, 58) -> rgb(255, 103, 0)
    (r'rgb\(238,\s*95,\s*58\)', r'rgb(255, 103, 0)'),
    (r'rgba\(238,\s*95,\s*58,', r'rgba(255, 103, 0,'),
    # rgb(245, 167, 141) -> rgb(255, 163, 102)
    (r'rgb\(245,\s*167,\s*141\)', r'rgb(255, 163, 102)'),
    # rgb(253, 226, 216) -> rgb(255, 239, 229)
    (r'rgb\(253,\s*226,\s*216\)', r'rgb(255, 239, 229)'),
    # rgb(242, 237, 228) -> rgb(234, 227, 214)
    (r'rgb\(242,\s*237,\s*228\)', r'rgb(234, 227, 214)'),
    # rgba(240, 235, 228, ...) -> rgba(219, 208, 189, ...)
    (r'rgba\(240,\s*235,\s*228,', r'rgba(219, 208, 189,'),
    # rgb(250, 247, 242) -> rgb(252, 250, 239)
    (r'rgb\(250,\s*247,\s*242\)', r'rgb(252, 250, 239)')
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open('index.html', 'w') as f:
    f.write(content)

print("Colors updated in index.html!")
