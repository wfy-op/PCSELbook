"""Computed teaching figures, not a reproduction of any device or paper."""
from pathlib import Path
import json
import sys
import numpy as np
from scipy.linalg import eigh
from scipy.special import j1
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / 'output'
FIG = ROOT / 'figures' / 'computed'
OUT.mkdir(exist_ok=True)
FIG.mkdir(exist_ok=True)
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10,
                     'pdf.fonttype': 42, 'svg.fonttype': 'none',
                     'axes.spines.top': False, 'axes.spines.right': False})
COLORS = ['#126782', '#a13d63', '#38744c', '#99610b', '#72658a', '#555555']


def save(fig, name):
    fig.canvas.draw()
    # Optional local QA; numerical/plotting reproduction does not require a skill.
    qa = Path.home() / '.codex/skills/nature-figure/scripts'
    if qa.exists():
        sys.path.insert(0, str(qa))
        from audit_panel_alignment import require_matplotlib_panel_alignment
        require_matplotlib_panel_alignment(fig, json_out=OUT / f'{name}.alignment.json', strict=True)
    fig.savefig(FIG / f'{name}.pdf')
    fig.savefig(OUT / f'{name}.png', dpi=180)
    plt.close(fig)


def pwem(cutoff, radius=.30, eps=3.4**2):
    g = np.array([(i, j) for i in range(-cutoff, cutoff+1)
                  for j in range(-cutoff, cutoff+1)], dtype=float)
    d = np.linalg.norm(g[:, None] - g[None, :], axis=2)
    x = 2*np.pi*radius*d
    disk = np.ones_like(x)
    np.divide(2*j1(x), x, out=disk, where=x != 0)
    eta = (1-1/eps)*np.pi*radius**2*disk + np.eye(len(g))/eps

    def solve(k, count=6):
        kg = g + k
        m = eta * (kg @ kg.T)
        vals = eigh(m, subset_by_index=[0, count-1], eigvals_only=True)
        assert vals.min() > -1e-10
        return np.sqrt(np.maximum(vals, 0))
    return solve


def bands():
    vertices = np.array([[0,0],[.5,0],[.5,.5],[0,0]])
    ks = np.vstack([np.linspace(a,b,33)[:-1] for a,b in zip(vertices[:-1], vertices[1:])] + [vertices[-1:]])
    distance = np.r_[0, np.cumsum(np.linalg.norm(np.diff(ks,axis=0),axis=1))]
    solve = pwem(9)
    values = np.array([solve(k) for k in ks])
    np.savetxt(OUT/'square_bands.csv', np.column_stack([ks,distance,values]), delimiter=',',
               header='kx_a_2pi,ky_a_2pi,path,band1,band2,band3,band4,band5,band6', comments='')
    checks = {str(n): [pwem(n)(k).tolist() for k in vertices[:3]] for n in [5,7,9,11]}
    error = float(np.max(np.abs(np.array(checks['11'])-np.array(checks['9']))))
    # Sampling the irreducible wedge tests whether the local X splitting is a full gap.
    wedge = np.array([solve([x,y]) for x in np.linspace(0,.5,21) for y in np.linspace(0,x,21)])
    lo, hi = float(wedge[:,1].max()), float(wedge[:,2].min())
    xlo,xhi = values[32,1:3]
    summary = {'model':'2D Hz, air holes in n=3.4, r/a=0.30, lossless, nondispersive',
               'cutoff':9, 'plane_waves':361, 'check_5_7_9_11':checks,
               'max_absolute_frequency_change_9_to_11_at_Gamma_X_M':error,
               'sampled_band2_max':lo, 'sampled_band3_min':hi,
               'sampled_gap_23':hi-lo, 'X_local_split_23':float(xhi-xlo)}
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    fig,ax=plt.subplots(figsize=(7.1,4.5))
    fig.subplots_adjust(left=.12,right=.96,bottom=.14,top=.90)
    for i in range(6): ax.plot(distance,values[:,i],color=COLORS[i],lw=1.5)
    ticks = distance[[0,32,64,96]]
    ax.set(xticks=ticks,xticklabels=[r'$\Gamma$','$X$','$M$',r'$\Gamma$'],
           ylabel=r'$\Omega=\omega a/(2\pi c)=a/\lambda_0$', ylim=(0,.67),xlim=(0,ticks[-1]))
    for t in ticks[1:-1]: ax.vlines(t,0,.54,color='.8',lw=.7,zorder=0)
    ax.annotate('',(.5,xlo),(.5,xhi),arrowprops={'arrowstyle':'<->','color':'black'})
    ax.annotate('Local band edges at X\nSplitting is not a full gap',xy=(.5,(xlo+xhi)/2),xytext=(.81,.575),
                arrowprops={'arrowstyle':'->'},fontsize=10,
                bbox={'facecolor':'white','edgecolor':'none','pad':3})
    ax.scatter([.5,.5],[xlo,xhi],color='black',s=20,zorder=5)
    ax.text(.03,.94,'Computed square-lattice bands',transform=ax.transAxes,va='top')
    ax.text(.60,.03,'Band 2 and band 3 overlap\nacross different wave vectors',transform=ax.transAxes,fontsize=9)
    save(fig,'square_bands')
    fig,ax=plt.subplots(figsize=(5.2,4.5))
    fig.subplots_adjust(left=.18,right=.91,bottom=.16,top=.92)
    ax.add_patch(Polygon([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],fill=False,lw=1.6))
    ax.add_patch(Polygon(vertices[:3],color='#126782',alpha=.12))
    ax.plot(*vertices.T,color='#126782',lw=2)
    for p,label,offset in zip(vertices[:3],[r'$\Gamma$','$X$','$M$'],[(-14,-18),(8,-3),(8,5)]):
        ax.scatter(*p,color='black',s=20)
        ax.annotate(label,p,xytext=offset,textcoords='offset points')
    ax.set(xlim=(-.67,.67),ylim=(-.67,.67),aspect='equal',xlabel=r'$k_x a/(2\pi)$',ylabel=r'$k_y a/(2\pi)$',xticks=[-.5,0,.5],yticks=[-.5,0,.5])
    ax.set_title('First Brillouin zone; shaded: irreducible wedge',fontsize=10)
    save(fig,'square_bz')
    return summary


