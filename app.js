const API_URL = 'https://script.google.com/macros/s/AKfycbxgSkDYPhTJerGbFsubJE9b_xuwCM6KnAtWh5gFF3WEIEGFWf-SIHd_iWUH3J4JitWUHA/exec';
const PALETA_CORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const IMGBB_API_KEY = 'fa0265b3bfc740c1eb09a7e4d6ec493a';
const CACHE_KEY_PREFIX = 'minhaAgenda_';

let currentUser = null;
let currentProfId = null;
let dataAtual = new Date();
let servicosCache = [], agendamentosCache = [], clientesCache = [], pacotesCache = [], usuariosCache = [];
let itensPacoteTemp = [];
let abaAtiva = 'agenda';
let config = { 
    abertura: '08:00', 
    fechamento: '19:00', 
    intervalo_minutos: 60, 
    permite_encaixe: false,
    mensagem_lembrete: "Olá {cliente}, seu agendamento é dia {data} às {hora}.",
    mensagens_rapidas: [] 
};
let agendamentosRaw = [];
let isSyncing = false;
let pollingInterval = null;

// --- CACHE LOCAL ---
function saveToCache(key, data) { localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(data)); }
function getFromCache(key) { const data = localStorage.getItem(CACHE_KEY_PREFIX + key); return data ? JSON.parse(data) : null; }

// --- ACTIONS & NAV ---
function switchTab(t, el) { 
    abaAtiva = t; 
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active')); 
    el.classList.add('active'); 
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); 
    document.getElementById(`tab-${t}`).classList.add('active'); 
    document.getElementById('main-fab').style.display = t==='config'?'none':'flex'; 
    if (t === 'pacotes') carregarPacotes(); 
    if (t === 'config') atualizarUIConfig();
}

function switchConfigTab(tab) {
    document.getElementById('cfg-area-geral').classList.add('hidden');
    document.getElementById('cfg-area-msg').classList.add('hidden');
    document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-slate-400';

    if(tab === 'geral') {
        document.getElementById('cfg-area-geral').classList.remove('hidden');
        document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    } else {
        document.getElementById('cfg-area-msg').classList.remove('hidden');
        document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    }
}

function acaoFab() { if(abaAtiva==='servicos') abrirModalServico(); else if(abaAtiva==='agenda') abrirModalAgendamento(); else if(abaAtiva==='pacotes') abrirModalVenderPacote(); else if(abaAtiva==='equipa') abrirModalUsuario(); }

function mudarDia(d) { 
    dataAtual.setDate(dataAtual.getDate()+d); 
    atualizarDataEPainel(); 
}

function atualizarDataEPainel() {
    document.getElementById('data-picker').value = dataAtual.toISOString().split('T')[0]; 
    document.getElementById('dia-semana-display').innerText = dataAtual.toLocaleDateString('pt-PT', {weekday:'long', day:'numeric', month:'long'});
    atualizarAgendaVisual(); 
}

function renderizarColorPicker() { const c=document.getElementById('color-picker-container'); c.innerHTML=''; PALETA_CORES.forEach((cor,i)=>{const d=document.createElement('div');d.className=`color-option ${i===4?'selected':''}`;d.style.backgroundColor=cor;d.onclick=()=>{document.querySelectorAll('.color-option').forEach(el=>el.classList.remove('selected'));d.classList.add('selected');document.getElementById('input-cor-selecionada').value=cor};c.appendChild(d)})}
function renderizarColorPickerEdicao() { const c=document.getElementById('edit-color-picker-container'); c.innerHTML=''; PALETA_CORES.forEach((cor,i)=>{const d=document.createElement('div');d.className=`color-option ${i===4?'selected':''}`;d.style.backgroundColor=cor;d.onclick=()=>{document.querySelectorAll('#edit-color-picker-container .color-option').forEach(el=>el.classList.remove('selected'));d.classList.add('selected');document.getElementById('edit-input-cor-selecionada').value=cor};c.appendChild(d)})}

function formatarDataBr(s) { 
    if(!s) return ''; 
    if(s.includes('T')) return new Date(s).toLocaleDateString('pt-BR'); return s.split('-').reverse().join('/'); 
}
function excluirServicoViaModal(){ const id=document.getElementById('edit-id-servico').value; mostrarConfirmacao('Excluir Serviço', 'Tem certeza?', async () => { try { await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'deleteServico', id_servico: id})}); fecharModal('modal-confirmacao'); fecharModal('modal-editar-servico'); carregarServicos(); } catch(e) { mostrarAviso('Erro'); } }); }
function mudarProfissionalAgenda() { currentProfId = document.getElementById('select-profissional-agenda').value; atualizarAgendaVisual(); }
function renderizarListaUsuarios() { const container = document.getElementById('lista-usuarios'); container.innerHTML = ''; usuariosCache.forEach(u => { container.innerHTML += `<div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">${u.nome.charAt(0)}</div><div><h4 class="font-bold text-slate-800">${u.nome}</h4><p class="text-xs text-slate-400 capitalize">${u.nivel}</p></div></div></div>`; }); }

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if(savedUser) { currentUser = JSON.parse(savedUser); iniciarApp(); }
    
    document.getElementById('data-picker').addEventListener('change', (e) => { 
        const p=e.target.value.split('-'); 
        dataAtual=new Date(p[0],p[1]-1,p[2]); 
        atualizarDataEPainel(); 
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal(overlay.id);
            }
        });
    });

    window.addEventListener('beforeunload', function (e) {
        if (isSyncing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// ============ CORE ============
async function fazerLogin(e) {
    e.preventDefault(); const btn = document.getElementById('btn-login'); setLoading(btn, true, 'Entrar'); const email = document.getElementById('login-email').value; const senha = document.getElementById('login-senha').value; const manter = document.getElementById('login-manter').checked;
    try { const r = await fetch(`${API_URL}?action=login&email=${email}&senha=${senha}`); const res = await r.json(); if (res.status === 'sucesso') { currentUser = res.usuario; if(manter) localStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser)); else sessionStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser)); iniciarApp(); } else { mostrarAviso(res.mensagem); setLoading(btn, false, 'Entrar'); } } catch(err) { mostrarAviso('Erro de conexão'); setLoading(btn, false, 'Entrar'); }
}
function logout() { localStorage.removeItem('minhaAgendaUser'); sessionStorage.removeItem('minhaAgendaUser'); if(pollingInterval) clearInterval(pollingInterval); location.reload(); }
function iniciarApp() {
    document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-header').classList.remove('hidden'); document.getElementById('app-header').classList.add('flex'); document.getElementById('bottom-nav').classList.remove('hidden'); document.getElementById('bottom-nav').classList.add('flex'); document.getElementById('main-fab').classList.remove('hidden'); document.getElementById('main-fab').classList.add('flex'); document.getElementById('user-name-display').innerText = `Olá, ${currentUser.nome}`; document.getElementById('tab-agenda').classList.add('active');
    currentProfId = String(currentUser.id_usuario); if (currentUser.nivel !== 'admin') { document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); } else { document.getElementById('select-profissional-agenda').classList.remove('hidden'); }
    renderizarColorPicker(); renderizarColorPickerEdicao(); carregarDoCache(); sincronizarDadosAPI(); pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    if(cachedServicos) { servicosCache = cachedServicos; renderizarListaServicos(); atualizarDatalistServicos(); }
    if(cachedConfig) { config = cachedConfig; atualizarUIConfig(); }
    if(cachedUsuarios) { usuariosCache = cachedUsuarios; popularSelectsUsuarios(); renderizarListaUsuarios(); }
    if(cachedAgendamentos) { agendamentosRaw = cachedAgendamentos; }
    if(cachedClientes) { clientesCache = cachedClientes; atualizarDatalistClientes(); }
    if(cachedPacotes) { pacotesCache = cachedPacotes; }
    
    atualizarDataEPainel();
}

