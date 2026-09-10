"""Generate standalone scientific figures from retained metrics."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT = Path(__file__).resolve().parent
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'bold','figure.facecolor':'white','savefig.facecolor':'white'})
v = json.loads((ROOT / 'models/v1/validation.json').read_text())['models']
d = json.loads((ROOT / 'reports/full-model-diagnostic.json').read_text())['conditions']['temporal']['selected']
modes = ['static','temporal','no-pose']; names = ['Single frame\nthreshold 0.95','Temporal with pose\nthreshold 0.98, failed','Temporal without pose\nthreshold 0.98']; colors=['#b77b22','#677bb3','#288979']
fig, axes = plt.subplots(1, 2, figsize=(10.2,4.4))
for ax, key, label, gate in zip(axes,['timelyDetection','falseTrigger'],['Timely hazard detection (%)','Harmless trajectories triggering (%)'],[80,10]):
    values = [(v[m]['selected'] or d)[key]*100 for m in modes]
    ax.bar(np.arange(3), values, color=colors, width=.6)
    for i, value in enumerate(values): ax.text(i,value+2,f'{value:.1f}%',ha='center')
    ax.axhline(gate,color='#56626a',ls='--',lw=1); ax.set_xticks(np.arange(3),names); ax.set_ylim(0,110 if gate==80 else 25); ax.set_title(label,pad=14); ax.grid(axis='y',alpha=.12); ax.set_axisbelow(True)
fig.suptitle('Recorded walking vision: temporal information helps detection',fontsize=14,x=.055,ha='left')
fig.text(.055,.035,'24 hazardous and 40 harmless validation trajectories. Full-pose values at 0.98 are a failed-model diagnostic.\nThreshold selection used validation only. Cadence deviation: forced captures around incoming-object motion changes.',fontsize=9,color='#53616a')
fig.subplots_adjust(left=.065,right=.98,top=.8,bottom=.23,wspace=.25)
fig.savefig(ROOT/'reports/perception-results.png',dpi=170); plt.close(fig)
p=ROOT/'reports/physical-summary.json'
if p.exists():
    report=json.loads(p.read_text());conds=['motion','motion-both','temporal-timed','temporal-hazard','static-hazard','temporal-gf-silenced']; labels=['Existing motion','Motion, combined route','Temporal + timer','Temporal + hazard hold','Single frame + hold','Temporal, GF silenced']
    fig,axes=plt.subplots(1,2,figsize=(11.5,5.8),sharey=True); palette=['#7d8790','#a7aeb6','#80b5aa','#288979','#b77b22','#b2656b']
    for ax,stratum,metric,title in [(axes[0],'hazards','contact','Contact trials in potential-hazard scenes'),(axes[1],'controls','gf','GF stops in nominal control scenes')]:
        values=[report['summaries'][c][stratum][metric]*100 for c in conds]
        ax.barh(np.arange(6),values,color=palette,height=.6)
        for i,value in enumerate(values):ax.text(value+1.2,i,f'{value:.1f}%',va='center',fontsize=10)
        ax.set_xlim(0,max(100,max(values)+12));ax.set_xticks([0,25,50,75,100]);ax.set_xlabel('Trials (%)');ax.set_title(title,fontsize=11,pad=18);ax.grid(axis='x',alpha=.12);ax.set_axisbelow(True)
    axes[0].set_yticks(np.arange(6),labels);axes[0].invert_yaxis()
    effect=report['contactReductionVsMotion']['temporal-hazard'];ci=effect['ci95']
    fig.suptitle('Frozen temporal decoder: independent physical outcomes',fontsize=15,x=.03,ha='left')
    fig.text(.03,.035,f"768 matched simulator trials; 64 potential-hazard and 64 control environments per condition.\nContact reduction: {effect['mean']*100:.1f} percentage points; paired 95% interval [{ci[0]*100:.1f}, {ci[1]*100:.1f}].\nNominal control stops are a conservative operational metric. The documented capture-cadence deviation applies.",fontsize=9,color='#53616a')
    fig.subplots_adjust(left=.22,right=.97,top=.8,bottom=.23,wspace=.18)
    fig.savefig(ROOT/'reports/physical-results.png',dpi=170);plt.close(fig)
