const API_URL = 'https://script.google.com/macros/s/AKfycbxgSkDYPhTJerGbFsubJE9b_xuwCM6KnAtWh5gFF3WEIEGFWf-SIHd_iWUH3J4JitWUHA/exec';
const PALETA_CORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const IMGBB_API_KEY = 'fa0265b3bfc740c1eb09a7e4d6ec493a';
const CACHE_KEY_PREFIX = 'minhaAgenda_';

// --- ESTADO GLOBAL ---
let currentUser = null;
let currentProfId = null;
let dataAtual = new Date(); // Data selecionada (foco)
let servicosCache = [];
let agendamentosCache = [];
let clientesCache = [];
let pacotesCache = [];
let usuariosCache = [];
let itensPacoteTemp = [];
let pacoteSelecionado = null; // Armazena o pacote aberto no modal
let abaAtiva = 'agenda';
let abaPacotesAtiva = 'ativos'; // 'ativos' ou 'historico'

let config = { 
    abertura: '08:00', 
    fechamento: '19:00', 
    intervalo_minutos: 60, 
    permite_encaixe: false,
    mensagem_lembrete: "Olá {cliente}, seu agendamento é dia {data} às {hora}.",
    mensagens_rapidas: [],
    horarios_semanais: [] 
};
let agendamentosRaw = [];
let isSyncing = false;
let isSaving = false; // Flag para bloquear updates durante salvamento
let pollingInterval = null;

// --- CACHE LOCAL ---
function saveToCache(key, data) {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(data));
}

function getFromCache(key) {
    const data = localStorage.getItem(CACHE_KEY_PREFIX + key);
    return data ? JSON.parse(data) : null;
}

// --- NAVEGAÇÃO E TABS ---
function switchTab(t, el) { 
    abaAtiva = t; 
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); 
    el.classList.add('active'); 
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    document.getElementById(`tab-${t}`).classList.add('active'); 
    document.getElementById('main-fab').style.display = t === 'config' ? 'none' : 'flex'; 
    if (t === 'pacotes') {
        mudarAbaPacotes('ativos'); // Reset para ativos ao abrir
        carregarPacotes(); 
    }
    if (t === 'config') atualizarUIConfig();
}

function switchConfigTab(tab) {
    document.getElementById('cfg-area-geral').classList.add('hidden');
    document.getElementById('cfg-area-msg').classList.add('hidden');
    document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-slate-400';

    if (tab === 'geral') {
        document.getElementById('cfg-area-geral').classList.remove('hidden');
        document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    } else {
        document.getElementById('cfg-area-msg').classList.remove('hidden');
        document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    }
}

function switchModalTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    document.getElementById(`tab-modal-${tab}`).classList.add('active');
}

function acaoFab() { 
    if (abaAtiva === 'servicos') abrirModalServico(); 
    else if (abaAtiva === 'agenda') abrirModalAgendamento(); 
    else if (abaAtiva === 'pacotes') abrirModalVenderPacote(); 
    else if (abaAtiva === 'equipa') abrirModalUsuario(); 
}

// --- LÓGICA DE CALENDÁRIO SEMANAL ---

function mudarSemana(direcao) {
    // Avança ou recua 7 dias na data selecionada
    dataAtual.setDate(dataAtual.getDate() + (direcao * 7));
    atualizarDataEPainel();
}

function irParaHoje() {
    dataAtual = new Date();
    atualizarDataEPainel();
}

function selecionarDia(dataIso) {
    const parts = dataIso.split('-');
    // Mês em JS começa em 0
    dataAtual = new Date(parts[0], parts[1] - 1, parts[2]);
    atualizarDataEPainel();
}

function atualizarDataEPainel() {
    // Atualiza Título do Mês (Ex: Janeiro 2024)
    const options = { month: 'long', year: 'numeric' };
    const title = dataAtual.toLocaleDateString('pt-PT', options);
    const titleEl = document.getElementById('current-month-year');
    if (titleEl) titleEl.innerText = title.charAt(0).toUpperCase() + title.slice(1);

    renderizarSemana();
    atualizarAgendaVisual();
}

function renderizarSemana() {
    const strip = document.getElementById('week-strip');
    if (!strip) return;
    
    strip.innerHTML = '';

    // Calcular o Domingo da semana atual da 'dataAtual'
    const startOfWeek = new Date(dataAtual);
    const day = startOfWeek.getDay(); // 0 (Dom) a 6 (Sáb)
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff); // Define para o domingo

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < 7; i++) {
        const loopDate = new Date(startOfWeek);
        loopDate.setDate(startOfWeek.getDate() + i);
        
        const isoDate = loopDate.toISOString().split('T')[0];
        const isSelected = loopDate.toDateString() === dataAtual.toDateString();
        
        const div = document.createElement('div');
        div.className = `day-column ${isSelected ? 'selected' : ''}`;
        div.onclick = () => selecionarDia(isoDate);
        
        div.innerHTML = `
            <span class="day-name">${diasSemana[i]}</span>
            <span class="day-number">${loopDate.getDate()}</span>
        `;
        
        strip.appendChild(div);
    }
}

// --- COLOR PICKERS ---

function renderizarColorPicker() { 
    const c = document.getElementById('color-picker-container'); 
    c.innerHTML = ''; 
    PALETA_CORES.forEach((cor, i) => {
        const d = document.createElement('div');
        d.className = `color-option ${i === 4 ? 'selected' : ''}`;
        d.style.backgroundColor = cor;
        d.onclick = () => {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('input-cor-selecionada').value = cor;
        };
        c.appendChild(d);
    });
}

