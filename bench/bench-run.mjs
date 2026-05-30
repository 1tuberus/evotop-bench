// bench-run.mjs - free coding-model tournament (pass@1, sandboxed). Zero-dep Node >=20.
// Methodology: HumanEval/BigCodeBench style - hidden tests, model generates code,
// code executed in an isolated Docker container (network none, mem/cpu/pid limits, timeout).
// Models routed: HF Router (real distinct models) + provider-free (Gemini/Groq). Agent 007 2026-05-30.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function envFile(p){ const o={}; try{ for(const l of readFileSync(p,'utf8').split('\n')){ const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m)o[m[1]]=m[2]; } }catch{} return o; }
// Local: keys from /opt/evo3/.env. GHA: from process.env (repo secrets) which wins.
const E = { ...envFile('/opt/evo3/.env'), ...process.env };
const FREE_URL = (E.FREE_URL||'http://127.0.0.1:3031').replace(/\/$/,'');
const FREE_KEY = E.FREE_KEY||'';
const HF = E.HF_TOKEN||'';

// TOP-10 free models (verified routable to DISTINCT backends 2026-05-30)
const MODELS = [
  { id:'Qwen/Qwen3-Coder-480B-A35B-Instruct', label:'Qwen3-Coder-480B', backend:'hf' },
  { id:'Qwen/Qwen2.5-Coder-32B-Instruct',     label:'Qwen2.5-Coder-32B', backend:'hf' },
  { id:'deepseek-ai/DeepSeek-V3-0324',        label:'DeepSeek-V3-0324', backend:'hf' },
  { id:'moonshotai/Kimi-K2-Instruct',         label:'Kimi-K2', backend:'hf' },
  { id:'meta-llama/Llama-3.3-70B-Instruct',   label:'Llama-3.3-70B', backend:'hf' },
  { id:'Qwen/Qwen2.5-72B-Instruct',           label:'Qwen2.5-72B', backend:'hf' },
  { id:'openai/gpt-oss-120b',                 label:'gpt-oss-120B (Groq)', backend:'free' },
  { id:'gemini-3.5-flash',                    label:'Gemini 3.5 Flash', backend:'free' },
  { id:'gemini-2.5-flash',                    label:'Gemini 2.5 Flash', backend:'free' },
  { id:'gemini-2.5-flash-lite',               label:'Gemini 2.5 Flash-Lite', backend:'free' },
];

// GHA-optimization: configurable lightweight sandbox image + backend filter.
// BENCH_BACKENDS=hf  -> run only HuggingFace-reachable models (provider-free is Poland-localhost, unreachable from a cloud runner).
const SANDBOX_IMG = process.env.SANDBOX_IMG || 'python:3.12-alpine';
const BACKENDS = process.env.BENCH_BACKENDS ? process.env.BENCH_BACKENDS.split(',').map(s => s.trim()) : null;
const RUN_MODELS = BACKENDS ? MODELS.filter(m => BACKENDS.includes(m.backend)) : MODELS;

const TASKS = [
  { name:'expr_eval', title:'Expression Evaluator (recursive-descent parsing, precedence)',
    prompt:'Implement a Python function:\n\ndef evaluate(expr: str) -> float:\n    """Evaluate an arithmetic expression string supporting + - * / , parentheses, unary minus, integers and floats, with standard operator precedence. Examples: evaluate("2+3*4")==14.0, evaluate("(2+3)*4")==20.0, evaluate("-5+3")==-2.0, evaluate("10/4")==2.5."""\n\nReturn ONLY one Python code block with the complete function. No explanation.',
    test:'\ntol=1e-6\ncases=[("2+3*4",14),("(2+3)*4",20),("10/4",2.5),("-5+3",-2),("2*(3+(4-1))",12),("((1))",1),("2 + 2",4),("3*-2",-6),("100/5/2",10),("1+2*3-4/2",5)]\nfor e,exp in cases:\n    got=evaluate(e)\n    assert abs(got-exp)<tol, f"{e} -> {got} != {exp}"\nprint("PASS")\n' },
  { name:'min_window', title:'Minimum Window Substring (sliding window, edge cases)',
    prompt:'Implement a Python function:\n\ndef min_window(s: str, t: str) -> str:\n    """Return the minimum-length substring of s that contains every character of t (counting multiplicity). If no such window exists, return the empty string. Examples: min_window("ADOBECODEBANC","ABC")=="BANC", min_window("a","a")=="a", min_window("a","aa")=="""."""\n\nReturn ONLY one Python code block with the complete function. No explanation.',
    test:'\ncases=[("ADOBECODEBANC","ABC","BANC"),("a","a","a"),("a","aa",""),("aa","aa","aa"),("ab","b","b"),("cabwefgewcwaefgcf","cae","cwae"),("","a","")]\nfor s,t,exp in cases:\n    got=min_window(s,t)\n    assert got==exp, f"min_window({s!r},{t!r}) -> {got!r} != {exp!r}"\nprint("PASS")\n' },
  { name:'sudoku', title:'Sudoku Solver (backtracking, constraint search)',
    prompt:'Implement a Python function:\n\ndef solve_sudoku(board):\n    """Solve a 9x9 Sudoku puzzle. board is a list of 9 lists of 9 ints, where 0 marks an empty cell. Return the solved 9x9 grid (list of lists of ints 1-9). Assume a unique solution exists."""\n\nReturn ONLY one Python code block with the complete function. No explanation.',
    test:'\npuzzle=[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]]\nsol=solve_sudoku([r[:] for r in puzzle])\ndef ok(g):\n    for i in range(9):\n        if sorted(g[i])!=list(range(1,10)): return False\n        if sorted(g[r][i] for r in range(9))!=list(range(1,10)): return False\n    for br in range(0,9,3):\n        for bc in range(0,9,3):\n            b=[g[br+i][bc+j] for i in range(3) for j in range(3)]\n            if sorted(b)!=list(range(1,10)): return False\n    return True\nfor i in range(9):\n    for j in range(9):\n        assert puzzle[i][j]==0 or sol[i][j]==puzzle[i][j], "changed a given clue"\nassert ok(sol), "invalid solution"\nprint("PASS")\n' },
];

