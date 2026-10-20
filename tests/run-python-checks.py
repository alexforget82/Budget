"""Run every additional Python check, retain logs and return failure if any check fails."""
import argparse,concurrent.futures,json,subprocess,sys,tempfile,time
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--results',type=Path);parser.add_argument('--jobs',type=int,choices=range(1,5),default=2);args=parser.parse_args();root=args.root.resolve();out=args.results or Path(tempfile.mkdtemp(prefix='sillage-python-checks-'));out.mkdir(parents=True,exist_ok=True)
files=sorted(p for p in (root/'tests').glob('*.py') if p.name not in ['api-tests.py','ui_navigation.py','run-python-checks.py'])
def run(p):
 start=time.monotonic()
 with (out/(p.stem+'.log')).open('w') as log:
  try:code=subprocess.run([sys.executable,str(p)],cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=300).returncode
  except subprocess.TimeoutExpired:code=124
 result={'test':p.name,'code':code,'seconds':round(time.monotonic()-start,1)};print(json.dumps(result),flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:results=list(pool.map(run,files))
(out/'results.json').write_text(json.dumps(results,indent=2));passed=sum(r['code']==0 for r in results);print(f'{passed}/{len(results)} scripts passed. Logs: {out}');sys.exit(int(passed!=len(results)))