function renderizarColorPickerEdicao() { 
    const c = document.getElementById('edit-color-picker-container'); 
    c.innerHTML = ''; 
    PALETA_CORES.forEach((cor, i) => {
        const d = document.createElement('div');
        d.className = `color-option ${i === 4 ? 'selected' : ''}`;
        d.style.backgroundColor = cor;
        d.onclick = () => {
            document.querySelectorAll('#edit-color-picker-container .color-option').forEach(el => el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('edit-input-cor-selecionada').value = cor;
        };
        c.appendChild(d);
    });
}

// --- HELPERS E FORMATADORES ---

function formatarDataBr(s) { 
    if (!s) return ''; 
    if (s.includes('T')) return new Date(s).toLocaleDateString('pt-BR'); 
    return s.split('-').reverse().join('/'); 
}

function excluirServicoViaModal() { 
    const id = document.getElementById('edit-id-servico').value; 
    mostrarConfirmacao('Excluir Serviço', 'Tem certeza?', async () => { 
        try { 
            await fetch(API_URL, {method: 'POST', body: JSON.stringify({action: 'deleteServico', id_servico: id})}); 
            fecharModal('modal-confirmacao'); 
            fecharModal('modal-editar-servico'); 
            carregarServicos(); 
        } catch (e) { 
            mostrarAviso('Erro'); 
        } 
    }); 
}

function mudarProfissionalAgenda() { 
    currentProfId = document.getElementById('select-profissional-agenda').value; 
    atualizarAgendaVisual(); 
}

function renderizarListaUsuarios() { 
    const container = document.getElementById('lista-usuarios'); 
    container.innerHTML = ''; 
    usuariosCache.forEach(u => { 
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">${u.nome.charAt(0)}</div>
                    <div>
                        <h4 class="font-bold text-slate-800">${u.nome}</h4>
                        <p class="text-xs text-slate-400 capitalize">${u.nivel}</p>
                    </div>
                </div>
            </div>`; 
    }); 
}

// --- INICIALIZAÇÃO ---

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if (savedUser) { 
        currentUser = JSON.parse(savedUser); 
        iniciarApp(); 
    }
    
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal(overlay.id);
            }
        });
    });

    window.addEventListener('beforeunload', function (e) {
        if (isSyncing || isSaving) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// --- AUTENTICAÇÃO E CORE ---

async function fazerLogin(e) {
    e.preventDefault(); 
    const btn = document.getElementById('btn-login'); 
    setLoading(btn, true, 'Entrar'); 
    const email = document.getElementById('login-email').value; 
    const senha = document.getElementById('login-senha').value; 
    const manter = document.getElementById('login-manter').checked;
    
    try { 
        const r = await fetch(`${API_URL}?action=login&email=${email}&senha=${senha}`); 
        const res = await r.json(); 
        if (res.status === 'sucesso') { 
            currentUser = res.usuario; 
            if (manter) localStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser)); 
            else sessionStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser)); 
            iniciarApp(); 
        } else { 
            mostrarAviso(res.mensagem); 
            setLoading(btn, false, 'Entrar'); 
        } 
    } catch (err) { 
        mostrarAviso('Erro de conexão'); 
        setLoading(btn, false, 'Entrar'); 
    }
}

function logout() { 
    localStorage.removeItem('minhaAgendaUser'); 
    sessionStorage.removeItem('minhaAgendaUser'); 
    if (pollingInterval) clearInterval(pollingInterval); 
    location.reload(); 
}

function iniciarApp() {
    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('app-header').classList.remove('hidden'); 
    document.getElementById('app-header').classList.add('flex'); 
    document.getElementById('bottom-nav').classList.remove('hidden'); 
    document.getElementById('bottom-nav').classList.add('flex'); 
    document.getElementById('main-fab').classList.remove('hidden'); 
    document.getElementById('main-fab').classList.add('flex'); 
    document.getElementById('user-name-display').innerText = `Olá, ${currentUser.nome}`; 
    document.getElementById('tab-agenda').classList.add('active');
    
    currentProfId = String(currentUser.id_usuario); 
    if (currentUser.nivel !== 'admin') { 
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); 
    } else { 
        document.getElementById('select-profissional-agenda').classList.remove('hidden'); 
    }
    
    renderizarColorPicker(); 
    renderizarColorPickerEdicao(); 
    carregarDoCache(); 
    sincronizarDadosAPI(); 
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    if (cachedServicos) { servicosCache = cachedServicos; renderizarListaServicos(); atualizarDatalistServicos(); }
    if (cachedConfig) { config = cachedConfig; atualizarUIConfig(); }
    if (cachedUsuarios) { usuariosCache = cachedUsuarios; popularSelectsUsuarios(); renderizarListaUsuarios(); }
    if (cachedAgendamentos) { agendamentosRaw = cachedAgendamentos; }
    if (cachedClientes) { clientesCache = cachedClientes; atualizarDatalistClientes(); }
    if (cachedPacotes) { pacotesCache = cachedPacotes; }
    
    atualizarDataEPainel();
}

async function sincronizarDadosAPI() {
    const hasData = document.querySelectorAll('.time-slot').length > 0; 
    const container = document.getElementById('agenda-timeline'); 
    
    if (!hasData && agendamentosRaw.length === 0) { 
        container.innerHTML = '<div class="p-10 text-center text-slate-400"><div class="spinner spinner-dark mx-auto mb-2 border-slate-300 border-t-blue-500"></div><p>A carregar agenda...</p></div>'; 
    } else { 
        showSyncIndicator(true); 
    }
    
    try {
        const fetchSafe = async (action) => { 
            try { 
                const r = await fetch(`${API_URL}?action=${action}`); 
                return await r.json(); 
            } catch (e) { 
                console.error(`Erro ${action}`, e); 
                return []; 
            } 
        };
        
        const [resConfig, resServicos, resClientes, resPacotes, resAgendamentos, resUsuarios] = await Promise.all([ 
            fetchSafe('getConfig'), 
            fetchSafe('getServicos'), 
            fetchSafe('getClientes'), 
            fetchSafe('getPacotes'), 
            fetchSafe('getAgendamentos'), 
            currentUser.nivel === 'admin' ? fetchSafe('getUsuarios') : Promise.resolve([]) 
        ]);
        
        if (resConfig) { 
            config = resConfig; 
            if (!config.horarios_semanais) config.horarios_semanais = []; 
            saveToCache('config', config); 
            atualizarUIConfig(); 
        }
        
        servicosCache = Array.isArray(resServicos) ? resServicos : []; saveToCache('servicos', servicosCache);
        clientesCache = Array.isArray(resClientes) ? resClientes : []; saveToCache('clientes', clientesCache);
        pacotesCache = Array.isArray(resPacotes) ? resPacotes : []; saveToCache('pacotes', pacotesCache);
        agendamentosRaw = Array.isArray(resAgendamentos) ? resAgendamentos : []; saveToCache('agendamentos', agendamentosRaw);
        usuariosCache = Array.isArray(resUsuarios) ? resUsuarios : []; if (usuariosCache.length > 0) saveToCache('usuarios', usuariosCache);
        
        atualizarDataEPainel(); 
        atualizarDatalistServicos(); 
        atualizarDatalistClientes(); 
        renderizarListaServicos(); 
        if (currentUser.nivel === 'admin') { 
            renderizarListaPacotes(); 
            renderizarListaUsuarios(); 
            popularSelectsUsuarios(); 
        }
        
        atualizarAgendaVisual(); 
        showSyncIndicator(false);
    } catch (error) { 
        console.error("Erro sincronização", error); 
        if (!hasData) container.innerHTML = '<p class="text-center text-red-400 text-sm">Erro de conexão.</p>'; 
        showSyncIndicator(false); 
    }
}

function atualizarAgendaVisual() {
    if (!agendamentosRaw) return; 
    const filtroId = String(currentProfId);
    agendamentosCache = agendamentosRaw.filter(a => { 
        const aId = a.id_profissional ? String(a.id_profissional) : ''; 
        if (currentUser.nivel === 'admin') { 
            return aId === filtroId; 
        } else { 
            return aId === String(currentUser.id_usuario); 
        } 
    });
    renderizarGrade();
}

function recarregarAgendaComFiltro(silencioso = false) {
    if (isSaving) return;

    if (!silencioso) showSyncIndicator(true);
    const modalIdInput = document.getElementById('id-agendamento-ativo'); 
    const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null; 
    let tempItem = null; 
    if (activeTempId) { tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId); }
    
    const currentTemps = agendamentosRaw.filter(a => String(a.id_agendamento).startsWith('temp_'));

    fetch(`${API_URL}?action=getAgendamentos`).then(r => r.json()).then(dados => {
        let novosAgendamentos = Array.isArray(dados) ? dados : [];
        if (activeTempId && tempItem) {
            const realItem = novosAgendamentos.find(a => a.data_agendamento === tempItem.data_agendamento && a.hora_inicio === tempItem.hora_inicio && (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) );
            if (realItem) { 
                const idxLocal = agendamentosRaw.findIndex(a => a.id_agendamento === activeTempId); 
                if (idxLocal !== -1) { agendamentosRaw[idxLocal] = realItem; }
                modalIdInput.value = realItem.id_agendamento; 
                abrirModalDetalhes(realItem.id_agendamento); 
            }
        }
        
        novosAgendamentos = [...novosAgendamentos, ...currentTemps];
        agendamentosRaw = novosAgendamentos; 
        saveToCache('agendamentos', agendamentosRaw); 
        atualizarAgendaVisual(); 
        showSyncIndicator(false);
    }).catch((e) => { 
        console.error(e); 
        showSyncIndicator(false); 
    });
}

function showSyncIndicator(show) { 
    isSyncing = show; 
    document.getElementById('sync-indicator').style.display = show ? 'flex' : 'none'; 
}

function renderizarGrade() {
    const container = document.getElementById('agenda-timeline'); 
    if (!container) return; 
    container.innerHTML = '';
    
    // Lógica Semanal
    const diaDaSemana = dataAtual.getDay();
    let configDia = null;
    
    if (config.horarios_semanais && Array.isArray(config.horarios_semanais)) {
        configDia = config.horarios_semanais.find(h => parseInt(h.dia) === diaDaSemana);
    }
    
    if (!configDia || !configDia.ativo) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-slate-300"><i data-lucide="moon" class="w-12 h-12 mb-2"></i><p class="font-bold text-lg">Fechado</p><p class="text-xs">Não há atendimento neste dia.</p></div>`;
        lucide.createIcons();
        return;
    }
    
    const abertura = configDia.inicio || '08:00'; 
    const fechamento = configDia.fim || '19:00';
    const [hA, mA] = abertura.split(':').map(Number); 
    const [hF, mF] = fechamento.split(':').map(Number); 
    
    const startMin = hA * 60 + mA; 
    const endMin = hF * 60 + mF; 
    const interval = parseInt(config.intervalo_minutos) || 60; 
    const dateIso = dataAtual.toISOString().split('T')[0];
    
    for (let m = startMin; m < endMin; m += interval) { 
        const hSlot = Math.floor(m / 60); 
        const mSlot = m % 60; 
        const timeStr = `${String(hSlot).padStart(2, '0')}:${String(mSlot).padStart(2, '0')}`; 
        
        const div = document.createElement('div'); 
        div.className = 'time-slot'; 
        div.style.height = '80px'; 
        div.innerHTML = `<div class="time-label">${timeStr}</div><div class="slot-content" id="slot-${m}"><div class="slot-livre-area" onclick="abrirModalAgendamento('${timeStr}')"></div></div>`; 
        container.appendChild(div); 
    }
    
    const events = agendamentosCache.filter(a => a.data_agendamento === dateIso && a.hora_inicio).map(a => { 
        const [h, m] = a.hora_inicio.split(':').map(Number); 
        const start = h * 60 + m; 
        const svc = servicosCache.find(s => String(s.id_servico) === String(a.id_servico)); 
        const dur = svc ? parseInt(svc.duracao_minutos) : 60; 
        return { ...a, start, end: start + dur, dur, svc }; 
    }).sort((a, b) => a.start - b.start);
    
    let groups = []; 
    let lastEnd = -1; 
    events.forEach(ev => { 
        if (ev.start >= lastEnd) { 
            groups.push([ev]); 
            lastEnd = ev.end; 
        } else { 
            groups[groups.length - 1].push(ev); 
            if (ev.end > lastEnd) lastEnd = ev.end; 
        } 
    });
    
    groups.forEach(group => { 
        const width = 100 / group.length; 
        group.forEach((ev, idx) => { 
            if (ev.start < startMin || ev.start >= endMin) return; 
            
            const offset = (ev.start - startMin) % interval; 
            const slotBase = ev.start - offset; 
            const slotEl = document.getElementById(`slot-${slotBase}`); 
            
            if (!slotEl) return; 
            
            const height = (ev.dur / interval) * 80; 
            const top = (offset / interval) * 80; 
            const left = idx * width; 
            
            const card = document.createElement('div'); 
            card.className = 'event-card'; 
            card.style.top = `${top + 2}px`; 
            card.style.height = `calc(${height}px - 4px)`; 
            card.style.left = `calc(${left}% + 2px)`; 
            card.style.width = `calc(${width}% - 4px)`; 
            
            const color = getCorServico(ev.svc); 
            card.style.backgroundColor = hexToRgba(color, 0.15); 
            card.style.borderLeftColor = color; 
            card.style.color = '#1e293b'; 
            
            let statusIcon = ''; 
            if (ev.status === 'Confirmado') { 
                statusIcon = '<div class="absolute top-1 right-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>'; 
                card.classList.add('status-confirmado'); 
            } else if (ev.status === 'Concluido') { 
                card.classList.add('status-concluido'); 
            } else if (ev.status === 'Cancelado') { 
                card.classList.add('status-cancelado'); 
            } else { 
                card.style.borderLeftColor = color; 
            } 
            
            card.onclick = (e) => { 
                e.stopPropagation(); 
                abrirModalDetalhes(ev.id_agendamento); 
            }; 
            
            const name = ev.nome_cliente || ev.observacoes || 'Cliente'; 
            card.innerHTML = `${statusIcon}<div style="width:90%" class="font-bold truncate text-[10px]">${name}</div>${width > 25 ? `<div class="text-xs truncate">${ev.hora_inicio} • ${ev.svc ? ev.svc.nome_servico : 'Serviço'}</div>` : ''}`; 
            slotEl.appendChild(card); 
        }); 
    });
}

// --- FUNÇÕES DE AGENDAMENTO (OTIMISTA) ---

async function salvarAgendamentoOtimista(e) { 
    e.preventDefault(); 
    const f = e.target; 
    const nomeCliente = f.nome_cliente.value; 
    const nomeServico = f.nome_servico.value; 
    const dataAg = f.data_agendamento.value; 
    const horaIni = f.hora_inicio.value;
    
    const cliente = clientesCache.find(c => c.nome === nomeCliente); 
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); 
    
    if (!servico) { 
        mostrarAviso('Serviço não encontrado.'); 
        return; 
    }
    
    fecharModal('modal-agendamento');
    
    const tempId = 'temp_' + Date.now(); 
    const profId = (currentUser.nivel === 'admin' && document.getElementById('select-prof-modal').value) ? document.getElementById('select-prof-modal').value : currentUser.id_usuario;
    const novoItem = { 
        id_agendamento: tempId, 
        id_cliente: cliente ? cliente.id_cliente : 'novo', 
        id_servico: servico.id_servico, 
        data_agendamento: dataAg, 
        hora_inicio: horaIni, 
        hora_fim: calcularHoraFim(horaIni, servico.duracao_minutos), 
        status: 'Agendado', 
        nome_cliente: nomeCliente, 
        id_profissional: profId, 
        id_pacote_usado: document.getElementById('check-usar-pacote').checked ? document.getElementById('id-pacote-selecionado').value : '' 
    };
    
    // Atualização Otimista do Saldo do Pacote
    const usarPacote = document.getElementById('check-usar-pacote').checked;
    const idPacote = document.getElementById('id-pacote-selecionado').value;
    if (usarPacote && idPacote) {
        const pIndex = pacotesCache.findIndex(p => p.id_pacote === idPacote);
        if (pIndex > -1) {
            pacotesCache[pIndex].qtd_restante = Math.max(0, parseInt(pacotesCache[pIndex].qtd_restante) - 1);
            saveToCache('pacotes', pacotesCache);
        }
    }

    agendamentosRaw.push(novoItem); 
    saveToCache('agendamentos', agendamentosRaw); 
    atualizarAgendaVisual();
    showSyncIndicator(true); 
    isSaving = true;
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createAgendamento', nome_cliente: nomeCliente, id_cliente: novoItem.id_cliente, id_servico: novoItem.id_servico, data_agendamento: dataAg, hora_inicio: horaIni, usar_pacote_id: novoItem.id_pacote_usado, id_profissional: profId }) });
        const data = await res.json();
        
        if (data.status === 'erro') { throw new Error(data.mensagem); }

        if (data.status === 'sucesso' && data.id_agendamento) { 
            const idx = agendamentosRaw.findIndex(a => a.id_agendamento === tempId); 
            if (idx !== -1) { 
                agendamentosRaw[idx].id_agendamento = data.id_agendamento; 
                if (data.id_cliente) agendamentosRaw[idx].id_cliente = data.id_cliente; 
                saveToCache('agendamentos', agendamentosRaw); 
                atualizarAgendaVisual(); 
                const modalIdInput = document.getElementById('id-agendamento-ativo'); 
                if (modalIdInput && modalIdInput.value === tempId) { 
                    modalIdInput.value = data.id_agendamento; 
                    abrirModalDetalhes(data.id_agendamento); 
                } 
            } 
        }
        showSyncIndicator(false);
    } catch (err) { 
        console.error("Erro ao salvar", err); 
        agendamentosRaw = agendamentosRaw.filter(a => a.id_agendamento !== tempId); 
        saveToCache('agendamentos', agendamentosRaw); 
        
        // Rollback do Saldo do Pacote em caso de erro
        if (usarPacote && idPacote) {
            const pIndex = pacotesCache.findIndex(p => p.id_pacote === idPacote);
            if (pIndex > -1) {
                pacotesCache[pIndex].qtd_restante = parseInt(pacotesCache[pIndex].qtd_restante) + 1;
                saveToCache('pacotes', pacotesCache);
            }
        }

        atualizarAgendaVisual(); 
        mostrarAviso(err.message || 'Falha ao salvar agendamento.'); 
        showSyncIndicator(false); 
    } finally { 
        isSaving = false; 
    }
    f.reset();
}