async function sincronizarDadosAPI() {
    const hasData = document.querySelectorAll('.time-slot').length > 0; const container = document.getElementById('agenda-timeline'); 
    if(!hasData && agendamentosRaw.length === 0) { container.innerHTML = '<div class="p-10 text-center text-slate-400"><div class="spinner spinner-dark mx-auto mb-2 border-slate-300 border-t-blue-500"></div><p>A carregar agenda...</p></div>'; } else { showSyncIndicator(true); }
    try {
        const fetchSafe = async (action) => { try { const r = await fetch(`${API_URL}?action=${action}`); return await r.json(); } catch(e) { console.error(`Erro ${action}`, e); return []; } };
        const [resConfig, resServicos, resClientes, resPacotes, resAgendamentos, resUsuarios] = await Promise.all([ fetchSafe('getConfig'), fetchSafe('getServicos'), fetchSafe('getClientes'), fetchSafe('getPacotes'), fetchSafe('getAgendamentos'), currentUser.nivel === 'admin' ? fetchSafe('getUsuarios') : Promise.resolve([]) ]);
        if(resConfig && resConfig.abertura) { config = resConfig; saveToCache('config', config); atualizarUIConfig(); }
        servicosCache = Array.isArray(resServicos) ? resServicos : []; saveToCache('servicos', servicosCache);
        clientesCache = Array.isArray(resClientes) ? resClientes : []; saveToCache('clientes', clientesCache);
        pacotesCache = Array.isArray(resPacotes) ? resPacotes : []; saveToCache('pacotes', pacotesCache);
        agendamentosRaw = Array.isArray(resAgendamentos) ? resAgendamentos : []; saveToCache('agendamentos', agendamentosRaw);
        usuariosCache = Array.isArray(resUsuarios) ? resUsuarios : []; if(usuariosCache.length > 0) saveToCache('usuarios', usuariosCache);
        atualizarDataEPainel(); atualizarDatalistServicos(); atualizarDatalistClientes(); renderizarListaServicos(); if (currentUser.nivel === 'admin') { renderizarListaPacotes(); renderizarListaUsuarios(); popularSelectsUsuarios(); }
        atualizarAgendaVisual(); showSyncIndicator(false);
    } catch (error) { console.error("Erro sincronização", error); if(!hasData) container.innerHTML = '<p class="text-center text-red-400 text-sm">Erro de conexão.</p>'; showSyncIndicator(false); }
}

function atualizarAgendaVisual() {
    if (!agendamentosRaw) return; const filtroId = String(currentProfId);
    agendamentosCache = agendamentosRaw.filter(a => { const aId = a.id_profissional ? String(a.id_profissional) : ''; if (currentUser.nivel === 'admin') { return aId === filtroId; } else { return aId === String(currentUser.id_usuario); } });
    renderizarGrade();
}

function recarregarAgendaComFiltro(silencioso = false) {
    if(!silencioso) showSyncIndicator(true);
    const modalIdInput = document.getElementById('id-agendamento-ativo'); const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null; let tempItem = null; if(activeTempId) { tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId); }
    fetch(`${API_URL}?action=getAgendamentos`).then(r => r.json()).then(dados => {
        const novosAgendamentos = Array.isArray(dados) ? dados : [];
        if (activeTempId && tempItem) {
            const realItem = novosAgendamentos.find(a => a.data_agendamento === tempItem.data_agendamento && a.hora_inicio === tempItem.hora_inicio && (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) );
            if (realItem) { 
                const idxLocal = agendamentosRaw.findIndex(a => a.id_agendamento === activeTempId); if(idxLocal !== -1) { agendamentosRaw[idxLocal] = realItem; }
                modalIdInput.value = realItem.id_agendamento; abrirModalDetalhes(realItem.id_agendamento); 
            }
        }
        agendamentosRaw = novosAgendamentos; saveToCache('agendamentos', agendamentosRaw); atualizarAgendaVisual(); showSyncIndicator(false);
    }).catch((e) => { console.error(e); showSyncIndicator(false); });
}

function showSyncIndicator(show) { isSyncing = show; document.getElementById('sync-indicator').style.display = show ? 'flex' : 'none'; }