def four_modes():
    xy=np.linspace(-.5,.5,161)
    x,y=np.meshgrid(xy,xy)
    fields=[np.cos(2*np.pi*x)-np.cos(2*np.pi*y),np.cos(2*np.pi*x)+np.cos(2*np.pi*y),
            np.sin(2*np.pi*x),np.sin(2*np.pi*y)]
    weights=['(1, 1, -1, -1)/2','(1, 1, 1, 1)/2','(1, -1, 0, 0)/sqrt(2)','(0, 0, 1, -1)/sqrt(2)']
    fig,axs=plt.subplots(1,4,figsize=(10,3.1))
    fig.subplots_adjust(left=.06,right=.99,bottom=.27,top=.80,wspace=.35)
    for ax,f,title,w in zip(axs,fields,['A: singlet','B: singlet','C: doublet','D: doublet'],weights):
        ax.imshow(f/np.max(abs(f)),extent=[-.5,.5,-.5,.5],origin='lower',cmap='RdBu_r',vmin=-1,vmax=1)
        ax.set(xticks=[-.5,0,.5],yticks=[-.5,0,.5],xlabel='$x/a$')
        ax.set_title(title,fontsize=11)
        ax.text(.5,-.40,w,transform=ax.transAxes,ha='center',fontsize=10)
    axs[0].set_ylabel('$y/a$')
    fig.suptitle('Four-wave scalar envelopes: blue < 0, white = 0, red > 0',fontsize=11,y=.97)
    save(fig,'abcd_envelopes')


def triangular():
    # In units 2pi/a: a1=(1,0), a2=(1/2,sqrt(3)/2).
    b=np.array([1,-1/np.sqrt(3)])
    K=np.array([2/3,0])
    v=np.array([[2/3,0],[1/3,1/np.sqrt(3)],[-1/3,1/np.sqrt(3)],[-2/3,0],[-1/3,-1/np.sqrt(3)],[1/3,-1/np.sqrt(3)]])
    fig,ax=plt.subplots(figsize=(5.2,4.5))
    fig.subplots_adjust(left=.15,right=.90,bottom=.15,top=.90)
    ax.add_patch(Polygon(v,fill=False,lw=1.5))
    for p,s in [(np.zeros(2),r'$\Gamma$'),(b/2,'M (old X)'),(K,'K (old J)')]:
        ax.scatter(*p,s=15,color='black')
        offset=(10,-12) if s=='M (old X)' else (5,7)
        ax.annotate(s,p,xytext=offset,textcoords='offset points',fontsize=9)
    ax.set(xlim=(-.95,.95),ylim=(-.85,.85),aspect='equal',title='Triangular-lattice first Brillouin zone',
           xlabel=r'$k_x a/(2\pi)$',ylabel=r'$k_y a/(2\pi)$')
    save(fig,'triangular_bz')
    fig,axs=plt.subplots(2,2,figsize=(7.1,6.3))
    fig.subplots_adjust(left=.07,right=.97,bottom=.10,top=.91,hspace=.50,wspace=.25)
    for ax,angles,title in zip(axs.flat,[[0,180],[0,120,240],[0,60,120,180,240,300],[30,90,150,210,270,330]],
                               ['I: M (old X), two waves','II: K (old J), three waves','III: Gamma, first nonzero shell','IV: Gamma, next shell']):
        for a in angles:
            r=np.deg2rad(a)
            ax.annotate('',(.70*np.cos(r),.70*np.sin(r)),(0,0),arrowprops={'arrowstyle':'->','lw':1.7,'color':'#126782'})
        ax.add_patch(Circle((0,0),.70,fill=False,ls=':',ec='.7'))
        ax.set(xlim=(-.95,.95),ylim=(-.85,.85),aspect='equal',title=title)
    for ax in axs.flat: ax.set(xticks=[],yticks=[])
    save(fig,'triangular_feedback')


