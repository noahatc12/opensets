import re, html
SCREENS = [
 ('today','Today','The hub. Up next as the one tinted surface, the week as a ring, two numbers, recent sessions.'),
 ('log','Log a set','The whole screen is the active set. Steppers under the numerals, plates as colour, RPE as a segmented control, rest as a ring.'),
 ('rest','Rest, mid-set','The rest timer takes over the bottom sheet and counts down; the next set is already staged.'),
 ('pr','New record','The moment: full-bleed gold, the number springs in, one tap to continue.'),
 ('summary','Summary','"Nice work." Four tiles, then each exercise with its sets and a PR mark, save or discard.'),
 ('plan','Plan','The block and week, then each day as a card with the next one lifted and tinted.'),
 ('builder','Routine builder','Edit a day: reorder, sets and rep range as steppers, add or remove.'),
 ('picker','Add exercise','The exercise picker sheet: search, muscle chips, rows with a best and a plus.'),
 ('plates','Plate math','The plate sheet: the bar drawn with real plate colours, total, per side, and what is missing.'),
 ('library','Library','873 exercises: search, muscle chips, rows with your best.'),
 ('detail','Exercise detail','One lift: best, last top set, the e1RM curve, how to, history.'),
 ('trends','Trends','One lift, a range, the curve with records marked, weekly volume, records list.'),
 ('you','You','Stats, units, one appearance toggle, training defaults, body, data. No theme picker.'),
 ('onboarding','Onboarding','Five questions as a card stack with a progress bar, then a plan preview.'),
]
base = open('../lab/base.css', encoding='utf-8').read()
css = open('premium.css', encoding='utf-8').read()
src = open('premium.html', encoding='utf-8').read()
cells = {m.group(1): m.group(2) for m in re.finditer(r'<article data-screen="(\w+)">(.*?)</article>', src, re.S)}
out = ['''<meta charset="utf-8"><title>OpenSets Premium</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap">
<style>''' + base + '\n' + css + '''
.rail{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px 16px;overflow:visible}
.cell{width:100%}
.frame{margin:0 auto}
</style>
<h1>OpenSets Premium</h1>
<p class="lede">One look, every screen and sheet. Built from your notes: depth and finished components over flat text, one accent used for the one action, no appearance picker, the sheets kept. Tap a phone for full size, then react on each. Motion is described under each render because a still cannot show it; the build will.</p>
<div class="controls"><div class="group"><b>Size</b><button class="chip" type="button" id="zoom" aria-pressed="false">Large</button></div><span class="hint">Your reactions and notes save as you go.</span></div>
<div class="rail">''']
for scr, name, about in SCREENS:
    body = cells.get(scr, '<div class="ph"><div class="body" style="display:grid;place-items:center;color:#888">not rendered</div></div>')
    key = f'iron-{scr}'
    out.append(f'<div class="cell" data-style="iron"><figure><div class="frame" tabindex="0" role="button" aria-label="{name}, open full size"><div class="ph" data-ds="iron">{body}</div></div><figcaption><b>{name}</b></figcaption></figure><p class="about" style="margin:6px 0 0">{html.escape(about)}</p>'
               f'<div class="fb" data-key="{key}"><button type="button" class="v" data-v="love" aria-pressed="false">Love it</button><button type="button" class="v" data-v="no" aria-pressed="false">Not this</button><button type="button" class="v note-btn" aria-expanded="false">Note</button>'
               f'<textarea id="note-{key}" class="note" rows="3" placeholder="What works, what does not" aria-label="Note on {name}" hidden></textarea><span class="saved" aria-live="polite"></span></div></div>')
out.append('</div>')
out.append('<section id="motion"><h2>How it moves (not visible in stills)</h2><ul>'
 '<li><b>Press.</b> Every button scales to 0.97 on touch with a 120 ms spring and returns on release; no colour flash.</li>'
 '<li><b>Log a set.</b> The CTA depresses, the set row slides up into the done list, the next row unfolds into the active card, and the rest ring starts from full. One orchestrated 400 ms sequence with a light haptic.</li>'
 '<li><b>Numbers.</b> Weight and rep changes roll like an odometer (each digit slides), 180 ms, so the eye reads what changed.</li>'
 '<li><b>Rest.</b> The ring drains continuously; at zero it pulses once, a medium haptic fires, and the label flips to Go.</li>'
 '<li><b>Record.</b> Gold fills from the CTA outward (a radial reveal, 320 ms), the number springs from 0.6 to 1 with overshoot, confetti is not used.</li>'
 '<li><b>Sheets.</b> Rise with a spring (damping 0.86), the scrim fades; drag the grabber to dismiss. The tab bar sinks under the scrim.</li>'
 '<li><b>Tab bar.</b> Floats as a glass capsule; shrinks to a pill on scroll down and returns on scroll up.</li>'
 '<li><b>Reduced motion.</b> Every sequence collapses to a crossfade; haptics stay.</li>'
 '</ul></section>')