function renderizarGrade() {
    const container = document.getElementById('agenda-timeline'); if(!container) return; container.innerHTML = '';
    const [hA, mA] = config.abertura.split(':').map(Number); const [hF, mF] = config.fechamento.split(':').map(Number); const startMin = hA*60 + mA; const endMin = hF*60 + mF; const interval = parseInt(config.intervalo_minutos) || 60; const dateIso = dataAtual.toISOString().split('T')[0];
    for(let m = startMin; m < endMin; m += interval) { const hSlot = Math.floor(m/60); const mSlot = m % 60; const timeStr = `${String(hSlot).padStart(2,'0')}:${String(mSlot).padStart(2,'0')}`; const div = document.createElement('div'); div.className = 'time-slot'; div.style.height = '80px'; div.innerHTML = `<div class="time-label">${timeStr}</div><div class="slot-content" id="slot-${m}"><div class="slot-livre-area" onclick="abrirModalAgendamento('${timeStr}')"></div></div>`; container.appendChild(div); }
    const events = agendamentosCache.filter(a => a.data_agendamento === dateIso && a.hora_inicio).map(a => { const [h, m] = a.hora_inicio.split(':').map(Number); const start = h*60 + m; const svc = servicosCache.find(s => String(s.id_servico) === String(a.id_servico)); const dur = svc ? parseInt(svc.duracao_minutos) : 60; return { ...a, start, end: start + dur, dur, svc }; }).sort((a,b) => a.start - b.start);
    let groups = []; let lastEnd = -1; events.forEach(ev => { if(ev.start >= lastEnd) { groups.push([ev]); lastEnd = ev.end; } else { groups[groups.length-1].push(ev); if(ev.end > lastEnd) lastEnd = ev.end; } });
    groups.forEach(group => { const width = 100 / group.length; group.forEach((ev, idx) => { if(ev.start < startMin || ev.start >= endMin) return; const offset = (ev.start - startMin) % interval; const slotBase = ev.start - offset; const slotEl = document.getElementById(`slot-${slotBase}`); if(!slotEl) return; const height = (ev.dur / interval) * 80; const top = (offset / interval) * 80; const left = idx * width; const card = document.createElement('div'); card.className = 'event-card'; card.style.top = `${top + 2}px`; card.style.height = `calc(${height}px - 4px)`; card.style.left = `calc(${left}% + 2px)`; card.style.width = `calc(${width}% - 4px)`; const color = getCorServico(ev.svc); card.style.backgroundColor = hexToRgba(color, 0.15); card.style.borderLeftColor = color; card.style.color = '#1e293b'; let statusIcon = ''; if(ev.status === 'Confirmado') { statusIcon = '<div class="absolute top-1 right-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>'; card.classList.add('status-confirmado'); } else if (ev.status === 'Concluido') card.classList.add('status-concluido'); else if (ev.status === 'Cancelado') card.classList.add('status-cancelado'); else card.style.borderLeftColor = color; card.onclick = (e) => { e.stopPropagation(); abrirModalDetalhes(ev.id_agendamento); }; const name = ev.nome_cliente || ev.observacoes || 'Cliente'; card.innerHTML = `${statusIcon}<div style="width:90%" class="font-bold truncate text-[10px]">${name}</div>${width > 25 ? `<div class="text-xs truncate">${ev.hora_inicio} • ${ev.svc ? ev.svc.nome_servico : 'Serviço'}</div>` : ''}`; slotEl.appendChild(card); }); });
}

async function salvarAgendamentoOtimista(e) { 
    e.preventDefault(); const f = e.target; const nomeCliente = f.nome_cliente.value; const nomeServico = f.nome_servico.value; const dataAg = f.data_agendamento.value; const horaIni = f.hora_inicio.value;
    const cliente = clientesCache.find(c => c.nome === nomeCliente); const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); 
    if(!servico) { mostrarAviso('Serviço não encontrado.'); return; }
    fecharModal('modal-agendamento');
    const tempId = 'temp_' + Date.now(); const profId = (currentUser.nivel === 'admin' && document.getElementById('select-prof-modal').value) ? document.getElementById('select-prof-modal').value : currentUser.id_usuario;
    const novoItem = { id_agendamento: tempId, id_cliente: cliente ? cliente.id_cliente : 'novo', id_servico: servico.id_servico, data_agendamento: dataAg, hora_inicio: horaIni, hora_fim: calcularHoraFim(horaIni, servico.duracao_minutos), status: 'Agendado', nome_cliente: nomeCliente, id_profissional: profId, id_pacote_usado: document.getElementById('check-usar-pacote').checked ? document.getElementById('id-pacote-selecionado').value : '' };
    agendamentosRaw.push(novoItem); saveToCache('agendamentos', agendamentosRaw); atualizarAgendaVisual();
    showSyncIndicator(true);
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createAgendamento', nome_cliente: nomeCliente, id_cliente: novoItem.id_cliente, id_servico: novoItem.id_servico, data_agendamento: dataAg, hora_inicio: horaIni, usar_pacote_id: novoItem.id_pacote_usado, id_profissional: profId }) });
        const data = await res.json();
        if (data.status === 'sucesso' && data.id_agendamento) { const idx = agendamentosRaw.findIndex(a => a.id_agendamento === tempId); if (idx !== -1) { agendamentosRaw[idx].id_agendamento = data.id_agendamento; if (data.id_cliente) agendamentosRaw[idx].id_cliente = data.id_cliente; saveToCache('agendamentos', agendamentosRaw); atualizarAgendaVisual(); const modalIdInput = document.getElementById('id-agendamento-ativo'); if(modalIdInput && modalIdInput.value === tempId) { modalIdInput.value = data.id_agendamento; abrirModalDetalhes(data.id_agendamento); } } }
        showSyncIndicator(false);
    } catch (err) { console.error("Erro ao salvar", err); agendamentosRaw = agendamentosRaw.filter(a => a.id_agendamento !== tempId); saveToCache('agendamentos', agendamentosRaw); atualizarAgendaVisual(); mostrarAviso('Falha ao salvar agendamento. Tente novamente.'); showSyncIndicator(false); } f.reset();
}

