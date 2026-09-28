"""Build the Button Audit page's data from an interaction crawl.

Reads .shots/crawl/crawl.json and its pictures (scripts/interaction-crawl.mjs), writes
.shots/crawl-report/report.json and one picture sheet per screen, beside index.html.
Every press gets a verdict: ok, expected (a press that rightly changes nothing), look (a
press that works but should work differently: a note says why), nothing, or error.

    python scripts/crawl-report.py
"""
import json
import os
import shutil
from PIL import Image

SRC = '.shots/crawl'
OUT = '.shots/crawl-report'
CW, CH, COLS = 130, 282, 10

TITLES = {
    'today-empty': 'Today, first open',
    'today': 'Today',
    'plan': 'Plan',
    'plan-pull-open': 'Plan, Pull open',
    'builder-new-day': 'New day',
    'builder-edit-push': 'Edit a day (Push)',
    'sheet-exercise-picker': 'Add exercise (builder)',
    'library': 'Library',
    'sheet-filters': 'Library filters',
    'exercise-detail': 'Exercise',
    'trends': 'Trends',
    'you': 'You',
    'sheet-erase': 'Erase all data?',
    'plates': 'Bar and plates',
    'rest-defaults': 'Rest times',
    'profile': 'Profile',
    'goals': 'Goals',
    'measurements': 'Measurements',
    'sheet-new-goal': 'New goal',
    'sheet-log-measurement': 'Log measurement',
    'onboarding-1': 'Plan questions 1: goal',
    'onboarding-2': 'Plan questions 2: days',
    'onboarding-3': 'Plan questions 3: experience',
    'onboarding-4': 'Plan questions 4: numbers',
    'onboarding-5': 'Plan questions 5: your plan',
    'workout': 'Workout',
    'sheet-keypad': 'Workout, typing a weight',
    'sheet-plate-math': 'Workout, plate math',
    'sheet-swap-picker': 'Workout, Swap',
    'workout-rest': 'Workout, resting',
    'workout-summary': 'Workout summary',
    'sheet-discard': 'Discard this workout?',
    'workout-tucked-library': 'Library with a workout in progress',
}

# My read of presses the crawler cannot judge alone, keyed "state#name" (first match by
# name prefix). Verdict "expected": rightly changes nothing. "look": works, should change.
JUDGE = json.load(open('scripts/crawl-judgments.json', encoding='utf-8')) if os.path.exists(
    'scripts/crawl-judgments.json') else {}


def judge(p):
    # An exact name wins over a prefix ("Skip" is not "Skip rest").
    keyed = [(k.partition('#'), v) for k, v in JUDGE.items()]
    for (st, _, name), v in keyed:
        if st in (p['state'], '*') and p['name'] == name:
            return v
    for (st, _, name), v in keyed:
        if st in (p['state'], '*') and p['name'].startswith(name):
            return v
    return None


def main():
    crawl = json.load(open(f'{SRC}/crawl.json', encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    states, presses = [], []
    for s in crawl['states']:
        sid = s['id']
        mine = sorted([p for p in crawl['presses'] if p['state'] == sid], key=lambda p: p['i'])
        pics = [f'{SRC}/{sid}/_state.jpg'] + [f"{SRC}/{sid}/{str(p['i']).zfill(2)}.jpg" for p in mine]
        rows = (len(pics) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * CW, max(1, rows) * CH), (30, 30, 34))
        for n, f in enumerate(pics):
            if os.path.exists(f):
                sheet.paste(Image.open(f).convert('RGB').resize((CW, CH)), ((n % COLS) * CW, (n // COLS) * CH))
        name = f'sheet-{sid}.jpg'
        sheet.save(f'{OUT}/{name}', quality=62, optimize=True)
        cell = lambda n: {'sprite': name, 'col': n % COLS, 'row': n // COLS}
        states.append({'id': sid, 'title': TITLES.get(sid, sid), 'route': s.get('route', '').lstrip('#'),
                       'cell': cell(0), 'broken': s.get('broken')})
        for n, p in enumerate(mine, start=1):
            v = {'state': sid, 'i': p['i'], 'name': p['name'], 'cell': cell(n)}
            if p.get('failed') or p.get('skipped'):
                v['verdict'] = 'error' if p.get('failed') else 'expected'
                v['problem'] = p.get('failed') or f"Not pressed: {p.get('skipped')}"
            else:
                v['said'] = '; '.join(p.get('said') or []) or 'nothing'
                if p.get('errors'):
                    v['verdict'] = 'error'
                    v['note'] = 'An error on the page: ' + p['errors'][0][:140]
                elif p.get('dead'):
                    v['verdict'] = 'nothing'
                else:
                    v['verdict'] = 'ok'
                j = judge(p)
                if j:
                    v['verdict'] = j['verdict']
                    v['note'] = j['note']
            presses.append(v)
    report = {'ranAt': crawl['ranAt'][:16].replace('T', ' ') + ' UTC', 'base': '',
              'sprite': {'w': CW, 'h': CH, 'cols': COLS}, 'states': states, 'presses': presses}
    json.dump(report, open(f'{OUT}/report.json', 'w', encoding='utf-8'), ensure_ascii=False)
    shutil.copy('scripts/crawl-report.html', f'{OUT}/index.html')
    size = sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT))
    counts = {}
    for p in presses:
        counts[p['verdict']] = counts.get(p['verdict'], 0) + 1
    print(f'{len(states)} states, {len(presses)} presses, {counts}, {size / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
