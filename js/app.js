// ==========================================
// LÓGICA PRINCIPAL (CORE)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar ícones da biblioteca Lucide
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    // Verificar sessão salva no armazenamento local/sessão
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if (savedUser) { 
        currentUser = JSON.parse(savedUser); 
        iniciarApp(); 
    }
    
    // Configurar listeners para fechar modais ao clicar no fundo (overlay)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal(overlay.id);
            }
        });
    });

    // Prevenir fecho acidental da aba durante sincronização ou salvamento
    window.addEventListener('beforeunload', function (e) {
        if (isSyncing || isSaving) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// --- AUTENTICAÇÃO ---

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

// --- INICIALIZAÇÃO DA APLICAÇÃO ---

function iniciarApp() {
    // 1. Alternar visualização (Esconder Login, Mostrar App)
    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('app-header').classList.remove('hidden'); 
    document.getElementById('app-header').classList.add('flex'); 
    document.getElementById('bottom-nav').classList.remove('hidden'); 
    document.getElementById('bottom-nav').classList.add('flex'); 
    document.getElementById('main-fab').classList.remove('hidden'); 
    document.getElementById('main-fab').classList.add('flex'); 
    
    // 2. Configurar cabeçalho com nome do utilizador
    document.getElementById('user-name-display').innerText = `Olá, ${currentUser.nome}`; 
    document.getElementById('tab-agenda').classList.add('active');
    
    // 3. Configurar permissões e filtros de profissional
    currentProfId = String(currentUser.id_usuario); 
    if (currentUser.nivel !== 'admin') { 
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); 
    } else { 
        document.getElementById('select-profissional-agenda').classList.remove('hidden'); 
    }
    
    // 4. Inicializar componentes visuais (Color Pickers)
    // Funções definidas em js/utils.js ou js/admin.js
    if(typeof renderizarColorPicker === 'function') renderizarColorPicker(); 
    if(typeof renderizarColorPickerEdicao === 'function') renderizarColorPickerEdicao(); 
    
    // 5. Carregar dados
    carregarDoCache(); 
    sincronizarDadosAPI(); 
    
    // 6. Iniciar ciclo de atualização automática (Polling) a cada 15s
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    // Carregar dados do localStorage para as variáveis globais (definidas em js/globals.js)
    // getFromCache está em js/utils.js
    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    // Atualizar UI com dados em cache (se existirem)
    if (cachedServicos) { 
        servicosCache = cachedServicos; 
        if(typeof renderizarListaServicos === 'function') renderizarListaServicos(); // js/admin.js
        if(typeof atualizarDatalistServicos === 'function') atualizarDatalistServicos(); // js/admin.js
    }
    
    if (cachedConfig) { 
        config = cachedConfig; 
        if(typeof atualizarUIConfig === 'function') atualizarUIConfig(); // js/admin.js
    }
    
    if (cachedUsuarios) { 
        usuariosCache = cachedUsuarios; 
        if(typeof renderizarListaUsuarios === 'function') renderizarListaUsuarios(); // js/admin.js
        if(typeof popularSelectsUsuarios === 'function') popularSelectsUsuarios(); // js/admin.js
    }
    
    if (cachedAgendamentos) { 
        agendamentosRaw = cachedAgendamentos; 
    }
    
    if (cachedClientes) { 
        clientesCache = cachedClientes; 
        if(typeof atualizarDatalistClientes === 'function') atualizarDatalistClientes(); // js/admin.js
    }
    
    if (cachedPacotes) { 
        pacotesCache = cachedPacotes; 
        // Não forçamos renderizarListaPacotes aqui pois depende da aba ativa
    }
    
    // Renderizar a agenda principal (js/agenda.js)
    if(typeof atualizarDataEPainel === 'function') atualizarDataEPainel();
}

// --- SINCRONIZAÇÃO DE DADOS ---

async function sincronizarDadosAPI() {
    const hasData = document.querySelectorAll('.time-slot').length > 0; 
    const container = document.getElementById('agenda-timeline'); 
    
    // Feedback visual se não houver dados
    if (!hasData && agendamentosRaw.length === 0 && container) { 
        container.innerHTML = '<div class="p-10 text-center text-slate-400"><div class="spinner spinner-dark mx-auto mb-2 border-slate-300 border-t-blue-500"></div><p>A carregar agenda...</p></div>'; 
    } else { 
        showSyncIndicator(true); // js/utils.js
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
        
        // Buscar todos os dados em paralelo para performance
        const [resConfig, resServicos, resClientes, resPacotes, resAgendamentos, resUsuarios] = await Promise.all([ 
            fetchSafe('getConfig'), 
            fetchSafe('getServicos'), 
            fetchSafe('getClientes'), 
            fetchSafe('getPacotes'), 
            fetchSafe('getAgendamentos'), 
            currentUser.nivel === 'admin' ? fetchSafe('getUsuarios') : Promise.resolve([]) 
        ]);
        
        // Atualizar Estado Global e Cache
        if (resConfig && resConfig.abertura) { 
            config = resConfig; 
            if (!config.horarios_semanais) config.horarios_semanais = []; 
            saveToCache('config', config); 
            if(typeof atualizarUIConfig === 'function') atualizarUIConfig(); 
        }
        
        if(Array.isArray(resServicos)) { servicosCache = resServicos; saveToCache('servicos', servicosCache); }
        if(Array.isArray(resClientes)) { clientesCache = resClientes; saveToCache('clientes', clientesCache); }
        if(Array.isArray(resPacotes)) { pacotesCache = resPacotes; saveToCache('pacotes', pacotesCache); }
        if(Array.isArray(resAgendamentos)) { agendamentosRaw = resAgendamentos; saveToCache('agendamentos', agendamentosRaw); }
        
        if(Array.isArray(resUsuarios) && resUsuarios.length > 0) { 
            usuariosCache = resUsuarios; 
            saveToCache('usuarios', usuariosCache); 
        }
        
        // Atualizar Interfaces dos Módulos
        if(typeof atualizarDataEPainel === 'function') atualizarDataEPainel(); 
        if(typeof atualizarDatalistServicos === 'function') atualizarDatalistServicos(); 
        if(typeof atualizarDatalistClientes === 'function') atualizarDatalistClientes(); 
        if(typeof renderizarListaServicos === 'function') renderizarListaServicos(); 
        
        if (currentUser.nivel === 'admin') { 
            if(abaAtiva === 'pacotes' && typeof renderizarListaPacotes === 'function') renderizarListaPacotes(); 
            if(typeof renderizarListaUsuarios === 'function') renderizarListaUsuarios(); 
            if(typeof popularSelectsUsuarios === 'function') popularSelectsUsuarios(); 
        }
        
        if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual(); 
        showSyncIndicator(false);

    } catch (error) { 
        console.error("Erro sincronização", error); 
        if (!hasData && container) container.innerHTML = '<p class="text-center text-red-400 text-sm">Erro de conexão.</p>'; 
        showSyncIndicator(false); 
    }
}

function recarregarAgendaComFiltro(silencioso = false) {
    if (isSaving) return; // Não recarregar se estiver a salvar algo (evita conflito visual)

    if (!silencioso) showSyncIndicator(true);
    
    // Preservar estado do modal aberto
    const modalIdInput = document.getElementById('id-agendamento-ativo'); 
    const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null; 
    let tempItem = null; 
    if (activeTempId) { tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId); }
    
    // Manter temporários locais que ainda não foram salvos
    const currentTemps = agendamentosRaw.filter(a => String(a.id_agendamento).startsWith('temp_'));

    fetch(`${API_URL}?action=getAgendamentos`).then(r => r.json()).then(dados => {
        let novosAgendamentos = Array.isArray(dados) ? dados : [];
        
        // Lógica de reconciliação: Se o item temporário aberto no modal já foi salvo no servidor, atualizar o ID no modal
        if (activeTempId && tempItem) {
            const realItem = novosAgendamentos.find(a => a.data_agendamento === tempItem.data_agendamento && a.hora_inicio === tempItem.hora_inicio && (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) );
            if (realItem) { 
                // Atualizar o ID temporário para o real na lista local (se necessário)
                // Nota: Normalmente substituímos a lista toda, mas se o modal estiver aberto com o ID temp, precisamos atualizar o input hidden
                modalIdInput.value = realItem.id_agendamento; 
                // Reabrir modal com dados reais (se necessário atualizar status)
                if(typeof abrirModalDetalhes === 'function') abrirModalDetalhes(realItem.id_agendamento); 
            }
        }
        
        // Mesclar novos dados com temporários locais
        novosAgendamentos = [...novosAgendamentos, ...currentTemps];
        
        agendamentosRaw = novosAgendamentos; 
        saveToCache('agendamentos', agendamentosRaw); 
        
        if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual(); 
        showSyncIndicator(false);
    }).catch((e) => { 
        console.error(e); 
        showSyncIndicator(false); 
    });
}