function prepararStatus(st, btnEl) { 
    const id = document.getElementById('id-agendamento-ativo').value; 
    const idPacote = document.getElementById('id-pacote-agendamento-ativo').value; 
    const contentBotao = btnEl ? btnEl.innerHTML : '';
    
    if (String(id).startsWith('temp_')) { 
        if (btnEl) { 
            setLoading(btnEl, true, 'Sincronizando...'); 
            setTimeout(() => { setLoading(btnEl, false, contentBotao); }, 2000); 
        } 
        return; 
    }
    
    if (st === 'Excluir') { 
        mostrarConfirmacao('Apagar Agendamento', 'Tem certeza? Saldo será devolvido.', () => executarMudancaStatusOtimista(id, st, true)); 
    } else if (st === 'Cancelado') { 
        if (idPacote) { 
            mostrarConfirmacao('Cancelar com Pacote', 'Devolver crédito ao cliente?', () => executarMudancaStatusOtimista(id, st, true), () => executarMudancaStatusOtimista(id, st, false), 'Sim, Devolver', 'Não, Debitar' ); 
        } else { 
            mostrarConfirmacao('Cancelar Agendamento', 'Tem certeza que deseja cancelar?', () => executarMudancaStatusOtimista(id, st, false)); 
        } 
    } else if (st === 'Confirmado') { 
        executarMudancaStatusOtimista(id, st, false); 
    } else { 
        executarMudancaStatusOtimista(id, st, false); 
    } 
}