function prepararStatus(st, btnEl) { const id = document.getElementById('id-agendamento-ativo').value; const idPacote = document.getElementById('id-pacote-agendamento-ativo').value; const contentBotao = btnEl ? btnEl.innerHTML : '';
    if(String(id).startsWith('temp_')) { if(btnEl) { setLoading(btnEl, true, 'Sincronizando...'); setTimeout(() => { setLoading(btnEl, false, contentBotao); }, 2000); } return; }
    if (st === 'Excluir') { mostrarConfirmacao('Apagar Agendamento', 'Tem certeza? Saldo será devolvido.', () => executarMudancaStatusOtimista(id, st, true)); 
    } else if (st === 'Cancelado') { if(idPacote) { mostrarConfirmacao('Cancelar com Pacote', 'Devolver crédito ao cliente?', () => executarMudancaStatusOtimista(id, st, true), () => executarMudancaStatusOtimista(id, st, false), 'Sim, Devolver', 'Não, Debitar' ); } else { mostrarConfirmacao('Cancelar Agendamento', 'Tem certeza que deseja cancelar?', () => executarMudancaStatusOtimista(id, st, false)); } 
    } else if (st === 'Confirmado') { executarMudancaStatusOtimista(id, st, false); } else { executarMudancaStatusOtimista(id, st, false); } 
}

async function executarMudancaStatusOtimista(id, st, devolver) {
    fecharModal('modal-confirmacao'); fecharModal('modal-detalhes');
    const index = agendamentosRaw.findIndex(a => a.id_agendamento === id); if(index === -1) return; const backup = { ...agendamentosRaw[index] };
    if(st === 'Excluir') { agendamentosRaw.splice(index, 1); } else { agendamentosRaw[index].status = st; } saveToCache('agendamentos', agendamentosRaw); atualizarAgendaVisual();
    showSyncIndicator(true);
    try { const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'updateStatusAgendamento', id_agendamento:id, novo_status:st, devolver_credito: devolver }) }); const data = await res.json(); if (data.status !== 'sucesso') { throw new Error(data.mensagem || 'Erro no servidor'); } if(devolver) setTimeout(carregarPacotes, 1000); showSyncIndicator(false); } catch(e) { console.error("Erro update status", e); if(st === 'Excluir') agendamentosRaw.splice(index, 0, backup); else agendamentosRaw[index] = backup; saveToCache('agendamentos', agendamentosRaw); atualizarAgendaVisual(); mostrarAviso('Erro de conexão. Alteração não salva.'); showSyncIndicator(false); }
}
function calcularHoraFim(inicio, duracao) { const [h, m] = inicio.split(':').map(Number); const fimMin = h * 60 + m + parseInt(duracao); return `${String(Math.floor(fimMin / 60)).padStart(2,'0')}:${String(fimMin % 60).padStart(2,'0')}`; }
function mostrarAviso(msg) { document.getElementById('aviso-msg').innerText = msg; document.getElementById('modal-aviso').classList.add('open'); }
function mostrarConfirmacao(t, m, yesCb, noCb, yesTxt='Sim', noTxt='Cancelar') { document.getElementById('confirm-titulo').innerText = t; document.getElementById('confirm-msg').innerText = m; const oldY = document.getElementById('btn-confirm-yes'); const oldN = document.getElementById('btn-confirm-no'); const newY = oldY.cloneNode(true); const newN = oldN.cloneNode(true); newY.innerText = yesTxt; newN.innerText = noTxt; newY.disabled = false; newN.disabled = false; oldY.parentNode.replaceChild(newY, oldY); oldN.parentNode.replaceChild(newN, oldN); newY.onclick = () => { yesCb(); }; newN.onclick = () => { fecharModal('modal-confirmacao'); if(noCb) noCb(); }; document.getElementById('modal-confirmacao').classList.add('open'); }
function setLoading(btn, l, t) { btn.disabled = l; if (l) { const isDarkBg = btn.classList.contains('btn-primary') || btn.classList.contains('bg-blue-600') || btn.classList.contains('bg-red-600'); const spinnerType = isDarkBg ? 'spinner' : 'spinner spinner-dark'; btn.innerHTML = `<span class="${spinnerType}"></span>`; } else { btn.innerHTML = t; } }

