/* --- CONSTANTES E ESTADO GLOBAL --- */
const API_URL = 'https://script.google.com/macros/s/AKfycbxgSkDYPhTJerGbFsubJE9b_xuwCM6KnAtWh5gFF3WEIEGFWf-SIHd_iWUH3J4JitWUHA/exec';

// VAR garante que ficam acessíveis globalmente entre os ficheiros JS
var currentUser = null;
var currentProfId = null;
var dataAtual = new Date();

// Caches de Dados
var servicosCache = [];
var agendamentosCache = [];
var clientesCache = [];
var pacotesCache = [];
var usuariosCache = [];
var agendamentosRaw = [];

// Controle de Sincronização
var isSyncing = false;
var pollingInterval = null;

// Configuração Padrão
var config = { 
    abertura: '08:00', 
    fechamento: '19:00', 
    intervalo_minutos: 60, 
    permite_encaixe: false, 
    mensagem_lembrete: "", 
    mensagens_rapidas: [], 
    horarios_semanais: [] 
};

/* --- AUTENTICAÇÃO --- */

window.fazerLogin = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    if (typeof window.setLoading === 'function') window.setLoading(btn, true, 'Entrar');
    
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
            if (typeof window.iniciarApp === 'function') window.iniciarApp();
        } else {
            if (typeof window.mostrarAviso === 'function') window.mostrarAviso(res.mensagem);
            if (typeof window.setLoading === 'function') window.setLoading(btn, false, 'Entrar');
        }
    } catch(err) {
        if (typeof window.mostrarAviso === 'function') window.mostrarAviso('Erro de conexão');
        if (typeof window.setLoading === 'function') window.setLoading(btn, false, 'Entrar');
    }
};

window.logout = function() {
    localStorage.removeItem('minhaAgendaUser');
    sessionStorage.removeItem('minhaAgendaUser');
    if(pollingInterval) clearInterval(pollingInterval);
    location.reload();
};

/* --- SINCRONIZAÇÃO DE DADOS (CORE) --- */

window.sincronizarDadosAPI = async function() {
    const container = document.getElementById('agenda-timeline');
    const hasData = document.querySelectorAll('.time-slot').length > 0;
    
    // Mostra loading inicial se não houver dados na tela
    if(!hasData && agendamentosRaw.length === 0) {
        if(container) container.innerHTML = '<div class="p-10 text-center text-slate-400"><div class="spinner spinner-dark mx-auto mb-2 border-slate-300 border-t-blue-500"></div><p>A carregar agenda...</p></div>';
    } else {
        if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator(true);
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
        
        // Carregamento paralelo para rapidez
        const [resConfig, resServicos, resClientes, resPacotes, resAgendamentos, resUsuarios] = await Promise.all([
            fetchSafe('getConfig'),
            fetchSafe('getServicos'),
            fetchSafe('getClientes'),
            fetchSafe('getPacotes'),
            fetchSafe('getAgendamentos'),
            (currentUser && currentUser.nivel === 'admin') ? fetchSafe('getUsuarios') : Promise.resolve([])
        ]);
        
        // Atualizar Configurações
        if(resConfig && resConfig.horarios_semanais) {
            config = resConfig;
            saveToCache('config', config);
            if (typeof window.atualizarUIConfig === 'function') window.atualizarUIConfig();
        }
        
        // Atualizar Caches
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
        
        // Atualizar Interface (Chamadas seguras para ui.js)
        if (typeof window.atualizarDataEPainel === 'function') window.atualizarDataEPainel();
        if (typeof window.atualizarDatalistServicos === 'function') window.atualizarDatalistServicos();
        if (typeof window.atualizarDatalistClientes === 'function') window.atualizarDatalistClientes();
        if (typeof window.renderizarListaServicos === 'function') window.renderizarListaServicos();
        
        if (currentUser && currentUser.nivel === 'admin') {
            if (typeof window.renderizarListaPacotes === 'function') window.renderizarListaPacotes();
            if (typeof window.renderizarListaUsuarios === 'function') window.renderizarListaUsuarios();
            if (typeof window.popularSelectsUsuarios === 'function') window.popularSelectsUsuarios();
        }
        
        if (typeof window.atualizarAgendaVisual === 'function') window.atualizarAgendaVisual();
        if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator(false);
        
    } catch (error) {
        console.error("Erro sincronização", error);
        if(!hasData && container) container.innerHTML = '<p class="text-center text-red-400 text-sm">Erro de conexão.</p>';
        if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator(false);
    }
};

window.recarregarAgendaComFiltro = function(silencioso = false) {
    if(!silencioso && typeof window.showSyncIndicator === 'function') window.showSyncIndicator(true);
    
    const modalIdInput = document.getElementById('id-agendamento-ativo');
    const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null;
    let tempItem = null;
    
    // Se estivermos a ver um item temporário (acabado de criar), guardamos referência
    if(activeTempId) {
        tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId);
    }
    
    fetch(`${API_URL}?action=getAgendamentos`)
    .then(r => r.json())
    .then(dados => {
        const novosAgendamentos = Array.isArray(dados) ? dados : [];
        
        // Lógica para substituir ID temporário pelo real se a sincronização ocorrer com o modal aberto
        if (activeTempId && tempItem) {
            const realItem = novosAgendamentos.find(a => a.data_agendamento === tempItem.data_agendamento && a.hora_inicio === tempItem.hora_inicio && (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) );
            if (realItem) {
                const idxLocal = agendamentosRaw.findIndex(a => a.id_agendamento === activeTempId);
                if(idxLocal !== -1) { agendamentosRaw[idxLocal] = realItem; }
                if (modalIdInput) modalIdInput.value = realItem.id_agendamento;
                if (typeof window.abrirModalDetalhes === 'function') window.abrirModalDetalhes(realItem.id_agendamento);
            }
        }
        
        agendamentosRaw = novosAgendamentos;
        saveToCache('agendamentos', agendamentosRaw);
        
        if (typeof window.atualizarAgendaVisual === 'function') window.atualizarAgendaVisual();
        if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator(false);
    })
    .catch((e) => {
        console.error(e);
        if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator(false);
    });
};

/* --- FUNÇÕES AUXILIARES DE LEITURA (PARA UI) --- */

window.carregarServicos = function() { 
    fetch(`${API_URL}?action=getServicos`)
        .then(r=>r.json())
        .then(d=>{ 
            servicosCache=d; 
            if (typeof window.renderizarListaServicos === 'function') window.renderizarListaServicos(); 
            if (typeof window.atualizarDatalistServicos === 'function') window.atualizarDatalistServicos(); 
        }); 
};

window.carregarPacotes = function() { 
    fetch(`${API_URL}?action=getPacotes`)
        .then(r=>r.json())
        .then(d=>{ 
            pacotesCache=d; 
            if (typeof window.renderizarListaPacotes === 'function') window.renderizarListaPacotes(); 
        }); 
};

window.carregarUsuarios = function() { 
    fetch(`${API_URL}?action=getUsuarios`)
        .then(r=>r.json())
        .then(d=>{ 
            usuariosCache=d; 
            if (typeof window.renderizarListaUsuarios === 'function') window.renderizarListaUsuarios(); 
            if (typeof window.popularSelectsUsuarios === 'function') window.popularSelectsUsuarios(); 
        }); 
};
