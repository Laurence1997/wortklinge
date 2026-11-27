"""Shared DeepSeek batch runner for the proof scripts (2026-11-27, Lucas: save as you go, stop when the balance runs out,
resume from where it stopped). Results are appended to a .jsonl file one batch at a time; every batch id that finished is
in it, so a rerun skips them. Spending is counted from the API's own usage numbers and the run stops at ZH_BUDGET (CNY).
A 402 (no balance) stops everything at once. Every PUSH_EVERY batches the results are committed and pushed to the branch."""
import json, os, sys, time, threading, subprocess, urllib.request, urllib.error, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# CNY per 1M tokens (api-docs.deepseek.com/zh-cn/quick_start/pricing, read 2026-11-27): idle prices; peak is twice that
# (Beijing time Mon–Fri 9–12 and 14–18; public holidays are idle too, counted as peak here to be safe).
PRICES = {'deepseek-v4-pro': (0.15, 4.5, 13.5), 'deepseek-flash': (0.02, 1.0, 4.0)}


def peak_factor():
    import datetime
    bj = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    return 2.0 if bj.weekday() < 5 and (9 <= bj.hour < 12 or 14 <= bj.hour < 18) else 1.0


class Stop(Exception):
    pass


def run(name, system, batches, model, budget, threads=10, push_every=100, time_limit=6000):
    """batches: list of (batch_id, user_text, payload). Writes proof/out/<name>.jsonl lines {batch, items}."""
    key = os.environ['DEEPSEEK_API_KEY']
    out = os.path.join(ROOT, 'proof/out', name + '.jsonl')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    done = set()
    if os.path.exists(out):
        for l in open(out, encoding='utf-8'):
            try:
                done.add(json.loads(l)['batch'])
            except Exception:
                pass  # a line cut off by a crash: that batch just runs again
    todo = [b for b in batches if b[0] not in done]
    hit_p, miss_p, out_p = PRICES.get(model, PRICES['deepseek-v4-pro'])
    state = {'cost': 0.0, 'n': 0, 'stop': None}
    lock = threading.Lock()
    t0 = time.time()
    print(f'{name}: {len(batches)} batches, {len(done)} already done, {len(todo)} to go, budget {budget} CNY', flush=True)

    def call(b):
        bid, user, _ = b
        if state['stop']:
            return
        body = {'model': model, 'temperature': 0, 'response_format': {'type': 'json_object'}, 'thinking': {'type': 'disabled'},
                'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}
        for attempt in range(4):
            if state['stop']:
                return
            try:
                req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=json.dumps(body).encode(),
                                             headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=300) as r:
                    res = json.load(r)
                u = res.get('usage', {})
                hit = u.get('prompt_cache_hit_tokens', 0)
                miss = u.get('prompt_cache_miss_tokens', u.get('prompt_tokens', 0) - hit)
                c = (hit * hit_p + miss * miss_p + u.get('completion_tokens', 0) * out_p) / 1e6 * peak_factor()
                txt = res['choices'][0]['message']['content']
                items = json.loads(txt[txt.find('{'):txt.rfind('}') + 1]).get('items', [])
                with lock:
                    state['cost'] += c
                    state['n'] += 1
                    with open(out, 'a', encoding='utf-8') as f:
                        f.write(json.dumps({'batch': bid, 'ids': b[2], 'items': items}, ensure_ascii=False) + '\n')
                    if state['cost'] >= budget:
                        state['stop'] = f'budget {budget} CNY reached'
                    elif time.time() - t0 > time_limit:
                        state['stop'] = 'time limit'
                return
            except urllib.error.HTTPError as e:
                if e.code == 402:
                    state['stop'] = '402 Payment Required: DeepSeek balance is empty'
                    return
                print('retry', bid, attempt, e, file=sys.stderr)
            except Exception as e:
                print('retry', bid, attempt, e, file=sys.stderr)
            if attempt == 1:
                body.pop('thinking', None)
            time.sleep(5 * (attempt + 1))

    with cf.ThreadPoolExecutor(threads) as ex:
        futs = [ex.submit(call, b) for b in todo]
        last = 0
        for i, _ in enumerate(cf.as_completed(futs)):
            if state['n'] - last >= push_every:
                last = state['n']
                print(f"{state['n']}/{len(todo)} cost {state['cost']:.2f} CNY", flush=True)
                with lock:
                    push(name, f"{state['n']} batches")
            if state['stop']:
                for f in futs:
                    f.cancel()
    left = len(batches) - len(done) - state['n']
    msg = f"{name}: this run {state['n']} batches, {state['cost']:.2f} CNY; {left} batches left" + (f"; stopped: {state['stop']}" if state['stop'] else '')
    print(msg, flush=True)
    open(os.path.join(ROOT, 'proof/out', name + '.status.txt'), 'w').write(msg + '\n')
    push(name, msg)
    return state


def push(name, msg):
    if not os.environ.get('GITHUB_ACTIONS'):
        return
    try:
        subprocess.run(['git', 'config', 'user.name', 'github-actions'], cwd=ROOT)
        subprocess.run(['git', 'config', 'user.email', 'github-actions@users.noreply.github.com'], cwd=ROOT)
        subprocess.run(['git', 'add', '-f', f'proof/out/{name}.jsonl'] + ([f'proof/out/{name}.status.txt'] if os.path.exists(os.path.join(ROOT, f'proof/out/{name}.status.txt')) else []), cwd=ROOT)
        if subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=ROOT).returncode == 0:
            return
        subprocess.run(['git', 'commit', '-qm', f'proof progress {name}: {msg}'], cwd=ROOT)
        for _ in range(4):
            subprocess.run(['git', 'pull', '-q', '--rebase', 'origin', os.environ.get('GITHUB_REF_NAME', '')], cwd=ROOT)
            if subprocess.run(['git', 'push', '-q', 'origin', 'HEAD:' + os.environ.get('GITHUB_REF_NAME', '')], cwd=ROOT).returncode == 0:
                return
            time.sleep(5)
    except Exception as e:
        print('push failed', e, file=sys.stderr)
