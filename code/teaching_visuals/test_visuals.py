import unittest
import numpy as np
from threadpoolctl import threadpool_limits
from run_visuals import pwem


class TeachingPhysicsTests(unittest.TestCase):
    def test_uniform_medium_dispersion(self):
        k=np.array([.13,.21])
        g=np.array([(i,j) for i in range(-2,3) for j in range(-2,3)])
        expected=np.sort(np.linalg.norm(g+k,axis=1)/3.4)[:6]
        np.testing.assert_allclose(pwem(2,radius=0)(k),expected,atol=1e-12)

    def test_rotation_and_reciprocity(self):
        solve=pwem(4)
        a=solve([.11,.24])
        np.testing.assert_allclose(a,solve([-.24,.11]),atol=1e-12)
        np.testing.assert_allclose(a,solve([-.11,-.24]),atol=1e-12)

    def test_overlap_is_not_gap(self):
        solve=pwem(11)
        self.assertLess(solve([.5,.5])[2]-solve([0,0])[1],0)
        self.assertGreater(solve([.5,0])[2]-solve([.5,0])[1],.15)

    def test_four_mode_basis(self):
        u=np.array([[1,1,-1,-1],[1,1,1,1],[1,-1,0,0],[0,0,1,-1]],float).T
        u/=np.linalg.norm(u,axis=0)
        h=np.array([[0,-.06,.02,.02],[-.06,0,.02,.02],[.02,.02,0,-.06],[.02,.02,-.06,0]])
        np.testing.assert_allclose(u.T@u,np.eye(4),atol=1e-14)
        np.testing.assert_allclose(h@u,u*np.array([-.10,-.02,.06,.06]),atol=1e-14)

    def test_fft_matches_analytic_farfield(self):
        n=512; dx=12/n
        x=(np.arange(n)-n/2)*dx
        xx,yy=np.meshgrid(x,x)
        q=np.fft.fftshift(np.fft.fftfreq(n,dx))*2*np.pi
        qx,qy=np.meshgrid(q,q)
        for field,analytic in [
            (np.exp(-xx**2-yy**2),np.exp(-(qx*qx+qy*qy)/2)),
            (xx*np.exp(-xx**2-yy**2),qx*qx*np.exp(-(qx*qx+qy*qy)/2)),
            (xx*yy*np.exp(-xx**2-yy**2),qx*qx*qy*qy*np.exp(-(qx*qx+qy*qy)/2))]:
            power=abs(np.fft.fftshift(np.fft.fft2(np.fft.ifftshift(field))))**2
            np.testing.assert_allclose(power/power.max(),analytic/analytic.max(),atol=1e-12)


if __name__=='__main__':
    with threadpool_limits(limits=1):
        unittest.main()
