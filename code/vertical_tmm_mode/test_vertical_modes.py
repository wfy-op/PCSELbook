"""Independent physical checks for the textbook's lossless planar solver."""
import copy
import contextlib
import io
from pathlib import Path
import re
import unittest
import numpy as np
from scipy.optimize import brentq
from vertical_modes import matrix, find_modes, te_overlaps, residual, states, fd_neff
from run_tutorial import PARAMS


class VerticalModesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.neff = find_modes(PARAMS)[0]

    def test_uniform_symmetric_slab_matches_analytic_dispersion(self):
        p=copy.deepcopy(PARAMS)
        p['layers']=[dict(name='core',thickness_nm=320.,index=3.42,is_qw=False)]
        k0=2*np.pi/.940
        v=k0*.160*np.sqrt(3.42**2-3.30**2)
        u=brentq(lambda u:u*np.tan(u)-np.sqrt(v*v-u*u),1e-8,min(v,np.pi/2)-1e-8)
        exact=np.sqrt(3.42**2-(u/(k0*.160))**2)
        self.assertAlmostEqual(find_modes(p)[0],exact,places=11)

    def test_te_tm_interface_states_and_upper_boundary(self):
        for pol in ('TE','TM'):
            root=find_modes(PARAMS,pol)[0]
            saved,top,_,ku,au=states(root,PARAMS,pol)
            k0=2*np.pi/.940
            for i,l in enumerate(PARAMS['layers']):
                a=1 if pol=='TE' else l['index']**-2
                q=k0*np.sqrt(l['index']**2-root**2+0j)
                predicted=matrix(q,l['thickness_nm']*.001,a)@saved[i]
                np.testing.assert_allclose(predicted,saved[i+1] if i+1<len(saved) else top,atol=1e-12)
            self.assertLess(abs(residual(root,PARAMS,pol)),1e-9)

    def test_weights_partition_and_gain_identity(self):
        m=te_overlaps(self.neff,PARAMS)
        for key in ('gamma_field','gamma_electric'):
            self.assertAlmostEqual(sum(r[key] for r in m['layers']),1,places=13)
        self.assertAlmostEqual(m['gamma_qw_gain'],m['n_group_nondispersive']/3.55*m['gamma_qw_electric'],places=13)
        self.assertAlmostEqual(m['layers'][0]['gamma_electric'],m['layers'][-1]['gamma_electric'],places=12)

    def test_no_high_index_region_has_no_bound_modes(self):
        p=copy.deepcopy(PARAMS)
        for l in p['layers']:l['index']=3.30
        self.assertEqual(find_modes(p),[])

    def test_fd_is_independent_second_order_check(self):
        errors=[abs(fd_neff(PARAMS,h)-self.neff) for h in (4.,2.,1.)]
        self.assertLess(errors[-1],1e-6)
        self.assertGreater(errors[0]/errors[1],3)
        self.assertGreater(errors[1]/errors[2],3)

    def test_matrix_zero_q_limit_and_determinant(self):
        for q in (0.,2.,2j):
            for a in (1.,.1):
                self.assertAlmostEqual(np.linalg.det(matrix(q,.2,a)).real,1,places=12)
        np.testing.assert_allclose(matrix(0,.2),[[1,.2],[0,1]])

    def test_printed_chapter_example_runs(self):
        chapter=Path(__file__).resolve().parents[2]/'chapters/ch16_epitaxial_optical_structure.tex'
        if not chapter.exists():
            self.skipTest('Standalone code bundle has no book source')
        source=chapter.read_text(encoding='utf8')
        snippet=re.search(r'\\begin\{lstlisting\}\[language=Python[^\]]*\](.*?)\\end\{lstlisting\}',source,re.S).group(1)
        scope={}
        with contextlib.redirect_stdout(io.StringIO()):
            exec(compile(snippet,'chapter-example','exec'),scope)
        self.assertEqual(len(scope['roots']),1)
        self.assertAlmostEqual(scope['roots'][0],self.neff,places=10)

    def test_beginner_walkthrough_numbers(self):
        self.assertAlmostEqual(PARAMS['wavelength_nm']/self.neff,279.68405958,places=7)
        np.testing.assert_allclose(
            np.cumsum([l['thickness_nm'] for l in PARAMS['layers']]),
            [128,136,156,164,184,192,320])
        for candidate,expected in ((3.35,-2.22162023),(3.36,-.20659623),(3.37,2.16609242)):
            _,top,_,upper_decay,_=states(candidate,PARAMS)
            self.assertAlmostEqual((top[1]+upper_decay*top[0]).real,expected,places=7)


if __name__ == '__main__':
    unittest.main()
