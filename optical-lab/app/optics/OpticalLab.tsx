import { lazy, Suspense, useEffect } from 'react';
import { OpticsIcon } from '../design/OpticsIcon';
import './optical-lab.css';
const OpticalBenchTraining = lazy(() => import('../training/OpticalBenchTraining').then(module => ({ default: module.OpticalBenchTraining })));
const OpticalDesigner = lazy(() => import('../design/OpticalDesigner').then(module => ({ default: module.OpticalDesigner })));

type LabPage = 'tutorial' | 'designer';

export function opticalLabPage(pathname: string): LabPage | null {
  if (/^\/(?:tutorial\/?)?$/.test(pathname) || /^\/optics(?:\/tutorial)?\/?$/.test(pathname) || /^\/training\/optical-bench\/?$/.test(pathname)) return 'tutorial';
  if (/^\/designer\/?$/.test(pathname) || /^\/optics\/designer\/?$/.test(pathname) || /^\/design\/optical-bench\/?$/.test(pathname)) return 'designer';
  return null;
}

export function OpticalLab({ page }: { page: LabPage }) {
  useEffect(() => {
    // Avoid the book's overflow-x:hidden creating a separate body scroll ancestor.
    document.documentElement.classList.add('ol-document');
    document.body.classList.add('ol-document');
    return () => {
      document.documentElement.classList.remove('ol-document');
      document.body.classList.remove('ol-document');
    };
  }, []);
  useEffect(() => {
    document.title = `${page === 'tutorial' ? '教程与实训' : '设计工作台'} · 光学实验室`;
  }, [page]);

  return <div className={`ol-lab ol-${page}`}>
    <header className="ol-header">
      <a className="ol-brand" href="/" aria-label="光学实验室首页">
        <span className="ol-mark"><OpticsIcon name="optics" size={25} /></span>
        <span><strong>光学实验室</strong><small>Optical Lab · 光路教学</small></span>
      </a>
      <nav className="ol-pages" aria-label="光学实验室分页面">
        <a href="/" aria-current={page === 'tutorial' ? 'page' : undefined}><OpticsIcon name="book" size={18} /><span>教程与实训</span></a>
        <a href="/designer/" aria-current={page === 'designer' ? 'page' : undefined}><OpticsIcon name="optics" size={18} /><span>设计工作台</span></a>
      </nav>
      <a className="ol-book-link" href="https://pcsel-knowledge-site.pages.dev/">返回教材 <span aria-hidden="true">↗</span></a>
    </header>
    <Suspense fallback={<p style={{ padding: 32 }} role="status">正在加载光学实验室…</p>}>{page === 'tutorial' ? <OpticalBenchTraining /> : <OpticalDesigner />}</Suspense>
  </div>;
}
