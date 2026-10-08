import { useEffect, useRef, useState, type ReactNode } from 'react';
import { OpticsIcon, type OpticsIconName } from './OpticsIcon';

export function WorkspacePanel({ title, icon = 'layers', revealKey, className = '', children }: {
  title: string;
  icon?: OpticsIconName;
  revealKey?: string;
  className?: string;
  children: ReactNode;
}) {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  const [expanded, setExpanded] = useState(false);
  const previousSelection = useRef(revealKey);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (previousSelection.current !== revealKey && !wide) setExpanded(true);
    previousSelection.current = revealKey;
  }, [revealKey, wide]);

  return <details className={`od-tool-panel ${className}`} open={wide || expanded} onToggle={event => {
    if (!wide) setExpanded(event.currentTarget.open);
  }}>
    <summary className="od-tool-summary"><OpticsIcon name={icon} size={18} /><span>{title}</span><small>{expanded ? '收起' : '展开'}</small><OpticsIcon name="chevronDown" size={16} /></summary>
    <div className="od-tool-content">{children}</div>
  </details>;
}
