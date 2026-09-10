"""Post-study diagnostics. These do not modify the frozen promotion gates."""
import gzip,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parent
r=json.loads(gzip.decompress((ROOT/'reports/temporal-physical-confirm-v1.json.gz').read_bytes()))
controls={'near-miss','receding','empty','scan'}; stopped=[]
for t in r['trials']:
    if t['condition']=='temporal-hazard' and t['family'] in controls and t['summary']['gf']:
        gf=[f for f in t['trace'] if f['gfEvent']];pulse=[f for f in t['trace'] if f['loomL'] or f['loomR']]
        stopped.append({'id':t['id'],'firstGF':gf[0]['time'],'firstVisualPulse':pulse[0]['time'] if pulse else None,'anyPositiveRiskLabel':any(f['truth'] for f in t['trace']),'heldSeconds':t['summary']['heldSeconds']})
by_case={}
for t in r['trials']:by_case.setdefault(t['id'],{})[t['condition']]=t
new_falls=[i for i, c in by_case.items() if c['temporal-hazard']['summary']['fallen'] and not c['motion']['summary']['fallen']]
case=next(i for i,c in sorted(by_case.items()) if c['temporal-timed']['summary']['contact'] and not c['temporal-hazard']['summary']['contact'])
report={'status':'Post-study diagnostic, not a new gate or selected model','controlStops':stopped,'visualPulseAssociatedStops':sum(x['firstVisualPulse'] is not None for x in stopped),'GFWithoutVisualPulse':sum(x['firstVisualPulse'] is None for x in stopped),'newFallsVsBaseline':new_falls,'traceExample':case,'exampleSelection':'First lexicographic case with timer contact and no hazard-hold contact'}
(ROOT/'reports/physical-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(3,1,figsize=(10,7.4),sharex=True)
for condition,color,label in [('temporal-timed','#b77b22','Existing timer'),('temporal-hazard','#288979','Hazard-aware hold')]:
    tr=by_case[case][condition]['trace'];time=[f['time'] for f in tr]
    axes[0].plot(time,[f['risk'] for f in tr],color=color,label=label)
    axes[1].plot(time,[f['command']['vx'] for f in tr],color=color,label=label)
    axes[2].plot(time,[f['speed'] for f in tr],color=color,label=label)
    contact=next((f['time'] for f in tr if f['contacts']),None)
    if contact is not None:
        for ax in axes:ax.axvline(contact,color=color,ls=':',alpha=.8)
        axes[2].annotate('Timer contact',xy=(contact,.04),xytext=(contact+.12,.1),color=color,arrowprops={'arrowstyle':'->','color':color})
    gf=[f['time'] for f in tr if f['gfEvent']]
    axes[0].scatter(gf,[1.055 if condition=='temporal-timed' else 1.12]*len(gf),color=color,s=10,marker='v')
axes[0].axhline(.98,color='#667580',lw=.8,ls='--');axes[0].set_ylim(-.04,1.2);axes[0].set_ylabel('Visual risk score');axes[0].legend(loc='center left',frameon=False)
axes[1].set_ylabel('Forward command\n(m/s)');axes[2].set_ylabel('Measured body speed\n(m/s)');axes[2].set_xlabel('Simulated time (s)')
for ax in axes:ax.grid(alpha=.13);ax.set_xlim(0,5)
fig.suptitle('The timer resumes into the hazard; feedback maintains the stop',x=.09,ha='left',fontsize=14)
fig.text(.09,.025,f'{case}. Same decoder and neural seed. Triangles mark actual GF events.\nRecorded motor ticks; the documented camera-cadence deviation applies.',fontsize=9,color='#53616a')
fig.subplots_adjust(top=.9,bottom=.13,left=.1,right=.97,hspace=.15)
fig.savefig(ROOT/'reports/stop-resume-trace.png',dpi=170)
print(json.dumps({k:v for k,v in report.items() if k!='controlStops'},indent=2))