out.append('<section id="overall"><h2>Overall notes</h2><textarea id="overall-note" class="note big" rows="4" placeholder="Start typing. Saved when you pause." aria-label="Overall notes"></textarea><div class="saved" id="overall-saved" aria-live="polite"></div></section>')
out.append('''<dialog id="big" style="border:0;padding:0;background:transparent;max-width:100vw;max-height:100vh"><div id="bigwrap" style="position:relative"></div><button type="button" id="bigclose" style="position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:16px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:8px 14px;font:inherit;cursor:pointer">Close</button></dialog>
<script>
const z=document.getElementById('zoom');
z.addEventListener('click',()=>{const big=z.getAttribute('aria-pressed')!=='true';z.setAttribute('aria-pressed',String(big));document.documentElement.style.setProperty('--zoom',big?'1':'.56');});
const dlg=document.getElementById('big'),wrap=document.getElementById('bigwrap');
function open(frame){const c=frame.cloneNode(true);c.style.zoom='1';c.style.height='min(844px,92vh)';c.style.width='calc(min(844px,92vh) * 390 / 844)';c.removeAttribute('tabindex');wrap.replaceChildren(c);dlg.showModal();}
document.querySelectorAll('.frame').forEach(f=>{f.addEventListener('click',()=>open(f));f.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(f);}});});
document.getElementById('bigclose').addEventListener('click',()=>dlg.close());
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
(async()=>{
  const fbs=[...document.querySelectorAll('.fb')];
  const overall=document.getElementById('overall-note'), overallSaved=document.getElementById('overall-saved');
  const paint=(el,d)=>{el.querySelectorAll('.v[data-v]').forEach(b=>b.setAttribute('aria-pressed',String((d&&d.verdict)===b.dataset.v)));const ta=el.querySelector('.note');if(d&&d.note&&document.activeElement!==ta){ta.value=d.note;ta.hidden=false;el.querySelector('.note-btn').setAttribute('aria-expanded','true');}};
  fbs.forEach(el=>{el.querySelector('.note-btn').addEventListener('click',()=>{const ta=el.querySelector('.note');ta.hidden=!ta.hidden;el.querySelector('.note-btn').setAttribute('aria-expanded',String(!ta.hidden));if(!ta.hidden)ta.focus();});});
  let db=null;
  try{db=window.claude&&window.claude.use?await window.claude.use('db'):null;}catch(e){db=null;}
  if(!db){document.querySelectorAll('.saved').forEach(s=>s.textContent='Saving is unavailable in this view');fbs.forEach(el=>el.querySelectorAll('button,textarea').forEach(b=>b.disabled=true));overall.disabled=true;return;}
  const col=db.collection('feedback');const state={};
  col.onSnapshot(snap=>{snap.docs.forEach(d=>{state[d.id]=d.data();const el=document.querySelector(`.fb[data-key="${d.id}"]`);if(el)paint(el,d.data());if(d.id==='overall'&&document.activeElement!==overall)overall.value=d.data().note||'';});},()=>{});
  const busy={};
  async function save(id,patch,savedEl){if(busy[id])return;busy[id]=true;const next={...(state[id]||{}),...patch,updatedAt:new Date().toISOString()};try{await col.doc(id).set(next);state[id]=next;savedEl.textContent='Saved';setTimeout(()=>{savedEl.textContent='';},1400);}catch(e){savedEl.textContent='Could not save';}busy[id]=false;}
  fbs.forEach(el=>{const id=el.dataset.key,savedEl=el.querySelector('.saved'),ta=el.querySelector('.note');
    el.querySelectorAll('.v[data-v]').forEach(b=>b.addEventListener('click',()=>{const cur=state[id]&&state[id].verdict;const v=cur===b.dataset.v?null:b.dataset.v;paint(el,{...(state[id]||{}),verdict:v});save(id,{verdict:v},savedEl);}));
    let t;ta.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>save(id,{note:ta.value},savedEl),900);});
    ta.addEventListener('blur',()=>{clearTimeout(t);if((state[id]&&state[id].note||'')!==ta.value)save(id,{note:ta.value},savedEl);});});
  let ot;overall.addEventListener('input',()=>{clearTimeout(ot);ot=setTimeout(()=>save('overall',{note:overall.value},overallSaved),900);});
  overall.addEventListener('blur',()=>{clearTimeout(ot);if((state.overall&&state.overall.note||'')!==overall.value)save('overall',{note:overall.value},overallSaved);});
})();
</script>''')
open('index.html', 'w', encoding='utf-8').write('\n'.join(out))
print('built; missing:', [s for s, _, _ in SCREENS if s not in cells])