async function executarMudancaStatusOtimista(id, st, devolver) {
    fecharModal('modal-confirmacao'); 
    fecharModal('modal-detalhes');
    
    const index = agendamentosRaw.findIndex(a => a.id_agendamento === id); 
    if (index === -1) return; 
    
    const backup = { ...agendamentosRaw[index] };
    
    if (st === 'Excluir') { 
        agendamentosRaw.splice(index, 1); 
    } else { 
        agendamentosRaw[index].status = st; 
    } 
    
    saveToCache('agendamentos', agendamentosRaw); 
    atualizarAgendaVisual();
    showSyncIndicator(true); 
    isSaving = true;
    
    try { 
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateStatusAgendamento', id_agendamento: id, novo_status: st, devolver_credito: devolver }) }); 
        const data = await res.json(); 
        if (data.status !== 'sucesso') { throw new Error(data.mensagem || 'Erro no servidor'); } 
        if (devolver) setTimeout(carregarPacotes, 1000); 
        showSyncIndicator(false); 
    } catch (e) { 
        console.error("Erro update status", e); 
        if (st === 'Excluir') agendamentosRaw.splice(index, 0, backup); 
        else agendamentosRaw[index] = backup; 
        saveToCache('agendamentos', agendamentosRaw); 
        atualizarAgendaVisual(); 
        mostrarAviso('Erro de conexão. Alteração não salva.'); 
        showSyncIndicator(false); 
    } finally { 
        isSaving = false; 
    }
}

// --- UTILS DE UI ---

function calcularHoraFim(inicio, duracao) { 
    const [h, m] = inicio.split(':').map(Number); 
    const fimMin = h * 60 + m + parseInt(duracao); 
    return `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`; 
}

function mostrarAviso(msg) { 
    document.getElementById('aviso-msg').innerText = msg; 
    document.getElementById('modal-aviso').classList.add('open'); 
}

function mostrarConfirmacao(t, m, yesCb, noCb, yesTxt = 'Sim', noTxt = 'Cancelar') { 
    document.getElementById('confirm-titulo').innerText = t; 
    document.getElementById('confirm-msg').innerText = m; 
    const oldY = document.getElementById('btn-confirm-yes'); 
    const oldN = document.getElementById('btn-confirm-no'); 
    const newY = oldY.cloneNode(true); 
    const newN = oldN.cloneNode(true); 
    
    newY.innerText = yesTxt; 
    newN.innerText = noTxt; 
    newY.disabled = false; 
    newN.disabled = false; 
    
    oldY.parentNode.replaceChild(newY, oldY); 
    oldN.parentNode.replaceChild(newN, oldN); 
    
    newY.onclick = () => { yesCb(); }; 
    newN.onclick = () => { fecharModal('modal-confirmacao'); if (noCb) noCb(); }; 
    
    document.getElementById('modal-confirmacao').classList.add('open'); 
}