function extractCode(text){
  const m = String(text).match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : String(text)).trim();
}

async function callModel(m, prompt){
  const t0 = Date.now();
  const hf = m.backend==='hf';
  const url = hf ? 'https://router.huggingface.co/v1/chat/completions' : FREE_URL+'/v1/chat/completions';
  const headers = { 'content-type':'application/json', authorization:`Bearer ${hf?HF:FREE_KEY}` };
  const body = JSON.stringify({ model:m.id, messages:[{role:'user',content:prompt}], max_tokens:4000, temperature:0 });
  try {
    const r = await fetch(url, { method:'POST', headers, body, signal:AbortSignal.timeout(150000) });
    const j = await r.json().catch(()=>({}));
    const content = j.choices?.[0]?.message?.content || '';
    return { ok:r.ok && !!content, content, tokens:j.usage?.total_tokens||0, ms:Date.now()-t0, err:r.ok?(content?null:'empty'):(j.error?.message||`HTTP ${r.status}`) };
  } catch(e){ return { ok:false, content:'', tokens:0, ms:Date.now()-t0, err:e.name==='TimeoutError'?'timeout':e.message }; }
}

function runInSandbox(code, test){
  const dir = mkdtempSync(join(tmpdir(),'bench-'));
  writeFileSync(join(dir,'prog.py'), code+'\n\n'+test);
  try {
    const out = execFileSync('docker', ['run','--rm','--network','none','--memory','256m','--cpus','1','--pids-limit','128','-v',`${dir}:/w:ro`,SANDBOX_IMG,'sh','-c','timeout 15 python /w/prog.py'], { timeout:35000, encoding:'utf8', stdio:['ignore','pipe','pipe'] });
    return { pass: out.includes('PASS'), out: out.trim().slice(-200) };
  } catch(e){ return { pass:false, out: ((e.stdout||'')+'\n'+(e.stderr||e.message||'')).trim().slice(-260) }; }
}

const results = [];
process.stderr.write(`\n=== EVOTOP BENCH | ${RUN_MODELS.length} models x ${TASKS.length} tasks | sandbox ${SANDBOX_IMG} ===\n`);
for (const m of RUN_MODELS){
  const row = { model:m.label, id:m.id, backend:m.backend, tasks:{}, passed:0, totalMs:0, totalTokens:0, errors:0 };
  process.stderr.write(`\n[${m.label}] (${m.backend})\n`);
  for (const t of TASKS){
    const resp = await callModel(m, t.prompt);
    row.totalMs += resp.ms; row.totalTokens += resp.tokens;
    if (!resp.ok){ row.tasks[t.name] = { pass:false, err:resp.err, ms:resp.ms }; row.errors++; process.stderr.write(`  ${m.label}/${t.name}: ERR ${resp.err}\n`); continue; }
    const code = extractCode(resp.content);
    const sb = runInSandbox(code, t.test);
    row.tasks[t.name] = { pass:sb.pass, ms:resp.ms, tokens:resp.tokens, codeLen:code.length, fail: sb.pass?null:sb.out };
    if (sb.pass) row.passed++;
    process.stderr.write(`  ${m.label}/${t.name}: ${sb.pass?'PASS':'fail'} ${resp.ms}ms\n`);
  }
  results.push(row);
  process.stderr.write(`= ${m.label}: ${row.passed}/${TASKS.length} | ${Math.round(row.totalMs/1000)}s | ${row.totalTokens}tok\n`);
}
// rank: passed desc, then total latency asc
results.sort((a,b)=> b.passed-a.passed || a.totalMs-b.totalMs);
results.forEach((r,i)=> r.rank=i+1);
process.stderr.write('\n=== LEADERBOARD ===\n');
results.forEach(r => process.stderr.write(`${String(r.rank).padStart(2)}. ${r.model.padEnd(22)} ${r.passed}/${TASKS.length}  ${(r.totalMs/1000).toFixed(1)}s  ${String(r.totalTokens).padStart(5)}tok  [${r.backend}]\n`));
const out = { ts:new Date().toISOString(), method:'pass@1, hidden tests, Docker sandbox (network=none)', tasks:TASKS.map(t=>({name:t.name,title:t.title})), models:MODELS.length, results };
writeFileSync(process.env.RESULTS_PATH || '/opt/bench/results.json', JSON.stringify(out,null,2));
process.stderr.write(`WROTE ${process.env.RESULTS_PATH || '/opt/bench/results.json'}\n`);