function getCorServico(s) { return s ? (s.cor_hex || s.cor || '#3b82f6') : '#3b82f6'; }
function hexToRgba(hex, a) { if(!hex) return `rgba(59,130,246,${a})`; hex = hex.replace('#',''); return `rgba(${parseInt(hex.substring(0,2),16)},${parseInt(hex.substring(2,4),16)},${parseInt(hex.substring(4,6),16)},${a})`; }
function hexToRgb(hex) { var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? parseInt(r[1],16)+", "+parseInt(r[2],16)+", "+parseInt(r[3],16) : "59,130,246"; }
function atualizarDatalistServicos() { const dl = document.getElementById('lista-servicos-datalist'); if(dl) { dl.innerHTML = ''; servicosCache.forEach(i=>{ const o=document.createElement('option'); o.value=i.nome_servico; dl.appendChild(o); }); } }
function atualizarDatalistClientes() { const dl = document.getElementById('lista-clientes'); if(dl) { dl.innerHTML = ''; clientesCache.forEach(c=>{ const o=document.createElement('option'); o.value=c.nome; dl.appendChild(o); }); } }
function popularSelectsUsuarios() { const selectHeader = document.getElementById('select-profissional-agenda'); selectHeader.innerHTML = ''; const optMe = document.createElement('option'); optMe.value = currentUser.id_usuario; optMe.text = "Minha Agenda"; selectHeader.appendChild(optMe); usuariosCache.forEach(u => { if (u.id_usuario !== currentUser.id_usuario) { const opt = document.createElement('option'); opt.value = u.id_usuario; opt.text = u.nome; selectHeader.appendChild(opt); } }); const selectModal = document.getElementById('select-prof-modal'); selectModal.innerHTML = ''; const optMeModal = document.createElement('option'); optMeModal.value = currentUser.id_usuario; optMeModal.text = currentUser.nome + " (Eu)"; selectModal.appendChild(optMeModal); usuariosCache.forEach(u => { if (u.id_usuario !== currentUser.id_usuario) { const opt = document.createElement('option'); opt.value = u.id_usuario; opt.text = u.nome; selectModal.appendChild(opt); } }); }
function fecharModal(id) { document.getElementById(id).classList.remove('open'); if(id==='modal-agendamento') document.getElementById('area-pacote-info')?.classList.add('hidden'); }
function abrirModalAgendamento(h) { document.getElementById('modal-agendamento').classList.add('open'); document.getElementById('input-data-modal').value = dataAtual.toISOString().split('T')[0]; if(h) document.getElementById('input-hora-modal').value = h; if(currentUser.nivel==='admin'){ document.getElementById('div-select-prof-modal').classList.remove('hidden'); document.getElementById('select-prof-modal').value=currentProfId; } else { document.getElementById('div-select-prof-modal').classList.add('hidden'); } }
function abrirModalCliente() { document.getElementById('modal-cliente').classList.add('open'); }
function abrirModalServico() { document.getElementById('modal-servico').classList.add('open'); }
function abrirModalVenderPacote() { itensPacoteTemp=[]; atualizarListaVisualPacote(); document.getElementById('input-servico-pacote-nome').value=''; document.getElementById('valor-total-pacote').value=''; document.getElementById('modal-vender-pacote').classList.add('open'); }
function abrirModalUsuario() { document.getElementById('modal-usuario').classList.add('open'); }
function abrirModalEditarAgendamento() { const id=document.getElementById('id-agendamento-ativo').value; const ag=agendamentosCache.find(x=>x.id_agendamento===id); if(!ag)return; fecharModal('modal-detalhes'); document.getElementById('edit-agenda-id').value=id; document.getElementById('edit-agenda-cliente').innerText=ag.nome_cliente; const svc=servicosCache.find(s=>String(s.id_servico)===String(ag.id_servico)); document.getElementById('edit-agenda-servico').innerText=svc?svc.nome_servico:'Serviço'; document.getElementById('edit-agenda-data').value=ag.data_agendamento; document.getElementById('edit-agenda-hora').value=ag.hora_inicio; document.getElementById('modal-editar-agendamento').classList.add('open'); }
function abrirModalEditarServico(id) { const s=servicosCache.find(x=>x.id_servico===id); if(!s)return; document.getElementById('edit-id-servico').value=s.id_servico; document.getElementById('edit-nome-servico').value=s.nome_servico; document.getElementById('edit-valor-servico').value=s.valor_unitario; document.getElementById('edit-duracao-servico').value=s.duracao_minutos; document.getElementById('edit-check-online-booking').checked=String(s.agendamento_online)==='true'; document.getElementById('edit-input-cor-selecionada').value=getCorServico(s); renderizarColorPickerEdicao(); document.getElementById('modal-editar-servico').classList.add('open'); }

// --- FUNÇÕES WHATSAPP E MODAL REDESINHADO ---

function abrirModalDetalhes(id) { 
    const ag = agendamentosCache.find(a => a.id_agendamento === id); if(!ag) return; 
    resetarBotoesModal();
    document.getElementById('id-agendamento-ativo').value = id; 
    const idPacote = ag.id_pacote_usado || ag.id_pacote || ''; 
    document.getElementById('id-pacote-agendamento-ativo').value = idPacote;
    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico)); 
    const nomeCliente = ag.nome_cliente || ag.observacoes || 'Cliente'; 
    const isConcluido = ag.status === 'Concluido';
    const isCancelado = ag.status === 'Cancelado';

    // Preenche info
    document.getElementById('detalhe-cliente').innerText = nomeCliente;
    document.getElementById('detalhe-servico').innerText = servico ? servico.nome_servico : 'Serviço';
    document.getElementById('detalhe-data').innerText = formatarDataBr(ag.data_agendamento);
    document.getElementById('detalhe-hora').innerText = `${ag.hora_inicio} - ${ag.hora_fim}`;
    
    const badge = document.getElementById('detalhe-status-badge');
    badge.innerText = ag.status || 'Agendado';
    badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase ';
    
    if(isConcluido) badge.className += 'bg-slate-200 text-slate-600';
    else if(isCancelado) badge.className += 'bg-red-100 text-red-600';
    else if(ag.status === 'Confirmado') badge.className += 'bg-green-100 text-green-700';
    else badge.className += 'bg-blue-100 text-blue-700';

    // Visibilidade botões
    document.getElementById('btn-editar-horario').style.display = isConcluido || isCancelado ? 'none' : 'flex';
    document.getElementById('btn-cancelar').style.display = isConcluido || isCancelado ? 'none' : 'flex';
    document.getElementById('btn-excluir').style.display = isCancelado ? 'block' : 'none';

    const btnConfirmar = document.getElementById('btn-confirmar');
    const nBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nBtn, btnConfirmar);
    nBtn.onclick = () => prepararStatus('Confirmado', nBtn);
    
    if (isConcluido || isCancelado) { 
        nBtn.style.display = 'none'; 
        document.getElementById('btn-concluir').style.display = 'none'; 
    } else { 
        if (ag.status === 'Confirmado') { 
            nBtn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Já Confirmado'; 
            nBtn.className = "w-full p-3 bg-green-50 text-green-700 font-bold rounded-xl text-sm border border-green-200 flex items-center justify-center gap-2 cursor-default"; 
            nBtn.onclick = null; 
            nBtn.disabled = true; 
            nBtn.style.display = 'flex'; 
        } else { 
            nBtn.style.display = 'flex'; 
        } 
        document.getElementById('btn-concluir').style.display = 'flex'; 
    }
    
    document.getElementById('modal-detalhes').classList.add('open'); 
    lucide.createIcons(); 
}

function resetarBotoesModal() {
    // Helper para resetar estados visuais se necessário
    const btnConf = document.getElementById('btn-confirmar');
    btnConf.disabled = false;
    btnConf.className = "w-full p-3 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm border border-blue-100 flex items-center justify-center gap-2 btn-anim";
    btnConf.innerHTML = '<i data-lucide="thumbs-up" class="w-4 h-4"></i> Confirmar Presença';
    
    const btnConc = document.getElementById('btn-concluir');
    btnConc.disabled = false;
}