function setLoading(btn, l, t) { 
    btn.disabled = l; 
    if (l) { 
        const isDarkBg = btn.classList.contains('btn-primary') || btn.classList.contains('bg-blue-600') || btn.classList.contains('bg-red-600'); 
        const spinnerType = isDarkBg ? 'spinner' : 'spinner spinner-dark'; 
        btn.innerHTML = `<span class="${spinnerType}"></span>`; 
    } else { 
        btn.innerHTML = t; 
    } 
}

function getCorServico(s) { return s ? (s.cor_hex || s.cor || '#3b82f6') : '#3b82f6'; }
function hexToRgba(hex, a) { if (!hex) return `rgba(59,130,246,${a})`; hex = hex.replace('#', ''); return `rgba(${parseInt(hex.substring(0, 2), 16)},${parseInt(hex.substring(2, 4), 16)},${parseInt(hex.substring(4, 6), 16)},${a})`; }
function hexToRgb(hex) { var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? parseInt(r[1], 16) + ", " + parseInt(r[2], 16) + ", " + parseInt(r[3], 16) : "59,130,246"; }

function atualizarDatalistServicos() { 
    const dl = document.getElementById('lista-servicos-datalist'); 
    if (dl) { 
        dl.innerHTML = ''; 
        servicosCache.forEach(i => { const o = document.createElement('option'); o.value = i.nome_servico; dl.appendChild(o); }); 
    } 
}

function atualizarDatalistClientes() { 
    const dl = document.getElementById('lista-clientes'); 
    if (dl) { 
        dl.innerHTML = ''; 
        clientesCache.forEach(c => { const o = document.createElement('option'); o.value = c.nome; dl.appendChild(o); }); 
    } 
}

function popularSelectsUsuarios() { 
    const selectHeader = document.getElementById('select-profissional-agenda'); 
    selectHeader.innerHTML = ''; 
    const optMe = document.createElement('option'); 
    optMe.value = currentUser.id_usuario; 
    optMe.text = "Minha Agenda"; 
    selectHeader.appendChild(optMe); 
    
    usuariosCache.forEach(u => { 
        if (u.id_usuario !== currentUser.id_usuario) { 
            const opt = document.createElement('option'); 
            opt.value = u.id_usuario; 
            opt.text = u.nome; 
            selectHeader.appendChild(opt); 
        } 
    }); 
    
    const selectModal = document.getElementById('select-prof-modal'); 
    selectModal.innerHTML = ''; 
    const optMeModal = document.createElement('option'); 
    optMeModal.value = currentUser.id_usuario; 
    optMeModal.text = currentUser.nome + " (Eu)"; 
    selectModal.appendChild(optMeModal); 
    
    usuariosCache.forEach(u => { 
        if (u.id_usuario !== currentUser.id_usuario) { 
            const opt = document.createElement('option'); 
            opt.value = u.id_usuario; 
            opt.text = u.nome; 
            selectModal.appendChild(opt); 
        } 
    }); 
}

// --- MODAIS ---

function fecharModal(id) { 
    document.getElementById(id).classList.remove('open'); 
    if (id === 'modal-agendamento') document.getElementById('area-pacote-info')?.classList.add('hidden'); 
}

function abrirModalAgendamento(h) { 
    document.getElementById('modal-agendamento').classList.add('open'); 
    document.getElementById('input-data-modal').value = dataAtual.toISOString().split('T')[0]; 
    if (h) document.getElementById('input-hora-modal').value = h; 
    
    if (currentUser.nivel === 'admin') { 
        document.getElementById('div-select-prof-modal').classList.remove('hidden'); 
        document.getElementById('select-prof-modal').value = currentProfId; 
    } else { 
        document.getElementById('div-select-prof-modal').classList.add('hidden'); 
    } 
}

function abrirModalCliente() { document.getElementById('modal-cliente').classList.add('open'); }
function abrirModalServico() { document.getElementById('modal-servico').classList.add('open'); }

function abrirModalVenderPacote() { 
    itensPacoteTemp = []; 
    atualizarListaVisualPacote(); 
    document.getElementById('input-servico-pacote-nome').value = ''; 
    document.getElementById('valor-total-pacote').value = ''; 
    document.getElementById('modal-vender-pacote').classList.add('open'); 
}

function abrirModalUsuario() { document.getElementById('modal-usuario').classList.add('open'); }

function abrirModalEditarAgendamento() { 
    const id = document.getElementById('id-agendamento-ativo').value; 
    const ag = agendamentosCache.find(x => x.id_agendamento === id); 
    if (!ag) return; 
    
    fecharModal('modal-detalhes'); 
    document.getElementById('edit-agenda-id').value = id; 
    document.getElementById('edit-agenda-cliente').innerText = ag.nome_cliente; 
    const svc = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico)); 
    document.getElementById('edit-agenda-servico').innerText = svc ? svc.nome_servico : 'Serviço'; 
    document.getElementById('edit-agenda-data').value = ag.data_agendamento; 
    document.getElementById('edit-agenda-hora').value = ag.hora_inicio; 
    document.getElementById('modal-editar-agendamento').classList.add('open'); 
}

function abrirModalEditarServico(id) { 
    const s = servicosCache.find(x => x.id_servico === id); 
    if (!s) return; 
    
    document.getElementById('edit-id-servico').value = s.id_servico; 
    document.getElementById('edit-nome-servico').value = s.nome_servico; 
    document.getElementById('edit-valor-servico').value = s.valor_unitario; 
    document.getElementById('edit-duracao-servico').value = s.duracao_minutos; 
    document.getElementById('edit-check-online-booking').checked = String(s.agendamento_online) === 'true'; 
    document.getElementById('edit-input-cor-selecionada').value = getCorServico(s); 
    renderizarColorPickerEdicao(); 
    document.getElementById('modal-editar-servico').classList.add('open'); 
}

// --- FUNÇÕES CRUD E SALVAMENTO ---

