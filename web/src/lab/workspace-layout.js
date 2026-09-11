// Presentation preferences never enter a scene, recording, or neural state.
const PREFS_KEY = 'duckfly.workspace.v1';
const FILTERS = {
  start: ['target', 'occlusion', 'flock', 'empty'],
  vision: ['target', 'gaze', 'occlusion', 'vision', 'loom', 'stop-go', 'kick'],
  brain: ['switchboard', 'recovery', 'flock', 'empty', 'stop-go', 'kick'],
};
export function mountWorkspaceLayout({onResize, onOpenPanel = () => {}}) {
  const $ = selector => document.querySelector(selector);
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { /* Defaults also work without storage. */ }
  if (typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {};
  let focus = false, savedPanels;
  const small = matchMedia('(max-width: 820px)');
  const panels = [...document.querySelectorAll('details[data-panel]')];
  const stagePanels = panels.filter(panel => panel.classList.contains('workspace-panel'));
  const rail = [['#panel-connections',['brain-mapping-panel']],['#panel-objects',['objects-panel','prop-behavior-panel']],['#panel-experiment',['experiment-controls']]];
  let lastRail = '#panel-connections';
  const visibleOpen = panel => panel?.open && !panel.hidden && !panel.parentElement.hidden;
  function syncRail() {
    rail.forEach(([selector,ids])=>$(selector).setAttribute('aria-expanded',String(ids.some(id=>visibleOpen($('#'+id))))));
    $('#close-stage-settings').hidden=!stagePanels.some(visibleOpen);
  }
  function closePanels() {stagePanels.forEach(panel=>panel.open=false);syncRail();}
  function openPanel(id, moveFocus = false) {
    const group = rail.find(([,ids])=>ids.includes(id));
    if (!group) return;
    if(focus)setFocus(false);
    onOpenPanel();
    closePanels();lastRail=group[0];
    group[1].forEach(key=>{const panel=$('#'+key);if(panel&&!panel.hidden&&!panel.parentElement.hidden)panel.open=true;});
    syncRail();
    const container=$('#scene-control-panels');container.scrollTop=0;
    if(moveFocus)$('#'+group[1][0])?.querySelector('summary').focus({preventScroll:true});
  }
  rail.forEach(([selector,ids])=>$(selector).onclick=()=>{
    if(ids.some(id=>visibleOpen($('#'+id))))closePanels();
    else openPanel(ids[0],true);
  });
  $('#close-stage-settings').onclick=()=>{closePanels();$(lastRail).focus();};
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
    if (panel.classList.contains('workspace-panel')) panel.open=false;
    else if (typeof prefs[panel.id] === 'boolean') panel.open = prefs[panel.id];
    else if (small.matches && panel.classList.contains('workspace-panel')) panel.open = false;
    panel.addEventListener('toggle', () => {
      syncRail();
      if (!focus) { prefs[panel.id] = panel.open; persist(); }
      requestAnimationFrame(() => {
        onResize();
        if (panel.open && panel.classList.contains('workspace-panel')) {
          const workspace = $('#scene-control-panels');
          // Reveal controls inside their own pane without scrolling the brain dock away.
          // Object selection and its physics are one group. Keep the switcher visible.
          const first = stagePanels.find(visibleOpen);
          if(panel === first)workspace.scrollTop = 0;
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
    if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
    {
      const menus = [...document.querySelectorAll('.app-menu[open]')];
      if (menus.length) {
        menus.forEach(menu => menu.open = false);
        menus[0].querySelector('summary').focus();
        event.preventDefault();
        return;
      }
    }
    if (!$('#tools-panel').hidden) return; // The drawer handles its own close and focus.
    if (stagePanels.some(visibleOpen)) {
      closePanels();$(lastRail).focus();event.preventDefault();return;
    }
    if (focus) {
      setFocus(false);
      $('#focus-mode').focus();
      event.preventDefault();
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
  syncRail();
  return {setFocus,closePanels,openPanel};
}