function getWhatsappCliente(idAgendamento) {
    const ag = agendamentosCache.find(a => a.id_agendamento === idAgendamento);
    if(!ag) return null;
    
    // Tenta achar cliente pelo ID
    let cliente = clientesCache.find(c => String(c.id_cliente) === String(ag.id_cliente));
    
    // Se não achar pelo ID (casos antigos ou manuais), tenta pelo nome
    if(!cliente) {
        cliente = clientesCache.find(c => c.nome === ag.nome_cliente);
    }
    
    if(cliente && cliente.whatsapp) {
        // CORREÇÃO: Força conversão para String antes de replace
        let nums = String(cliente.whatsapp).replace(/\D/g, ''); 
        
        // ADICIONADO: Lógica para garantir o +55
        if (!nums.startsWith('55') && (nums.length === 10 || nums.length === 11)) {
            nums = '55' + nums;
        }
        
        return nums;
    }
    return null;
}

function enviarLembrete() {
    const id = document.getElementById('id-agendamento-ativo').value;
    const ag = agendamentosCache.find(a => a.id_agendamento === id);
    const numero = getWhatsappCliente(id);
    
    if(!numero) { mostrarAviso('Cliente sem WhatsApp cadastrado.'); return; }
    
    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico));
    const nomeServico = servico ? servico.nome_servico : 'seu horário';
    
    let texto = config.mensagem_lembrete || "Olá {cliente}, seu agendamento é dia {data} às {hora}.";
    
    texto = texto.replace('{cliente}', ag.nome_cliente)
                 .replace('{data}', formatarDataBr(ag.data_agendamento))
                 .replace('{hora}', ag.hora_inicio)
                 .replace('{servico}', nomeServico);
    
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
}

function abrirSelecaoMsgRapida() {
    const id = document.getElementById('id-agendamento-ativo').value;
    const numero = getWhatsappCliente(id);
    if(!numero) { mostrarAviso('Cliente sem WhatsApp cadastrado.'); return; }

    const lista = document.getElementById('lista-selecao-msg');
    lista.innerHTML = '';
    
    if(!config.mensagens_rapidas || config.mensagens_rapidas.length === 0) {
        lista.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Nenhuma mensagem cadastrada em Configurações.</p>';
    } else {
        config.mensagens_rapidas.forEach(msg => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 text-sm text-slate-700 transition-colors';
            btn.innerText = msg;
            btn.onclick = () => {
                window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
                fecharModal('modal-selecao-msg');
            };
            lista.appendChild(btn);
        });
    }
    document.getElementById('modal-selecao-msg').classList.add('open');
}

function abrirChatDireto() {
    const id = document.getElementById('id-agendamento-ativo').value;
    const numero = getWhatsappCliente(id);
    if(!numero) { mostrarAviso('Cliente sem WhatsApp cadastrado.'); return; }
    window.open(`https://wa.me/${numero}`, '_blank');
}

// --- GERENCIAMENTO DE CONFIGURAÇÕES UI ---

function atualizarUIConfig() {
    document.getElementById('cfg-abertura').value = config.abertura;
    document.getElementById('cfg-fechamento').value = config.fechamento;
    document.getElementById('cfg-intervalo').value = config.intervalo_minutos;
    document.getElementById('cfg-concorrencia').checked = config.permite_encaixe;
    
    // Mensagens
    document.getElementById('cfg-lembrete-template').value = config.mensagem_lembrete || "Olá {cliente}, seu agendamento é dia {data} às {hora}.";
    renderizarListaMsgRapidasConfig();
}

