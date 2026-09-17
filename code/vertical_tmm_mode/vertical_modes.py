"""Real-index planar TE/TM bound modes. Internal length unit: micrometre."""
import numpy as np
from numpy.polynomial.legendre import leggauss
from scipy.optimize import brentq
from scipy.linalg import eigh_tridiagonal


def matrix(q, d, a=1.):
    s = d*np.sinc(q*d/np.pi)
    c = np.cos(q*d)
    return np.array([[c,s/a],[-a*q*q*s,c]],dtype=complex)


def states(neff,p,pol='TE'):
    k0=2*np.pi/(p['wavelength_nm']*.001)
    kl,ku=[k0*np.sqrt(neff**2-p[k]**2) for k in ('lower_index','upper_index')]
    al=1. if pol=='TE' else p['lower_index']**-2
    au=1. if pol=='TE' else p['upper_index']**-2
    v=np.array([1.,al*kl],dtype=complex); saved=[]
    for l in p['layers']:
        saved.append(v.copy())
        q=k0*np.sqrt(l['index']**2-neff**2+0j)
        a=1. if pol=='TE' else l['index']**-2
        v=matrix(q,l['thickness_nm']*.001,a)@v
    return saved,v,kl,ku,au


def residual(neff,p,pol='TE'):
    _,v,_,ku,au=states(neff,p,pol)
    return float((v[1]+au*ku*v[0]).real/(abs(v[1])+abs(au*ku*v[0])+1e-30))


def find_modes(p,pol='TE',scan_points=6000):
    vals=[p['wavelength_nm'],p['lower_index'],p['upper_index']]
    vals += [v for l in p['layers'] for v in (l['index'],l['thickness_nm'])]
    if not p['layers'] or not all(np.isfinite(v) and v>0 for v in vals):
        raise ValueError('Finite positive wavelength, real indices and thicknesses required')
    if pol not in ('TE','TM'): raise ValueError('Choose TE or TM')
    lo=max(p['lower_index'],p['upper_index']); hi=max(l['index'] for l in p['layers'])
    if hi<=lo: return []
    grid=np.linspace(lo+1e-9,hi-1e-9,scan_points)
    f=[residual(n,p,pol) for n in grid]; roots=[]
    for a,b,fa,fb in zip(grid[:-1],grid[1:],f[:-1],f[1:]):
        if fa*fb<0:
            root=brentq(residual,a,b,args=(p,pol),xtol=1e-14)
            if not roots or abs(root-roots[-1])>1e-9: roots.append(root)
    return sorted(roots,reverse=True)


def field(v,q,t,a=1.):
    return v[0]*np.cos(q*t)+v[1]*t*np.sinc(q*t/np.pi)/a


def te_overlaps(neff,p,order=64):
    """Layer quadrature and exact semi-infinite tails, without masked-grid bias."""
    saved,top,kl,ku,_=states(neff,p)
    k0=2*np.pi/(p['wavelength_nm']*.001); nodes,weights=leggauss(order)
    rows=[{'name':'Lower cladding','index':p['lower_index'],'is_qw':False,'integral':1/(2*kl)}]
    for l,v in zip(p['layers'],saved):
        d=l['thickness_nm']*.001; q=k0*np.sqrt(l['index']**2-neff**2+0j)
        area=float(d/2*np.dot(weights,abs(field(v,q,(nodes+1)*d/2))**2))
        rows.append({**l,'integral':area})
    rows.append({'name':'Upper cladding','index':p['upper_index'],'is_qw':False,'integral':float(abs(top[0])**2/(2*ku))})
    total=sum(r['integral'] for r in rows); weighted=sum(r['index']**2*r['integral'] for r in rows)
    for r in rows:
        r['gamma_field']=r['integral']/total
        r['gamma_electric']=r['index']**2*r['integral']/weighted
        r['gamma_gain']=r['index']*r['integral']/(neff*total)
    return {'gamma_qw_field':sum(r['gamma_field'] for r in rows if r['is_qw']),
        'gamma_qw_electric':sum(r['gamma_electric'] for r in rows if r['is_qw']),
        'gamma_qw_gain':sum(r['gamma_gain'] for r in rows if r['is_qw']),
        'n_group_nondispersive':weighted/(neff*total),
        'lower_amplitude_decay_um':1/kl,'upper_amplitude_decay_um':1/ku,'layers':rows}


def profile(neff,p,pol='TE'):
    saved,top,kl,ku,_=states(neff,p,pol); k0=2*np.pi/(p['wavelength_nm']*.001)
    z=[]; fields=[]; indices=[]; flags=[]
    def add(x,y,n,qw):
        z.extend(x);fields.extend(y);indices.extend([n]*len(x));flags.extend([qw]*len(x))
    lower=np.linspace(-8/kl,0,301,endpoint=False)
    add(lower,np.exp(kl*lower),p['lower_index'],False);edge=0.
    for l,v in zip(p['layers'],saved):
        d=l['thickness_nm']*.001;t=np.linspace(0,d,max(25,int(d/.001)+1),endpoint=False)
        q=k0*np.sqrt(l['index']**2-neff**2+0j);a=1 if pol=='TE' else l['index']**-2
        add(edge+t,field(v,q,t,a),l['index'],l['is_qw']);edge+=d
    t=np.linspace(0,8/ku,301);add(edge+t,top[0]*np.exp(-ku*t),p['upper_index'],False)
    f=np.asarray(fields).real;f/=max(abs(f))
    return np.array(z),f,np.array(indices),np.array(flags)


def fd_neff(p,step_nm,margin_um=2.):
    """Independent central-difference TE eigenproblem, distant Dirichlet walls."""
    d=sum(l['thickness_nm'] for l in p['layers'])*.001
    count=round((d+2*margin_um)/(step_nm*.001));h=(d+2*margin_um)/count
    z=-margin_um+(np.arange(count)+.5)*h
    eps=np.where(z<0,p['lower_index']**2,p['upper_index']**2);edge=0.
    for l in p['layers']:
        end=edge+l['thickness_nm']*.001
        eps[(z>=edge)&(z<end)]=l['index']**2;edge=end
    k0=2*np.pi/(p['wavelength_nm']*.001)
    vals=eigh_tridiagonal(-2/h**2+k0**2*eps,np.full(count-1,1/h**2),select='i',select_range=(count-1,count-1),eigvals_only=True)
    return float(np.sqrt(vals[-1])/k0)
