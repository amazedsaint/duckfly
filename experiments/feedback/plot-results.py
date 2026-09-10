"""Export evidence figures from retained data, without hand-entered scores."""
import json,gzip,random,statistics
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).parent;reports=root/'reports'
p=json.loads(gzip.decompress((reports/'pursuit-heldout-v1.json.gz').read_bytes()))
g=json.loads((reports/'motion-gain10-pilot-v1-summary.json').read_text())
lookup={(t['id'],t['condition']):t for t in p['trials']}
rows=[t for t in p['trials'] if t['condition']=='body-coordinates']
labels=['Overall','Off-axis beacon','Moving beacon','Repositioned beacon','Temporary occlusion'];families=[None,'offset','moving','reposition','occlusion']
means=[];lower=[];upper=[]
for family in families:
 groups=[[100*(lookup[(t['id'],'original')]['finalError']-t['finalError']) for t in rows if t['family']==f] for f in (['offset','moving','reposition','occlusion'] if family is None else [family])]
 rng=random.Random(190319);boot=sorted(statistics.mean([rng.choice(v) for v in groups for _ in v]) for _ in range(2000));m=statistics.mean(sum(groups,[]));means.append(m);lower.append(m-boot[49]);upper.append(boot[1949]-m)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'axes.edgecolor':'#b4b8b4','text.color':'#23382c','axes.labelcolor':'#23382c','xtick.color':'#526359','ytick.color':'#526359','figure.facecolor':'#f8faf7','axes.facecolor':'#f8faf7'})
fig,ax=plt.subplots(figsize=(9,4.1),layout='constrained');ax.axvline(0,color='#95a398',linewidth=1);ax.errorbar(means,range(5),xerr=[lower,upper],fmt='o',color='#b75343',ecolor='#b75343',capsize=4,markersize=7);ax.set_yticks(range(5),labels);ax.invert_yaxis();ax.grid(axis='x',alpha=.15);ax.set_xlabel('Final-distance improvement versus current controller (cm)');ax.set_title('Camera-to-body correction did not improve pursuit',loc='left',weight='bold',pad=20);fig.suptitle('Held-out evaluation · 96 paired scenes · 95% paired bootstrap intervals',x=.26,y=.93,ha='left',fontsize=9,color='#627369');fig.savefig(reports/'pursuit-result.png',dpi=180);fig.savefig(reports/'pursuit-result.svg');plt.close(fig)
labels=['Compact motion / gain 6','Compact motion / gain 10','Rotation / gain 10','Inverted pose / gain 10'];keys=['baseline','original','rotation','inverted'];summary=g['summary'];x=list(range(4));fig,axes=plt.subplots(1,2,figsize=(10,4.8),layout='constrained')
for ax,key,denom,title,color in [(axes[0],'approachContacts','approachTrials','Approach contacts','#b75343'),(axes[1],'falseGF','controlTrials','False reflexes on harmless scenes','#ae7c30')]:
 values=[summary[k][key] for k in keys];totals=[summary[k][denom] for k in keys];bars=ax.barh(x,[v/n for v,n in zip(values,totals)],color=color,height=.55);ax.set_yticks(x,labels);ax.invert_yaxis();ax.set_xlim(0,1.13);ax.set_xticks([0,.5,1],['0%','50%','100%']);ax.set_title(title,loc='left',weight='bold',pad=16);ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
 for bar,v,n in zip(bars,values,totals):ax.text(bar.get_width()+.025,bar.get_y()+bar.get_height()/2,f'{v}/{n}',va='center',fontsize=10)
fig.suptitle('Higher motion-to-GF gain increased false alarms\nScreening study · 4 approach and 12 control trials per condition · lower is better',fontsize=12,weight='bold');fig.savefig(reports/'gain-tradeoff.png',dpi=180);fig.savefig(reports/'gain-tradeoff.svg');plt.close(fig)

for path in reports.glob('*.svg'):
 path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines())+'\n')
