"""Run the chapter's lossless teaching example; not measured device parameters."""
from pathlib import Path
import argparse
import csv
import json
import sys
import numpy as np
from vertical_modes import find_modes, residual, te_overlaps, profile, fd_neff

PARAMS={'wavelength_nm':940.,'lower_index':3.30,'upper_index':3.30,
    'layers':[{'name':name,'thickness_nm':d,'index':n,'is_qw':qw} for name,d,n,qw in [
    ('Lower SCH',128.,3.42,False),('QW 1',8.,3.55,True),('Barrier 1',20.,3.42,False),
    ('QW 2',8.,3.55,True),('Barrier 2',20.,3.42,False),('QW 3',8.,3.55,True),('Upper SCH',128.,3.42,False)]]}


def plot_mode(te,tm,p,out,qa_scripts=None):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams['font.family'] = 'Arial'
    plt.rcParams.update({'font.size':10,'pdf.fonttype':42,'svg.fonttype':'none'})
    z,e,n,_=profile(te,p)
    fig,axes=plt.subplots(2,1,figsize=(7.,5.3),sharex=True)
    fig.subplots_adjust(left=.12,right=.96,bottom=.20,top=.94,hspace=.38)
    right=sum(l['thickness_nm'] for l in p['layers'])*.001+.7
    visible=(z>=-.7)&(z<=right)
    axes[0].step(z[visible],n[visible],where='post',color='#64748b')
    axes[0].set(ylabel='Refractive index n',title='(a) 940 nm teaching stack')
    axes[1].plot(z[visible],e[visible]**2,color='#1769aa',lw=1.8,label='TE0: normalized |Ey|²')
    if tm is not None:
        zt,h,_,_=profile(tm,p,'TM')
        vt=(zt>=-.7)&(zt<=right)
        axes[1].plot(zt[vt],h[vt]**2,color='#b45309',lw=1.4,ls='--',label='TM0: normalized |Hy|²')
    for ax in axes:
        edge=0.
        for l in p['layers']:
            end=edge+l['thickness_nm']*.001
            if l['is_qw']: ax.axvspan(edge,end,color='#e8a5ae',alpha=.45,lw=0)
            edge=end
        ax.set_xlim(-.7,edge+.7);ax.spines[['top','right']].set_visible(False)
    axes[1].set(xlabel='Vertical position z (µm)',ylabel='Normalized squared field',title='(b) Fundamental bound modes; pink = QWs')
    axes[1].legend(loc='upper left',bbox_to_anchor=(0,-.40),ncol=2,frameon=False,fontsize=8)
    fig.canvas.draw()
    if qa_scripts:
        sys.path.insert(0,str(qa_scripts))
        from audit_panel_alignment import require_matplotlib_panel_alignment
        require_matplotlib_panel_alignment(fig,json_out=str(out/'vertical_profile_alignment.audit.json'),strict=True)
    (out/'vertical_profile_alignment.json').write_text(json.dumps({'axes_bounds':[list(ax.get_position().bounds) for ax in axes]},indent=2))
    fig.savefig(out/'vertical_te_mode_profile.pdf')
    fig.savefig(out/'vertical_te_mode_profile.svg')
    fig.savefig(out/'vertical_te_mode_profile.png',dpi=300)
    plt.close(fig)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path);parser.add_argument('--no-plots',action='store_true')
    parser.add_argument('--qa-scripts',type=Path,help='Optional figure QA helper directory')
    args=parser.parse_args()
    p=json.loads(args.config.read_text(encoding='utf8')) if args.config else PARAMS
    te,tm=find_modes(p),find_modes(p,'TM')
    if not te:raise RuntimeError('No bound TE mode for this stack')
    m=te_overlaps(te[0],p);coarse=te_overlaps(te[0],p,32);scan=find_modes(p,scan_points=12000)
    fd=[{'step_nm':h,'neff':fd_neff(p,h)} for h in (4.,2.,1.)]
    for r in fd:r['absolute_error']=abs(r['neff']-te[0])
    summary={'model':'lossless planar TE/TM bound modes at fixed wavelength','parameters':p,
        'total_finite_thickness_nm':sum(l['thickness_nm'] for l in p['layers']),
        'all_bound_mode_effective_indices':te,'tm_effective_indices':tm,
        'selected_fundamental_effective_index':te[0],'qw_confinement_factor':m['gamma_qw_electric'],
        'overlaps':m,'validation':{'root_residual':abs(residual(te[0],p)),
        'double_scan_max_difference':max(abs(a-b) for a,b in zip(te,scan)) if len(te)==len(scan) else None,
        'quadrature_32_to_64_difference':abs(m['gamma_qw_electric']-coarse['gamma_qw_electric']),
        'finite_difference':fd}}
    out=Path(__file__).resolve().parent/'output';out.mkdir(exist_ok=True)
    z,e,n,qw=profile(te[0],p)
    with (out/'vertical_te_mode_profile.csv').open('w',newline='',encoding='utf8') as f:
        w=csv.writer(f);w.writerow(['z_um','index','field_real_normalized','field_abs_squared','is_qw']);w.writerows(zip(z,n,e,e**2,qw.astype(int)))
    (out/'vertical_tmm_mode_summary.json').write_text(json.dumps(summary,indent=2),encoding='utf8')
    if not args.no_plots:plot_mode(te[0],tm[0] if tm else None,p,out,args.qa_scripts)
    print(json.dumps(summary,indent=2))


if __name__=='__main__':main()
