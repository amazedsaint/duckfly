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
  let focus = false, savedLayout;
  const small = matchMedia('(max-width: 820px)');
  const docked = matchMedia('(min-width: 1200px)');
  const workspace = $('.workspace');
  const container = $('#scene-control-panels');
  const tools = $('#tools-panel');
  // Reparent the actual controls. Their listeners, current values, and object
  // editors stay mounted while all inspector intents share this one slot.
  container.append(tools);
  workspace.classList.add('intent-workspace');
  container.classList.add('workspace-inspector');
  container.setAttribute('role', 'region');
  tools.dataset.inspectorPanel = 'advanced';
  const panels = [...document.querySelectorAll('details[data-panel]')];
  const stagePanels = panels.filter(panel => panel.classList.contains('workspace-panel'));
  const rail = [['#panel-connections',['brain-mapping-panel'],'connections'],['#panel-objects',['objects-panel','prop-behavior-panel'],'objects'],['#panel-experiment',['experiment-controls'],'experiment']];
  let lastRail = '#panel-connections';
  let resizeQueued = false;
  const resize = () => {
    if(resizeQueued)return;
    resizeQueued=true;
    requestAnimationFrame(()=>{resizeQueued=false;onResize();});
  };
  const available = panel => {
    if(!panel)return false;
    for(let element=panel;element&&element!==container;element=element.parentElement)if(element.hidden)return false;
    return true;
  };
  const visibleOpen = panel => !!panel?.open && available(panel);
  const inspectorIntent = () => !tools.hidden ? 'advanced' : rail.find(([,ids])=>ids.some(id=>visibleOpen($('#'+id))))?.[2] ?? 'none';
  function measureInspector() {
    const settingsRail=$('.stage-settings-rail'),status=$('.statusbar');
    const railHeight=settingsRail.getBoundingClientRect().height;
    const statusHeight=getComputedStyle(status).display==='none'?0:status.getBoundingClientRect().height;
    workspace.style.setProperty('--inspector-bottom',`${Math.ceil(railHeight+statusHeight+(statusHeight?16:8))}px`);
  }
  function syncRail() {
    rail.forEach(([selector,ids])=>$(selector).setAttribute('aria-expanded',String(ids.some(id=>visibleOpen($('#'+id))))));
    const intent=inspectorIntent(),open=!focus&&intent!=='none';
    $('#tools-button').setAttribute('aria-expanded',String(!focus&&!tools.hidden));
    $('#close-stage-settings').hidden=!open;
    container.hidden=!open;
    container.dataset.inspectorOpen=String(open);
    container.dataset.inspectorIntent=intent;
    container.setAttribute('aria-label',({connections:'Brain to duck connections',objects:'Objects and physics',experiment:'Experiment controls',advanced:'Advanced scene settings',none:'Scene settings'})[intent]);
    workspace.dataset.inspectorIntent=intent;
    workspace.dataset.inspectorLayout=docked.matches?'docked':'drawer';
    workspace.classList.toggle('inspector-open',open);
    measureInspector();resize();
  }
  function closeCurrentInspector() {
    stagePanels.forEach(panel=>panel.open=false);
    tools.hidden=true;
    syncRail();
  }
  function closePanels() {
    // An explicit close (including going home) also cancels an inspector that
    // was temporarily hidden by Focus, so it cannot reappear on a later scene.
    if(savedLayout){
      savedLayout.toolsOpen=false;
      stagePanels.forEach(panel=>savedLayout.panels.set(panel,false));
    }
    closeCurrentInspector();
  }
  function setTools(open) {
    if(open){
      if(focus)setFocus(false);
      stagePanels.forEach(panel=>panel.open=false);
      tools.hidden=false;lastRail='#tools-button';
      $('#selected-object-panel').open=true;
      syncRail();container.scrollTop=0;
      $('#close-tools').focus({preventScroll:true});
    }else{
      const focusWasInside=tools.contains(document.activeElement);
      tools.hidden=true;
      if(savedLayout)savedLayout.toolsOpen=false;
      syncRail();
      if(focusWasInside)$('#tools-button').focus({preventScroll:true});
    }
  }
  function openPanel(id, moveFocus = false) {
    const group = rail.find(([,ids])=>ids.includes(id));
    if (!group) return;
    if(focus)setFocus(false);
    closeCurrentInspector();lastRail=group[0];
    group[1].forEach(key=>{const panel=$('#'+key);if(available(panel))panel.open=true;});
    syncRail();
    container.scrollTop=0;
    if(moveFocus)$('#'+group[1][0])?.querySelector('summary').focus({preventScroll:true});
  }
  rail.forEach(([selector,ids])=>$(selector).onclick=()=>{
    if(ids.some(id=>visibleOpen($('#'+id))))closePanels();
    else openPanel(ids[0],true);
  });
  $('#close-stage-settings').onclick=()=>{closePanels();$(lastRail).focus({preventScroll:true});};
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
    $('#compact-brain').title = compact ? 'Expand brain panel controls' : 'Show a compact brain monitor';
    $('#focus-mode').textContent = focus ? 'Exit focus' : 'Focus';
    $('#focus-mode').setAttribute('aria-pressed', String(focus));
    syncRail();
  };
  function setFocus(value) {
    if (focus === value) return;
    focus = value;
    if (focus) {
      savedLayout = {panels:new Map(panels.map(panel => [panel, panel.open])),toolsOpen:!tools.hidden,scrollTop:container.scrollTop,lastRail};
      panels.forEach(panel => panel.open = false);
      tools.hidden=true;
    } else {
      const previous=savedLayout;
      previous?.panels.forEach((open, panel) => panel.open = open);
      tools.hidden=!previous?.toolsOpen;
      if(previous)lastRail=previous.lastRail;
      savedLayout = null;
      render();
      if(previous)container.scrollTop=previous.scrollTop;
      return;
    }
    render();
  }
  panels.forEach(panel => {
    if (panel.classList.contains('workspace-panel')) panel.open=false;
    else if (typeof prefs[panel.id] === 'boolean') panel.open = prefs[panel.id];
    panel.addEventListener('toggle', () => {
      if(!focus&&panel.open&&stagePanels.includes(panel)){
        const group=rail.find(([,ids])=>ids.includes(panel.id));
        if(group){
          tools.hidden=true;lastRail=group[0];
          stagePanels.filter(other=>!group[1].includes(other.id)).forEach(other=>other.open=false);
        }
      }
      syncRail();
      if (!focus) { prefs[panel.id] = panel.open; persist(); }
      // Opening an intent resets its scroll in openPanel/setTools. Expanding a
      // disclosure or restoring Focus should retain the user's reading position.
      resize();
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
  docked.addEventListener('change', syncRail);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
    {
      const menus = [...document.querySelectorAll('.app-menu[open]')].filter(menu=>menu.getClientRects().length&&!menu.closest('[hidden]'));
      if (menus.length) {
        menus.forEach(menu => menu.open = false);
        menus[0].querySelector('summary').focus();
        event.preventDefault();
        return;
      }
    }
    if (!tools.hidden) {setTools(false);event.preventDefault();return;}
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
    resize();
  }).observe($('#brain-panel'));
  const inspectorObserver = new ResizeObserver(()=>{measureInspector();resize();});
  inspectorObserver.observe(workspace);
  inspectorObserver.observe($('.stage-settings-rail'));
  inspectorObserver.observe($('.statusbar'));
  new MutationObserver(records=>{
    if(records.some(({target})=>target===tools||stagePanels.includes(target)||target.id==='guided-lab'))syncRail();
  }).observe(container,{attributes:true,attributeFilter:['hidden','open'],subtree:true});
  render();
  syncRail();
  return {setFocus,closePanels,openPanel,setTools};
}
