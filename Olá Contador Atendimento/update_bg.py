import re

# Update styles.css
with open('styles.css', 'r') as f:
    css_content = f.read()

# Replace the specific variables in styles.css
css_content = re.sub(r'--color-bg: #DBD0BD;', r'--color-bg: #EBEBDF;', css_content)
css_content = re.sub(r'--color-card: #FCFAEF;', r'--color-card: #FFFFFF;', css_content) # Maybe keep white for cards if bg is EBEBDF? Or maybe EBEBDF is just the new --color-bg. Let's just do what's asked.

with open('styles.css', 'w') as f:
    f.write(css_content)


# Update index.html
with open('index.html', 'r') as f:
    html_content = f.read()

# I previously set #FCFAEF for the background in index.html
html_content = re.sub(r'#FCFAEF', r'#EBEBDF', html_content)
html_content = re.sub(r'rgb\(252,\s*250,\s*239\)', r'rgb(235, 235, 223)', html_content) # hex to rgb for EBEBDF

with open('index.html', 'w') as f:
    f.write(html_content)

print("Background color updated to #EBEBDF!")