def gamma_phase():
    fig,axs=plt.subplots(2,1,figsize=(7,3.8))
    fig.subplots_adjust(left=.09,right=.98,bottom=.12,top=.86,hspace=.9)
    for ax,step,title in zip(axs,[0,np.pi/2],['Gamma: same phase at corresponding positions', 'Non-Gamma: phase advances by pi/2 per cell']):
        for i in range(4):
            ax.add_patch(Polygon([[i,0],[i+1,0],[i+1,1],[i,1]],fill=False,ec='.65'))
            angle=i*step
            ax.annotate('',(i+.5+.32*np.cos(angle),.5+.32*np.sin(angle)),(i+.5,.5),
                        arrowprops={'arrowstyle':'->','color':COLORS[0],'lw':2})
        ax.set(xlim=(-.1,4.1),ylim=(-.1,1.1),aspect='equal',xticks=[],yticks=[],title=title)
        ax.set_axis_off()
    save(fig,'gamma_phase')


def farfield():
    # Scalar paraxial radiation aperture, not the guided Bloch field inside a unit cell.
    n=512; span=12.; dx=span/n
    coord=(np.arange(n)-n/2)*dx
    x,y=np.meshgrid(coord,coord)
    g=np.exp(-(x*x+y*y))
    fields=[g,x*g,x*y*g]
    q=np.fft.fftshift(np.fft.fftfreq(n,dx))*2*np.pi
    spectra=[]
    fig,axs=plt.subplots(2,3,figsize=(8.8,5.4))
    fig.subplots_adjust(left=.09,right=.98,bottom=.12,top=.88,hspace=.45,wspace=.40)
    errors=[]
    for j,(f,label) in enumerate(zip(fields,['Even: exp(-r^2)','Odd x: x exp(-r^2)','Odd x and y: xy exp(-r^2)'])):
        f=f/np.sqrt(np.sum(abs(f)**2)*dx*dx)
        ft=np.fft.fftshift(np.fft.fft2(np.fft.ifftshift(f)))*dx*dx
        power=abs(ft)**2; spectra.append(power)
        errors.append(float(abs(np.sum(power)*(2*np.pi/span)**2/(2*np.pi)**2-1)))
        ids=np.where(abs(coord)<=2.6)[0]; qs=np.where(abs(q)<=5)[0]
        axs[0,j].imshow(f[np.ix_(ids,ids)]/np.max(abs(f)),extent=[-2.6,2.6,-2.6,2.6],origin='lower',cmap='RdBu_r',vmin=-1,vmax=1)
        axs[1,j].imshow(power[np.ix_(qs,qs)]/power.max(),extent=[q[qs[0]],q[qs[-1]],q[qs[0]],q[qs[-1]]],origin='lower',cmap='inferno',vmin=0,vmax=1)
        axs[0,j].set(title=label,xlabel='$x/w$',xticks=[-2,0,2],yticks=[-2,0,2])
        axs[1,j].set(xlabel='$k_x w$',xticks=[-4,0,4],yticks=[-4,0,4])
    axs[0,0].set_ylabel('$y/w$: signed aperture field')
    axs[1,0].set_ylabel('$k_y w$: far-field intensity')
    save(fig,'aperture_farfield')
    # Elliptical deformation: both E-derived polarizations remain bright in C2v.
    d=np.linspace(0,.08,81)
    detune=100*d
    fig,ax=plt.subplots(figsize=(6.8,3.8))
    fig.subplots_adjust(left=.13,right=.95,bottom=.18,top=.86)
    ax.plot(100*d,detune,label='x-like: +100 delta THz',color=COLORS[0])
    ax.plot(100*d,-detune,label='y-like: -100 delta THz',color=COLORS[1])
    ax.set(xlabel='Ellipticity delta (%)',ylabel='Frequency shift (THz)',title='Illustrative two-mode perturbation model')
    ax.legend(loc='upper left',fontsize=9)
    save(fig,'ellipticity_split')
    np.savez_compressed(OUT/'aperture_fft.npz',coord=coord,q=q,fields=np.array(fields),power=np.array(spectra))
    return {'FFT_parseval_max_error':max(errors),'FFT_grid':n,'aperture_span_over_w':span,
            'odd_x_normalized_on_axis_intensity':float(spectra[1][n//2,n//2]/spectra[1].max())}


if __name__=='__main__':
    with threadpool_limits(limits=1):
        result=bands()
        four_modes()
        triangular()
        gamma_phase()
        result.update(farfield())
    (OUT/'summary.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
