import { useRef, useEffect, type ReactNode, type SyntheticEvent } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

/** Keep same-caller/tenant drafts mounted only during a pending live check.
 * Hidden + inert is a UX pause, NOT an authority grant. Hook grants remain empty;
 * real failures, caller/tenant/role changes and denied responses drop the subtree.
 */
export function AuthorityBoundary({ allowed, fallback, children }: {
  allowed: boolean; fallback: ReactNode; children: ReactNode;
}) {
  const { authorityPending, authorityScope } = useOrganization();
  const lastAllowedScope = useRef<string | null>(null);
  const preserving = authorityPending && !!authorityScope && lastAllowedScope.current === authorityScope;
  if (!authorityPending) lastAllowedScope.current = allowed ? authorityScope : null;
  const mounted = (!authorityPending && allowed) || preserving;

  // React portals escape the hidden/inert DOM ancestor (e.g. modal forms),
  // but their events still traverse this React boundary. Pause those too.
  const blockPending = (event: SyntheticEvent) => {
    if (authorityPending) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined' || !authorityPending) return;

    const portalCleanups: Array<() => void> = [];

    const isModalPortal = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.id === 'root') return false;
      return (
        el.hasAttribute('data-radix-portal') ||
        el.getAttribute('role') === 'dialog' ||
        el.querySelector('[role="dialog"]') !== null ||
        el.querySelector('[data-radix-portal]') !== null
      );
    };

    const isolatePortal = (el: Element) => {
      if (isModalPortal(el) && el instanceof HTMLElement) {
        const prevInert = el.hasAttribute('inert');
        const prevHidden = el.hasAttribute('hidden');
        const prevDisplay = el.style.display;

        el.setAttribute('inert', '');
        el.setAttribute('hidden', '');
        el.style.display = 'none';

        portalCleanups.push(() => {
          if (!prevInert) el.removeAttribute('inert');
          if (!prevHidden) el.removeAttribute('hidden');
          el.style.display = prevDisplay;
        });
      }
    };

    // Isolate any existing modal portal roots in document.body
    for (const el of Array.from(document.body.children)) {
      isolatePortal(el);
    }

    // Un-hide #root if Radix dialog applied aria-hidden="true" to it
    const rootEl = document.getElementById('root');
    let removedRootAriaHidden = false;
    if (rootEl?.getAttribute('aria-hidden') === 'true') {
      rootEl.removeAttribute('aria-hidden');
      removedRootAriaHidden = true;
    }

    // Also observe new modal portals added while authority is pending
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof Element) isolatePortal(node);
        }
      }
      if (rootEl?.getAttribute('aria-hidden') === 'true') {
        rootEl.removeAttribute('aria-hidden');
        removedRootAriaHidden = true;
      }
    });

    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
      for (const cleanup of portalCleanups) cleanup();
      if (removedRootAriaHidden && rootEl) {
        rootEl.setAttribute('aria-hidden', 'true');
      }
    };
  }, [authorityPending]);

  return <>
    {authorityPending && !mounted ? <span role="status" className="sr-only">Verifying clinic access…</span> : !allowed && fallback}
    <div key={authorityScope ?? 'unverified'} hidden={!mounted} inert={!mounted}
      onClickCapture={blockPending} onSubmitCapture={blockPending} onKeyDownCapture={blockPending}
      onPointerDownCapture={blockPending} onChangeCapture={blockPending}
      onInputCapture={blockPending} onKeyUpCapture={blockPending}>
      {mounted ? children : null}
    </div>
  </>;
}