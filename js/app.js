// ==========================================
// LÓGICA PRINCIPAL (CORE)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar ícones
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    // Verificar sessão salva
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if (savedUser) { 
        currentUser = JSON.parse(savedUser); 
        iniciarApp(); 
    }
    
    // Listeners de modais (fechar ao clicar fora)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal(overlay.id);
            }
        });
    });

    // Prevenir fecho acidental durante sincronização
    window.addEventListener('beforeunload', function (e) {
        if (isSyncing || isSaving) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

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
    // Alternar telas
    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('app-header').classList.remove('hidden'); 
    document.getElementById('app-header').classList.add('flex'); 
    document.getElementById('bottom-nav').classList.remove('hidden'); 
    document.getElementById('bottom-nav').classList.add('flex'); 
    document.getElementById('main-fab').classList.remove('hidden'); 
    document.getElementById('main-fab').classList.add('flex'); 
    
    // Configurar UI do utilizador
    document.getElementById('user-name-display').innerText = `Olá, ${currentUser.nome}`; 
    document.getElementById('tab-agenda').classList.add('active');
    
    // Configurar permissões
    currentProfId = String(currentUser.id_usuario); 
    if (currentUser.nivel !== 'admin') { 
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); 
    } else { 
        document.getElementById('select-profissional-agenda').classList.remove('hidden'); 
    }
    
    // Inicializadores dos módulos
    renderizarColorPicker(); 
    renderizarColorPickerEdicao(); 
    
    // Carregar dados
    carregarDoCache(); 
    sincronizarDadosAPI(); 
    
    // Polling de atualização
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    // Carregar dados do localStorage para as variáveis globais
    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    // Atualizar UI com dados em cache (se existirem)
    if (cachedServicos) { 
        servicosCache = cachedServicos; 
        renderizarListaServicos(); 
        atualizarDatalistServicos(); 
    }
    if (cachedConfig) { 
        config = cachedConfig; 
        atualizarUIConfig(); 
    }
    if (cachedUsuarios) { 
        usuariosCache = cachedUsuarios; 
        renderizarListaUsuarios(); 
        popularSelectsUsuarios(); 
    }
    if (cachedAgendamentos) { 
        agendamentosRaw = cachedAgendamentos; 
    }
    if (cachedClientes) { 
        clientesCache = cachedClientes; 
        atualizarDatalistClientes(); 
    }
    if (cachedPacotes) { 
        pacotesCache = cachedPacotes; 
        // Não chamamos renderizarListaPacotes aqui pois a aba pode não ser a ativa
    }
    
    // Renderizar a agenda principal
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
        
        // Buscar todos os dados em paralelo
        const [resConfig, resServicos, resClientes, resPacotes, resAgendamentos, resUsuarios] = await Promise.all([ 
            fetchSafe('getConfig'), 
            fetchSafe('getServicos'), 
            fetchSafe('getClientes'), 
            fetchSafe('getPacotes'), 
            fetchSafe('getAgendamentos'), 
            currentUser.nivel === 'admin' ? fetchSafe('getUsuarios') : Promise.resolve([]) 
        ]);
        
        // Atualizar Estado Global e Cache
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
        
        // Atualizar Interfaces dos Módulos
        atualizarDataEPainel(); 
        atualizarDatalistServicos(); 
        atualizarDatalistClientes(); 
        renderizarListaServicos(); 
        
        if (currentUser.nivel === 'admin') { 
            if(abaAtiva === 'pacotes') renderizarListaPacotes(); 
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

function recarregarAgendaComFiltro(silencioso = false) {
    if (isSaving) return;

    if (!silencioso) showSyncIndicator(true);
    const modalIdInput = document.getElementById('id-agendamento-ativo'); 
    const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null; 
    let tempItem = null; 
    if (activeTempId) { tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId); }
    
    // Manter temporários locais
    const currentTemps = agendamentosRaw.filter(a => String(a.id_agendamento).startsWith('temp_'));

    fetch(`${API_URL}?action=getAgendamentos`).then(r => r.json()).then(dados => {
        let novosAgendamentos = Array.isArray(dados) ? dados : [];
        
        // Se o item temporário aberto no modal já foi salvo no servidor, atualizar o ID no modal
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