from pathlib import Path
import json
p=Path(__file__).resolve().parent
html=(p/'index.html').read_text().replace('</style>',(p/'style.css').read_text()+'</style>')
js=(p/'app.js').read_text().replace('BRAND_URL',json.dumps((p/'brand.txt').read_text()))
assets='const html='+json.dumps(html)+';\nconst client='+json.dumps(js)+';\nconst seed='+ (p/'seed.json').read_text()+';\n'
(p/'dist/server/index.js').write_text(assets+(p/'worker.mjs').read_text())