function renderizarListaMsgRapidasConfig() {
    const div = document.getElementById('lista-msg-rapidas');
    div.innerHTML = '';
    if(!config.mensagens_rapidas) config.mensagens_rapidas = [];
    
    config.mensagens_rapidas.forEach((msg, idx) => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200';
        item.innerHTML = `
            <span class="text-xs text-slate-600 truncate flex-1 mr-2">${msg}</span>
            <button onclick="removerMsgRapida(${idx})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
        div.appendChild(item);
    });
    lucide.createIcons();
}

function adicionarMsgRapida() {
    const input = document.getElementById('nova-msg-rapida');
    const val = input.value.trim();
    if(!val) return;
    if(!config.mensagens_rapidas) config.mensagens_rapidas = [];
    config.mensagens_rapidas.push(val);
    input.value = '';
    renderizarListaMsgRapidasConfig();
}

function removerMsgRapida(idx) {
    config.mensagens_rapidas.splice(idx, 1);
    renderizarListaMsgRapidasConfig();
}

async function salvarConfigAPI(btn) { 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    
    const abertura = document.getElementById('cfg-abertura').value; 
    const fechamento = document.getElementById('cfg-fechamento').value; 
    const intervalo = document.getElementById('cfg-intervalo').value; 
    const encaixe = document.getElementById('cfg-concorrencia').checked; 
    
    // Novos campos
    const msgLembrete = document.getElementById('cfg-lembrete-template').value;
    const msgsRapidas = config.mensagens_rapidas;

    try { 
        await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action: 'saveConfig', 
            abertura: abertura, 
            fechamento: fechamento, 
            intervalo_minutos: intervalo, 
            permite_encaixe: encaixe,
            mensagem_lembrete: msgLembrete,
            mensagens_rapidas: msgsRapidas
        })}); 
        
        config.abertura = abertura;
        config.fechamento = fechamento;
        config.intervalo_minutos = parseInt(intervalo);
        config.permite_encaixe = encaixe;
        config.mensagem_lembrete = msgLembrete;
        
        // Atualiza cache e grade
        saveToCache('config', config);
        renderizarGrade(); 
        mostrarAviso('Configurações salvas!'); 
    } catch(e) { 
        mostrarAviso('Erro ao salvar.'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

// Restante das funções de UI e Helpers mantidas...
async function salvarVendaPacote(e) { e.preventDefault(); const btn=document.getElementById('btn-salvar-pacote'); const originalText = btn.innerText; setLoading(btn, true, originalText); const f=e.target; if (itensPacoteTemp.length === 0) { mostrarAviso('Adicione serviços.'); setLoading(btn, false, originalText); return; } const cliente = clientesCache.find(c => c.nome === f.nome_cliente.value); if(!cliente) { mostrarAviso('Cliente inválido.'); setLoading(btn, false, originalText); return; } try { await fetch(API_URL, {method:'POST', body:JSON.stringify({ action:'createPacote', id_cliente: cliente.id_cliente, nome_cliente: cliente.nome, itens: itensPacoteTemp, valor_total: f.valor_total.value, validade: f.validade.value })}); fecharModal('modal-vender-pacote'); f.reset(); mostrarAviso('Pacote vendido!'); setTimeout(() => { carregarPacotes(); }, 1500); } catch(e) { mostrarAviso('Erro'); } finally { setLoading(btn, false, originalText); } }
async function salvarUsuario(e) { e.preventDefault(); const btn = document.getElementById('btn-salvar-usuario'); setLoading(btn, true, 'Salvar'); const f = e.target; try { await fetch(API_URL, {method:'POST', body:JSON.stringify({ action: 'createUsuario', nome: f.nome.value, email: f.email.value, senha: f.senha.value, nivel: f.nivel.value, cor: '#3b82f6' })}); fecharModal('modal-usuario'); f.reset(); carregarUsuarios(); mostrarAviso('Profissional adicionado!'); } catch(e) { mostrarAviso('Erro'); } finally { setLoading(btn, false, 'Salvar'); } }
async function salvarEdicaoAgendamento(e) { e.preventDefault(); const btn = document.getElementById('btn-salvar-edicao-agenda'); const originalText = btn.innerText; setLoading(btn, true, originalText); const id = document.getElementById('edit-agenda-id').value; const novaData = document.getElementById('edit-agenda-data').value; const novoHorario = document.getElementById('edit-agenda-hora').value; try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateAgendamentoDataHora', id_agendamento: id, data_agendamento: novaData, hora_inicio: novoHorario }) }); fecharModal('modal-editar-agendamento'); recarregarAgendaComFiltro(); mostrarAviso('Agendamento atualizado!'); } catch(err) { mostrarAviso('Erro.'); } finally { setLoading(btn, false, originalText); } }
async function salvarNovoServico(e) { e.preventDefault(); const btn = document.getElementById('btn-salvar-servico'); const originalText = btn.innerText; setLoading(btn, true, originalText); const f = e.target; const fileInput = document.getElementById('input-imagem-servico'); let imagemUrl = ''; if (fileInput.files.length > 0) { btn.innerHTML = '<span class="spinner"></span> Enviando img...'; try { const formData = new FormData(); formData.append('image', fileInput.files[0]); const imgReq = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData }); const imgRes = await imgReq.json(); if (imgRes.success) { imagemUrl = imgRes.data.url; } } catch (err) { console.error(err); } } try { await fetch(API_URL,{method:'POST',body:JSON.stringify({action:'createServico', nome_servico:f.nome_servico.value, valor_unitario:f.valor_unitario.value, duracao_minutos:f.duracao_minutos.value, cor_hex:document.getElementById('input-cor-selecionada').value, imagem_url: imagemUrl, online_booking: document.getElementById('check-online-booking').checked })}); fecharModal('modal-servico'); f.reset(); carregarServicos(); } catch(e){ mostrarAviso('Erro'); } finally { setLoading(btn, false, originalText); } }
async function salvarEdicaoServico(e) { e.preventDefault(); const btn = document.getElementById('btn-salvar-edicao-servico'); const originalText = btn.innerText; setLoading(btn, true, originalText); const f = e.target; const fileInput = document.getElementById('edit-input-imagem-servico'); let imagemUrl = ''; if (fileInput.files.length > 0) { btn.innerHTML = '<span class="spinner"></span> Enviando img...'; try { const formData = new FormData(); formData.append('image', fileInput.files[0]); const imgReq = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData }); const imgRes = await imgReq.json(); if (imgRes.success) { imagemUrl = imgRes.data.url; } } catch (err) { console.error(err); } } try { await fetch(API_URL, {method:'POST', body:JSON.stringify({ action: 'updateServico', id_servico: f.id_servico.value, nome_servico: f.nome_servico.value, valor_unitario: f.valor_unitario.value, duracao_minutos: f.duracao_minutos.value, cor_hex: f.cor_hex.value, online_booking: document.getElementById('edit-check-online-booking').checked, imagem_url: imagemUrl })}); fecharModal('modal-editar-servico'); carregarServicos(); } catch(e) { mostrarAviso('Erro'); } finally { setLoading(btn, false, originalText); } }
function renderizarListaServicos() { const container = document.getElementById('lista-servicos'); container.innerHTML = ''; servicosCache.forEach(s => { const div = document.createElement('div'); div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center'; div.innerHTML = `<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background-color: ${getCorServico(s)}">${s.nome_servico.charAt(0)}</div><div><h4 class="font-bold text-slate-800">${s.nome_servico}</h4><p class="text-xs text-slate-500">${s.duracao_minutos} min • R$ ${parseFloat(s.valor_unitario).toFixed(2)}</p></div></div><button onclick="abrirModalEditarServico('${s.id_servico}')" class="text-slate-400 hover:text-blue-600"><i data-lucide="edit-2" class="w-5 h-5"></i></button>`; container.appendChild(div); }); lucide.createIcons(); }
function renderizarListaPacotes() { const container = document.getElementById('lista-pacotes'); container.innerHTML = ''; if(!pacotesCache || pacotesCache.length === 0) { container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum pacote ativo.</div>'; return; } pacotesCache.forEach(p => { const div = document.createElement('div'); div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100'; div.innerHTML = `<div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-slate-800">${p.nome_cliente}</h4><p class="text-xs text-slate-500">${p.nome_servico}</p></div><span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">${p.qtd_restante}/${p.qtd_total}</span></div><div class="w-full bg-slate-100 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full" style="width: ${(p.qtd_restante/p.qtd_total)*100}%"></div></div>`; container.appendChild(div); }); }
function carregarServicos() { fetch(`${API_URL}?action=getServicos`).then(r=>r.json()).then(d=>{ servicosCache=d; renderizarListaServicos(); atualizarDatalistServicos(); }); }
function carregarPacotes() { fetch(`${API_URL}?action=getPacotes`).then(r=>r.json()).then(d=>{ pacotesCache=d; renderizarListaPacotes(); }); }
function carregarUsuarios() { fetch(`${API_URL}?action=getUsuarios`).then(r=>r.json()).then(d=>{ usuariosCache=d; renderizarListaUsuarios(); popularSelectsUsuarios(); }); }
function adicionarItemAoPacote() { const nomeServico = document.getElementById('input-servico-pacote-nome').value; const qtdInput = document.getElementById('qtd-servico-pacote'); const qtd = parseInt(qtdInput.value); if(!nomeServico || qtd < 1) return; const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); if(!servico) { mostrarAviso('Serviço não encontrado na lista.'); return; } const subtotal = (parseFloat(servico.valor_unitario || 0) * qtd); itensPacoteTemp.push({ id_servico: servico.id_servico, nome_servico: servico.nome_servico, valor_unitario: servico.valor_unitario, qtd: qtd, subtotal: subtotal }); atualizarListaVisualPacote(); atualizarTotalSugerido(); document.getElementById('input-servico-pacote-nome').value = ""; qtdInput.value = "1"; }
function atualizarListaVisualPacote() { const container = document.getElementById('lista-itens-pacote'); container.innerHTML = ''; if(itensPacoteTemp.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Nenhum item adicionado.</p>'; return; } itensPacoteTemp.forEach((item, index) => { const div = document.createElement('div'); div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-sm'; const subtotalFmt = item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); div.innerHTML = ` <div class="flex-1"> <div class="flex justify-between items-center"> <span class="font-medium text-slate-700">${item.qtd}x ${item.nome_servico}</span> <span class="text-xs text-slate-500 font-medium ml-2">= ${subtotalFmt}</span> </div> </div> <button type="button" onclick="removerItemPacote(${index})" class="ml-3 text-red-400 hover:text-red-600 btn-anim"><i data-lucide="trash-2" class="w-4 h-4"></i></button> `; container.appendChild(div); }); lucide.createIcons(); }
function removerItemPacote(index) { itensPacoteTemp.splice(index, 1); atualizarListaVisualPacote(); atualizarTotalSugerido(); }
function atualizarTotalSugerido() { const total = itensPacoteTemp.reduce((acc, item) => acc + item.subtotal, 0); document.getElementById('valor-total-pacote').value = total.toFixed(2); }
function verificarPacoteDisponivel() { const nomeCliente = document.getElementById('input-cliente-nome').value; const nomeServico = document.getElementById('input-servico-nome').value; const areaInfo = document.getElementById('area-pacote-info'); const checkbox = document.getElementById('check-usar-pacote'); const inputIdPacote = document.getElementById('id-pacote-selecionado'); areaInfo.classList.add('hidden'); inputIdPacote.value = ''; checkbox.checked = false; if(!nomeCliente || !nomeServico) return; const cliente = clientesCache.find(c => c.nome.toLowerCase() === nomeCliente.toLowerCase()); const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); if(!cliente || !servico) return; const pacote = pacotesCache.find(p => String(p.id_cliente) === String(cliente.id_cliente) && String(p.id_servico) === String(servico.id_servico) && parseInt(p.qtd_restante) > 0); if(pacote) { areaInfo.classList.remove('hidden'); areaInfo.classList.add('flex'); document.getElementById('pacote-saldo').innerText = pacote.qtd_restante; inputIdPacote.value = pacote.id_pacote; checkbox.checked = true; } }
async function salvarNovoCliente(e) { e.preventDefault(); const btn = document.getElementById('btn-salvar-cliente'); setLoading(btn, true, 'Salvar'); const f = e.target; try { const res = await fetch(API_URL, {method:'POST', body:JSON.stringify({ action: 'createCliente', nome: f.nome.value, whatsapp: f.whatsapp.value, email: f.email.value })}); const data = await res.json(); if(data.status === 'sucesso') { clientesCache.push({ id_cliente: data.id_cliente, nome: data.nome, whatsapp: f.whatsapp.value }); atualizarDatalistClientes(); document.getElementById('input-cliente-nome').value = data.nome; fecharModal('modal-cliente'); f.reset(); mostrarAviso('Cliente cadastrado!'); } else { mostrarAviso('Erro ao cadastrar.'); } } catch(e) { mostrarAviso('Erro de conexão.'); } finally { setLoading(btn, false, 'Salvar'); } }
function abrirDetalhesPacote(grupo) { const modal = document.getElementById('modal-detalhes-pacote'); const divSaldos = document.getElementById('tab-modal-saldos'); const divHist = document.getElementById('tab-modal-historico'); divSaldos.innerHTML = ''; divHist.innerHTML = ''; const idsPacotesDoGrupo = grupo.itens.map(i => String(i.id_pacote)); grupo.itens.forEach(item => { const servico = servicosCache.find(s => String(s.id_servico) === String(item.id_servico)); const nome = servico ? servico.nome_servico : 'Serviço'; const percent = (item.qtd_restante / item.qtd_total) * 100; divSaldos.innerHTML += `<div class="mb-2"><div class="flex justify-between text-sm mb-1"><span class="text-slate-700 font-medium">${nome}</span><span class="text-blue-600 font-bold">${item.qtd_restante}/${item.qtd_total}</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width: ${percent}%"></div></div></div>`; }); const historico = agendamentosCache.filter(ag => { const idUsado = String(ag.id_pacote_usado || ag.id_pacote || ''); return idsPacotesDoGrupo.includes(idUsado); }); if (historico.length === 0) { divHist.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Nenhum uso registrado hoje.</p>'; } else { historico.forEach(h => { const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico)); const nomeServico = servico ? servico.nome_servico : 'Serviço'; const statusClass = h.status === 'Concluido' ? 'text-green-600' : (h.status === 'Cancelado' ? 'text-red-400 line-through' : 'text-blue-600'); divHist.innerHTML += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-sm"><div><p class="font-bold text-slate-700">${formatarDataBr(h.data_agendamento)} <span class="font-normal text-xs text-slate-400">${h.hora_inicio}</span></p><p class="text-xs text-slate-500">${nomeServico}</p></div><span class="text-xs font-bold uppercase ${statusClass}">${h.status}</span></div>`; }); } modal.classList.add('open'); }