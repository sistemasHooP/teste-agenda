/* --- CONSTANTES E ESTADO GLOBAL --- */
const API_URL = 'https://script.google.com/macros/s/AKfycbxgSkDYPhTJerGbFsubJE9b_xuwCM6KnAtWh5gFF3WEIEGFWf-SIHd_iWUH3J4JitWUHA/exec';

// Estado da Aplicação
let currentUser = null;
let currentProfId = null;
let dataAtual = new Date();

// Caches de Dados
let servicosCache = [];
let agendamentosCache = [];
let clientesCache = [];
let pacotesCache = [];
let usuariosCache = [];
let agendamentosRaw = [];

// Controle de Sincronização
let isSyncing = false;
let pollingInterval = null;

// Configuração Padrão
let config = { 
    abertura: '08:00', 
    fechamento: '19:00', 
    intervalo_minutos: 60, 
    permite_encaixe: false, 
    mensagem_lembrete: "", 
    mensagens_rapidas: [], 
    horarios_semanais: [] 
};

/* --- AUTENTICAÇÃO --- */

async function fazerLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    // Nota: setLoading é uma função de UI, garantida globalmente pelo ui.js
    setLoading(btn, true, 'Entrar');
    
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const manter = document.getElementById('login-manter').checked;
    
    try {
        const r = await fetch(`${API_URL}?action=login&email=${email}&senha=${senha}`);
        const res = await r.json();
        
        if (res.status === 'sucesso') {
            currentUser = res.usuario;
            if(manter) localStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser));
            else sessionStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser));
            
            // Função principal de inicialização (definida no app.js)
            iniciarApp();
        } else {
            mostrarAviso(res.mensagem);
            setLoading(btn, false, 'Entrar');
        }
    } catch(err) {
        mostrarAviso('Erro de conexão');
        setLoading(btn, false, 'Entrar');
    }
}

function logout() {
    localStorage.removeItem('minhaAgendaUser');
    sessionStorage.removeItem('minhaAgendaUser');
    if(pollingInterval) clearInterval(pollingInterval);
    location.reload();
}

/* --- SINCRONIZAÇÃO DE DADOS (CORE) --- */

async function sincronizarDadosAPI() {
    const hasData = document.querySelectorAll('.time-slot').length > 0;
    const container = document.getElementById('agenda-timeline');
    
    if(!hasData && agendamentosRaw.length === 0) {
        container.innerHTML = '<div class="p-10 text-center text-slate-400"><div class="spinner spinner-dark mx-auto mb-2 border-slate-300 border-t-blue-500"></div><p>A carregar agenda...</p></div>';
    } else {
        showSyncIndicator(true);
    }
    
    try {
        const fetchSafe = async (action) => {
            try {
                const r = await fetch(`${API_URL}?action=${action}`);
                return await r.json();
            } catch(e) {
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
        
        if(resConfig && resConfig.horarios_semanais) {
            config = resConfig;
            saveToCache('config', config);
            // Função UI (ui.js)
            atualizarUIConfig();
        }
        
        servicosCache = Array.isArray(resServicos) ? resServicos : [];
        saveToCache('servicos', servicosCache);
        
        clientesCache = Array.isArray(resClientes) ? resClientes : [];
        saveToCache('clientes', clientesCache);
        
        pacotesCache = Array.isArray(resPacotes) ? resPacotes : [];
        saveToCache('pacotes', pacotesCache);
        
        agendamentosRaw = Array.isArray(resAgendamentos) ? resAgendamentos : [];
        saveToCache('agendamentos', agendamentosRaw);
        
        usuariosCache = Array.isArray(resUsuarios) ? resUsuarios : [];
        if(usuariosCache.length > 0) saveToCache('usuarios', usuariosCache);
        
        // Funções de UI e App (definidas no ui.js e app.js)
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
        if(!hasData) container.innerHTML = '<p class="text-center text-red-400 text-sm">Erro de conexão.</p>';
        showSyncIndicator(false);
    }
}

function recarregarAgendaComFiltro(silencioso = false) {
    if(!silencioso) showSyncIndicator(true);
    const modalIdInput = document.getElementById('id-agendamento-ativo');
    const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null;
    let tempItem = null;
    
    if(activeTempId) {
        tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId);
    }
    
    fetch(`${API_URL}?action=getAgendamentos`)
    .then(r => r.json())
    .then(dados => {
        const novosAgendamentos = Array.isArray(dados) ? dados : [];
        if (activeTempId && tempItem) {
            const realItem = novosAgendamentos.find(a => a.data_agendamento === tempItem.data_agendamento && a.hora_inicio === tempItem.hora_inicio && (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) );
            if (realItem) {
                const idxLocal = agendamentosRaw.findIndex(a => a.id_agendamento === activeTempId);
                if(idxLocal !== -1) { agendamentosRaw[idxLocal] = realItem; }
                modalIdInput.value = realItem.id_agendamento;
                abrirModalDetalhes(realItem.id_agendamento);
            }
        }
        agendamentosRaw = novosAgendamentos;
        saveToCache('agendamentos', agendamentosRaw);
        atualizarAgendaVisual();
        showSyncIndicator(false);
    })
    .catch((e) => {
        console.error(e);
        showSyncIndicator(false);
    });
}

/* --- FUNÇÕES AUXILIARES DE LEITURA (FETCH WRAPPERS) --- */

function carregarServicos() { 
    fetch(`${API_URL}?action=getServicos`)
        .then(r=>r.json())
        .then(d=>{ 
            servicosCache=d; 
            renderizarListaServicos(); 
            atualizarDatalistServicos(); 
        }); 
}

function carregarPacotes() { 
    fetch(`${API_URL}?action=getPacotes`)
        .then(r=>r.json())
        .then(d=>{ 
            pacotesCache=d; 
            renderizarListaPacotes(); 
        }); 
}

function carregarUsuarios() { 
    fetch(`${API_URL}?action=getUsuarios`)
        .then(r=>r.json())
        .then(d=>{ 
            usuariosCache=d; 
            renderizarListaUsuarios(); 
            popularSelectsUsuarios(); 
        }); 
}