// Presentation preferences never enter a scene, recording, or neural state.
const PREFS_KEY = 'duckfly.workspace.v1';
const FILTERS = {
  start: ['target', 'occlusion', 'flock', 'empty'],
  vision: ['target', 'gaze', 'occlusion', 'vision', 'loom', 'stop-go', 'kick'],
  brain: ['switchboard', 'recovery', 'flock', 'empty', 'stop-go', 'kick'],
};
export function mountWorkspaceLayout({onResize}) {
  const $ = selector => document.querySelector(selector);
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { /* Defaults also work without storage. */ }
  if (typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {};
  let focus = false, savedPanels;
  const small = matchMedia('(max-width: 820px)');
  const panels = [...document.querySelectorAll('details[data-panel]')];
  const persist = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* Private browsing may deny storage. */ } };
  const compactKey = () => small.matches ? 'compactSmall' : 'compactWide';
  const isCompact = () => focus || (typeof prefs[compactKey()] === 'boolean' ? prefs[compactKey()] : small.matches);
  const render = () => {
    const compact = isCompact();
    document.body.classList.toggle('focus-mode', focus);
    $('.lab-layout').classList.toggle('compact-monitor', compact);
    $('#brain-panel').classList.toggle('is-compact', compact);
    $('#compact-brain').textContent = compact ? 'Expand' : 'Compact';
    $('#compact-brain').setAttribute('aria-expanded', String(!compact));
    $('#compact-brain').title = compact ? 'Expand brain panel controls' : 'Collapse brain panel to a live monitor';
    $('#focus-mode').textContent = focus ? 'Exit focus' : 'Focus';
    $('#focus-mode').setAttribute('aria-pressed', String(focus));
    requestAnimationFrame(onResize);
  };
  function setFocus(value) {
    if (focus === value) return;
    focus = value;
    if (focus) {
      savedPanels = new Map(panels.map(panel => [panel, panel.open]));
      panels.forEach(panel => panel.open = false);
    } else {
      savedPanels?.forEach((open, panel) => panel.open = open);
      savedPanels = null;
    }
    render();
  }
  panels.forEach(panel => {
    if (typeof prefs[panel.id] === 'boolean') panel.open = prefs[panel.id];
    else if (small.matches && panel.classList.contains('workspace-panel')) panel.open = false;
    panel.addEventListener('toggle', () => {
      if (!focus) { prefs[panel.id] = panel.open; persist(); }
      requestAnimationFrame(() => {
        onResize();
        if (panel.open && panel.classList.contains('workspace-panel')) {
          const workspace = $('#scene-control-panels');
          // Reveal controls inside their own pane without scrolling the brain dock away.
          workspace.scrollTop = Math.max(0, panel.getBoundingClientRect().top - workspace.getBoundingClientRect().top + workspace.scrollTop);
        }
      });
    });
  });
  $('#compact-brain').onclick = () => {
    const next = !isCompact();
    if (focus) setFocus(false);
    prefs[compactKey()] = next;
    persist();
    render();
  };
  $('#focus-mode').onclick = () => setFocus(!focus);
  small.addEventListener('change', render);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
      const menus = [...document.querySelectorAll('.app-menu[open]')];
      if (menus.length) {
        menus.forEach(menu => menu.open = false);
        menus[0].querySelector('summary').focus();
        return;
      }
    }
    if (event.key === 'Escape' && focus && !document.querySelector('dialog[open]') && $('#tools-panel').hidden) {
      setFocus(false);
      $('#focus-mode').focus();
    }
  });
  document.querySelectorAll('[data-scenario-filter]').forEach(button => {
    button.onclick = () => {
      const filter = button.dataset.scenarioFilter;
      document.querySelectorAll('[data-scenario-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      let count = 0;
      document.querySelectorAll('[data-scenario]').forEach(tile => {
        tile.hidden = filter !== 'all' && !FILTERS[filter]?.includes(tile.dataset.scenario);
        if (!tile.hidden) count++;
      });
      $('#scenario-count').textContent = `${count} scenes`;
    };
  });
  new ResizeObserver(([entry]) => {
    $('.lab-layout').style.setProperty('--monitor-height', `${entry.target.getBoundingClientRect().height}px`);
    requestAnimationFrame(onResize);
  }).observe($('#brain-panel'));
  render();
  return {setFocus};
}