async function salvarVendaPacote(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-pacote'); 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    const f = e.target; 
    
    if (itensPacoteTemp.length === 0) { 
        mostrarAviso('Adicione serviços.'); 
        setLoading(btn, false, originalText); 
        return; 
    } 
    
    const cliente = clientesCache.find(c => c.nome === f.nome_cliente.value); 
    if (!cliente) { 
        mostrarAviso('Cliente inválido.'); 
        setLoading(btn, false, originalText); 
        return; 
    } 
    
    try { 
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createPacote', id_cliente: cliente.id_cliente, nome_cliente: cliente.nome, itens: itensPacoteTemp, valor_total: f.valor_total.value, validade: f.validade.value }) }); 
        fecharModal('modal-vender-pacote'); 
        f.reset(); 
        mostrarAviso('Pacote vendido!'); 
        setTimeout(() => { carregarPacotes(); }, 1500); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

async function salvarUsuario(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-usuario'); 
    setLoading(btn, true, 'Salvar'); 
    const f = e.target; 
    
    try { 
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createUsuario', nome: f.nome.value, email: f.email.value, senha: f.senha.value, nivel: f.nivel.value, cor: '#3b82f6' }) }); 
        fecharModal('modal-usuario'); 
        f.reset(); 
        carregarUsuarios(); 
        mostrarAviso('Profissional adicionado!'); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, 'Salvar'); 
    } 
}

async function salvarEdicaoAgendamento(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-edicao-agenda'); 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    const id = document.getElementById('edit-agenda-id').value; 
    const novaData = document.getElementById('edit-agenda-data').value; 
    const novoHorario = document.getElementById('edit-agenda-hora').value; 
    
    try { 
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateAgendamentoDataHora', id_agendamento: id, data_agendamento: novaData, hora_inicio: novoHorario }) }); 
        fecharModal('modal-editar-agendamento'); 
        recarregarAgendaComFiltro(); 
        mostrarAviso('Agendamento atualizado!'); 
    } catch (err) { 
        mostrarAviso('Erro.'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

async function salvarNovoServico(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-servico'); 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    const f = e.target; 
    const fileInput = document.getElementById('input-imagem-servico'); 
    let imagemUrl = ''; 
    
    if (fileInput.files.length > 0) { 
        btn.innerHTML = '<span class="spinner"></span> Enviando img...'; 
        try { 
            const formData = new FormData(); 
            formData.append('image', fileInput.files[0]); 
            const imgReq = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData }); 
            const imgRes = await imgReq.json(); 
            if (imgRes.success) { imagemUrl = imgRes.data.url; } 
        } catch (err) { console.error(err); } 
    } 
    
    try { 
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createServico', nome_servico: f.nome_servico.value, valor_unitario: f.valor_unitario.value, duracao_minutos: f.duracao_minutos.value, cor_hex: document.getElementById('input-cor-selecionada').value, imagem_url: imagemUrl, online_booking: document.getElementById('check-online-booking').checked }) }); 
        fecharModal('modal-servico'); 
        f.reset(); 
        carregarServicos(); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

async function salvarEdicaoServico(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-edicao-servico'); 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    const f = e.target; 
    const fileInput = document.getElementById('edit-input-imagem-servico'); 
    let imagemUrl = ''; 
    
    if (fileInput.files.length > 0) { 
        btn.innerHTML = '<span class="spinner"></span> Enviando img...'; 
        try { 
            const formData = new FormData(); 
            formData.append('image', fileInput.files[0]); 
            const imgReq = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData }); 
            const imgRes = await imgReq.json(); 
            if (imgRes.success) { imagemUrl = imgRes.data.url; } 
        } catch (err) { console.error(err); } 
    } 
    
    try { 
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateServico', id_servico: f.id_servico.value, nome_servico: f.nome_servico.value, valor_unitario: f.valor_unitario.value, duracao_minutos: f.duracao_minutos.value, cor_hex: f.cor_hex.value, online_booking: document.getElementById('edit-check-online-booking').checked, imagem_url: imagemUrl }) }); 
        fecharModal('modal-editar-servico'); 
        carregarServicos(); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

function renderizarListaServicos() { 
    const container = document.getElementById('lista-servicos'); 
    container.innerHTML = ''; 
    servicosCache.forEach(s => { 
        const div = document.createElement('div'); 
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center'; 
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background-color: ${getCorServico(s)}">${s.nome_servico.charAt(0)}</div>
                <div>
                    <h4 class="font-bold text-slate-800">${s.nome_servico}</h4>
                    <p class="text-xs text-slate-500">${s.duracao_minutos} min • R$ ${parseFloat(s.valor_unitario).toFixed(2)}</p>
                </div>
            </div>
            <button onclick="abrirModalEditarServico('${s.id_servico}')" class="text-slate-400 hover:text-blue-600"><i data-lucide="edit-2" class="w-5 h-5"></i></button>`; 
        container.appendChild(div); 
    }); 
    lucide.createIcons(); 
}

// --- LÓGICA DE PACOTES (ATUALIZADA E COMPLETA) ---

function mudarAbaPacotes(aba) {
    abaPacotesAtiva = aba;
    
    // Atualiza botões
    const btnAtivos = document.getElementById('btn-tab-pacotes-ativos');
    const btnHist = document.getElementById('btn-tab-pacotes-historico');
    
    if (aba === 'ativos') {
        btnAtivos.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all bg-white text-blue-600 shadow-sm";
        btnHist.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700";
    } else {
        btnAtivos.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700";
        btnHist.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all bg-white text-blue-600 shadow-sm";
    }
    
    renderizarListaPacotes();
}

function renderizarListaPacotes() { 
    const container = document.getElementById('lista-pacotes'); 
    const termoBusca = document.getElementById('search-pacotes') ? document.getElementById('search-pacotes').value.toLowerCase() : '';
    container.innerHTML = ''; 
    
    // Agrupar pacotes por id_transacao
    const grupos = {};
    
    pacotesCache.forEach(p => {
        const id = p.id_transacao || 'sem_id_' + p.id_pacote;
        if (!grupos[id]) {
            grupos[id] = {
                id_transacao: p.id_transacao || 'N/A',
                nome_cliente: p.nome_cliente,
                data_compra: p.data_compra,
                valor_cobrado: p.valor_cobrado || 0,
                itens: []
            };
        }
        grupos[id].itens.push(p);
    });

    let chaves = Object.keys(grupos);

    // Ordenação Inteligente: Mais recentes primeiro
    chaves.sort((a, b) => {
        const dataA = grupos[a].data_compra; // YYYY-MM-DD
        const dataB = grupos[b].data_compra;
        if (dataA > dataB) return -1;
        if (dataA < dataB) return 1;
        return 0;
    });

    // Filtro por Busca (Nome)
    if (termoBusca) {
        chaves = chaves.filter(key => grupos[key].nome_cliente.toLowerCase().includes(termoBusca));
    }

    // Filtro por Aba (Ativos vs Histórico)
    chaves = chaves.filter(key => {
        const grupo = grupos[key];
        // Ativo = Tem pelo menos 1 item com saldo > 0
        const temSaldo = grupo.itens.some(item => parseInt(item.qtd_restante) > 0);
        
        if (abaPacotesAtiva === 'ativos') return temSaldo;
        return !temSaldo; // Histórico = Todos com saldo 0
    });

    if (chaves.length === 0) { 
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum pacote encontrado.</div>'; 
        return; 
    } 
    
    chaves.forEach(key => { 
        const g = grupos[key];
        const qtdItens = g.itens.length;
        const totalRestante = g.itens.reduce((acc, i) => acc + parseInt(i.qtd_restante), 0);
        const totalInicial = g.itens.reduce((acc, i) => acc + parseInt(i.qtd_total), 0);
        
        const div = document.createElement('div'); 
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors'; 
        div.onclick = () => abrirDetalhesPacote(key);
        
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-slate-800">${g.nome_cliente}</h4>
                    <p class="text-xs text-slate-500">${formatarDataBr(g.data_compra)} • Saldo: ${totalRestante}/${totalInicial}</p>
                </div>
                <div class="text-right">
                    <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">Ver Detalhes</span>
                </div>
            </div>
        `; 
        container.appendChild(div); 
    }); 
}

function abrirDetalhesPacote(idTransacao) {
    const modal = document.getElementById('modal-detalhes-pacote');
    const divSaldos = document.getElementById('tab-modal-saldos');
    const divHist = document.getElementById('tab-modal-historico');
    
    // Filtrar itens deste pacote
    const itens = pacotesCache.filter(p => p.id_transacao === idTransacao || (!p.id_transacao && idTransacao.startsWith('sem_id')));
    
    if (itens.length === 0) return;

    // Collect IDs for history filtering
    const idsPacotes = itens.map(i => String(i.id_pacote));

    // Get History from global agendamentosCache
    const historico = agendamentosCache.filter(ag => {
        const idUsado = String(ag.id_pacote_usado || ag.id_pacote || '');
        return idsPacotes.includes(idUsado);
    });

    // Guardar para o relatório (INCLUDING HISTORY)
    pacoteSelecionado = { id: idTransacao, itens: itens, info: itens[0], historico: historico };

    // Preencher Cabeçalho
    document.getElementById('pacote-info-id').innerText = '#' + (itens[0].id_transacao ? itens[0].id_transacao.slice(-6) : 'N/A');
    document.getElementById('pacote-info-valor').innerText = 'R$ ' + parseFloat(itens[0].valor_cobrado || 0).toFixed(2);
    document.getElementById('pacote-info-data').innerText = formatarDataBr(itens[0].data_compra);

    // Renderizar Saldos
    divSaldos.innerHTML = '';
    itens.forEach(item => {
        const percent = (item.qtd_restante / item.qtd_total) * 100;
        divSaldos.innerHTML += `
            <div class="mb-2">
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-slate-700 font-medium">${item.nome_servico}</span>
                    <span class="text-blue-600 font-bold">${item.qtd_restante}/${item.qtd_total}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>`;
    });

    // Renderizar Histórico (UI Display)
    divHist.innerHTML = '';
    if (historico.length === 0) {
        divHist.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Nenhum uso registrado.</p>';
    } else {
        historico.forEach(h => {
            const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
            const nomeServico = servico ? servico.nome_servico : 'Serviço';
            const statusClass = h.status === 'Concluido' ? 'text-green-600' : (h.status === 'Cancelado' ? 'text-red-400 line-through' : 'text-blue-600');
            
            divHist.innerHTML += `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-sm">
                    <div>
                        <p class="font-bold text-slate-700">${formatarDataBr(h.data_agendamento)} <span class="font-normal text-xs text-slate-400">${h.hora_inicio}</span></p>
                        <p class="text-xs text-slate-500">${nomeServico}</p>
                    </div>
                    <span class="text-xs font-bold uppercase ${statusClass}">${h.status}</span>
                </div>`;
        });
    }
    
    // Resetar aba para Saldos
    switchModalTab('saldos');
    modal.classList.add('open');
}

function enviarRelatorioPacote() {
    if (!pacoteSelecionado) return;
    
    const info = pacoteSelecionado.info;
    const historico = pacoteSelecionado.historico || [];
    const cliente = clientesCache.find(c => String(c.id_cliente) === String(info.id_cliente));
    
    if (!cliente || !cliente.whatsapp) {
        mostrarAviso('Cliente sem WhatsApp cadastrado.');
        return;
    }

    let nums = String(cliente.whatsapp).replace(/\D/g, ''); 
    if (!nums.startsWith('55') && (nums.length === 10 || nums.length === 11)) nums = '55' + nums;

    let texto = `*Relatório de Pacote*\n`;
    texto += `👤 Cliente: ${info.nome_cliente}\n`;
    texto += `📅 Compra: ${formatarDataBr(info.data_compra)}\n\n`;
    
    texto += `*📊 Saldos Atuais:*\n`;
    pacoteSelecionado.itens.forEach(item => {
        texto += `- ${item.nome_servico}: ${item.qtd_restante} de ${item.qtd_total}\n`;
    });

    texto += `\n*📝 Serviços Utilizados:*\n`;
    if (historico.length === 0) {
        texto += `_Nenhum serviço utilizado ainda._\n`;
    } else {
        const histSorted = [...historico].sort((a, b) => {
             return (b.data_agendamento + b.hora_inicio).localeCompare(a.data_agendamento + a.hora_inicio);
        });

        histSorted.forEach(h => {
            const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
            const nomeSvc = servico ? servico.nome_servico : 'Serviço';
            const statusStr = h.status === 'Concluido' ? '✅' : (h.status === 'Cancelado' ? '❌' : '📅');
            texto += `${statusStr} ${formatarDataBr(h.data_agendamento)} - ${nomeSvc}\n`;
        });
    }

    const agora = new Date();
    const dataHoraGeracao = agora.toLocaleString('pt-BR');
    texto += `\n_Gerado em: ${dataHoraGeracao}_`;

    window.open(`https://wa.me/${nums}?text=${encodeURIComponent(texto)}`, '_blank');
}

function carregarServicos() { fetch(`${API_URL}?action=getServicos`).then(r => r.json()).then(d => { servicosCache = d; renderizarListaServicos(); atualizarDatalistServicos(); }); }
function carregarPacotes() { fetch(`${API_URL}?action=getPacotes`).then(r => r.json()).then(d => { pacotesCache = d; renderizarListaPacotes(); }); }
function carregarUsuarios() { fetch(`${API_URL}?action=getUsuarios`).then(r => r.json()).then(d => { usuariosCache = d; renderizarListaUsuarios(); popularSelectsUsuarios(); }); }

function adicionarItemAoPacote() {
    const nomeServico = document.getElementById('input-servico-pacote-nome').value;
    const qtdInput = document.getElementById('qtd-servico-pacote');
    const qtd = parseInt(qtdInput.value);
    
    if (!nomeServico || qtd < 1) return;
    
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase());
    
    if (!servico) {
        mostrarAviso('Serviço não encontrado na lista.');
        return;
    }
    
    const subtotal = (parseFloat(servico.valor_unitario || 0) * qtd);
    itensPacoteTemp.push({
        id_servico: servico.id_servico,
        nome_servico: servico.nome_servico,
        valor_unitario: servico.valor_unitario,
        qtd: qtd,
        subtotal: subtotal
    });
    
    atualizarListaVisualPacote();
    atualizarTotalSugerido();
    document.getElementById('input-servico-pacote-nome').value = "";
    qtdInput.value = "1";
}

function atualizarListaVisualPacote() {
    const container = document.getElementById('lista-itens-pacote');
    container.innerHTML = '';
    
    if (itensPacoteTemp.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Nenhum item adicionado.</p>';
        return;
    }
    
    itensPacoteTemp.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-sm';
        const subtotalFmt = item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        div.innerHTML = `
            <div class="flex-1">
                <div class="flex justify-between items-center">
                    <span class="font-medium text-slate-700">${item.qtd}x ${item.nome_servico}</span>
                    <span class="text-xs text-slate-500 font-medium ml-2">= ${subtotalFmt}</span>
                </div>
            </div>
            <button type="button" onclick="removerItemPacote(${index})" class="ml-3 text-red-400 hover:text-red-600 btn-anim"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function removerItemPacote(index) {
    itensPacoteTemp.splice(index, 1);
    atualizarListaVisualPacote();
    atualizarTotalSugerido();
}

function atualizarTotalSugerido() {
    const total = itensPacoteTemp.reduce((acc, item) => acc + item.subtotal, 0);
    document.getElementById('valor-total-pacote').value = total.toFixed(2);
}

function verificarPacoteDisponivel() {
    const nomeCliente = document.getElementById('input-cliente-nome').value;
    const nomeServico = document.getElementById('input-servico-nome').value;
    const areaInfo = document.getElementById('area-pacote-info');
    const checkbox = document.getElementById('check-usar-pacote');
    const inputIdPacote = document.getElementById('id-pacote-selecionado');
    
    areaInfo.classList.add('hidden');
    inputIdPacote.value = '';
    checkbox.checked = false;
    
    if (!nomeCliente || !nomeServico) return;
    
    const cliente = clientesCache.find(c => c.nome.toLowerCase() === nomeCliente.toLowerCase());
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase());
    
    if (!cliente || !servico) return;
    
    const pacote = pacotesCache.find(p => String(p.id_cliente) === String(cliente.id_cliente) && String(p.id_servico) === String(servico.id_servico) && parseInt(p.qtd_restante) > 0);
    
    if (pacote) {
        areaInfo.classList.remove('hidden');
        areaInfo.classList.add('flex');
        document.getElementById('pacote-saldo').innerText = pacote.qtd_restante;
        inputIdPacote.value = pacote.id_pacote;
        checkbox.checked = true;
    }
}

async function salvarNovoCliente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-cliente');
    setLoading(btn, true, 'Salvar');
    const f = e.target;
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'createCliente',
                nome: f.nome.value,
                whatsapp: f.whatsapp.value,
                email: f.email.value
            })
        });
        const data = await res.json();
        
        if (data.status === 'sucesso') {
            clientesCache.push({
                id_cliente: data.id_cliente,
                nome: data.nome,
                whatsapp: f.whatsapp.value
            });
            atualizarDatalistClientes();
            document.getElementById('input-cliente-nome').value = data.nome;
            fecharModal('modal-cliente');
            f.reset();
            mostrarAviso('Cliente cadastrado!');
        } else {
            mostrarAviso('Erro ao cadastrar.');
        }
    } catch (e) {
        mostrarAviso('Erro de conexão.');
    } finally {
        setLoading(btn, false, 'Salvar');
    }
}

// --- CONFIGURAÇÃO ---

function renderizarListaMsgRapidasConfig() {
    const div = document.getElementById('lista-msg-rapidas');
    div.innerHTML = '';
    if (!config.mensagens_rapidas) config.mensagens_rapidas = [];
    
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
    if (!val) return;
    if (!config.mensagens_rapidas) config.mensagens_rapidas = [];
    config.mensagens_rapidas.push(val);
    input.value = '';
    renderizarListaMsgRapidasConfig();
}

function removerMsgRapida(idx) {
    config.mensagens_rapidas.splice(idx, 1);
    renderizarListaMsgRapidasConfig();
}

function atualizarUIConfig() {
    document.getElementById('cfg-abertura').value = config.abertura;
    document.getElementById('cfg-fechamento').value = config.fechamento;
    document.getElementById('cfg-intervalo').value = config.intervalo_minutos;
    document.getElementById('cfg-concorrencia').checked = config.permite_encaixe;
    document.getElementById('cfg-lembrete-template').value = config.mensagem_lembrete || "Olá {cliente}, seu agendamento é dia {data} às {hora}.";
    
    renderizarListaMsgRapidasConfig();
    renderizarListaHorariosSemanais();
}

function renderizarListaHorariosSemanais() {
    const container = document.getElementById('lista-horarios-semanais');
    container.innerHTML = '';

    const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    if (!config.horarios_semanais || !Array.isArray(config.horarios_semanais) || config.horarios_semanais.length === 0) {
        config.horarios_semanais = [];
        for (let i = 0; i < 7; i++) {
            config.horarios_semanais.push({
                dia: i,
                ativo: i !== 0,
                inicio: '08:00',
                fim: '19:00'
            });
        }
    }

    config.horarios_semanais.forEach(dia => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100';
        
        const isChecked = dia.ativo ? 'checked' : '';
        const opacityClass = dia.ativo ? '' : 'opacity-50';
        const pointerEvents = dia.ativo ? '' : 'pointer-events-none';

        div.innerHTML = `
            <div class="flex items-center gap-3 w-1/3">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="day-active-${dia.dia}" class="sr-only peer" ${isChecked} onchange="toggleDiaConfig(${dia.dia})">
                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span class="text-sm font-bold text-slate-700">${diasNomes[dia.dia]}</span>
            </div>
            <div id="day-times-${dia.dia}" class="flex items-center gap-2 w-2/3 justify-end ${opacityClass} ${pointerEvents}">
                <input type="time" id="day-start-${dia.dia}" value="${dia.inicio}" class="bg-white border border-slate-200 rounded-lg p-1 text-sm text-center w-20 outline-none">
                <span class="text-slate-400 text-xs">até</span>
                <input type="time" id="day-end-${dia.dia}" value="${dia.fim}" class="bg-white border border-slate-200 rounded-lg p-1 text-sm text-center w-20 outline-none">
            </div>
        `;
        container.appendChild(div);
    });
}

window.toggleDiaConfig = function(diaIndex) {
    const checkbox = document.getElementById(`day-active-${diaIndex}`);
    const timeContainer = document.getElementById(`day-times-${diaIndex}`);
    
    if (checkbox.checked) {
        timeContainer.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        timeContainer.classList.add('opacity-50', 'pointer-events-none');
    }
};

async function salvarConfigAPI(btn) { 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    
    const intervalo = document.getElementById('cfg-intervalo').value; 
    const encaixe = document.getElementById('cfg-concorrencia').checked; 
    const msgLembrete = document.getElementById('cfg-lembrete-template').value;
    const msgsRapidas = config.mensagens_rapidas;

    const novosHorarios = [];
    for (let i = 0; i < 7; i++) {
        novosHorarios.push({
            dia: i,
            ativo: document.getElementById(`day-active-${i}`).checked,
            inicio: document.getElementById(`day-start-${i}`).value,
            fim: document.getElementById(`day-end-${i}`).value
        });
    }

    const diaAtivo = novosHorarios.find(d => d.ativo) || { inicio: '08:00', fim: '19:00' };

    try { 
        await fetch(API_URL, {method: 'POST', body: JSON.stringify({ 
            action: 'saveConfig', 
            abertura: diaAtivo.inicio, 
            fechamento: diaAtivo.fim, 
            intervalo_minutos: intervalo, 
            permite_encaixe: encaixe,
            mensagem_lembrete: msgLembrete,
            mensagens_rapidas: msgsRapidas,
            horarios_semanais: novosHorarios
        })}); 
        
        config.abertura = diaAtivo.inicio;
        config.fechamento = diaAtivo.fim;
        config.intervalo_minutos = parseInt(intervalo);
        config.permite_encaixe = encaixe;
        config.mensagem_lembrete = msgLembrete;
        config.horarios_semanais = novosHorarios;
        
        saveToCache('config', config);
        renderizarGrade(); 
        mostrarAviso('Configurações salvas!'); 
    } catch (e) { 
        mostrarAviso('Erro ao salvar.'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}
