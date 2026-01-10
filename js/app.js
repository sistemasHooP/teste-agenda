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

// --- NAVEGAÇÃO E TABS (REINSERIDO) ---

function switchTab(t, el) { 
    abaAtiva = t; 
    
    // Atualiza classes dos botões da navbar
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); 
    if(el) el.classList.add('active'); 
    
    // Alterna o conteúdo das abas
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    const tabContent = document.getElementById(`tab-${t}`);
    if(tabContent) tabContent.classList.add('active'); 
    
    // Controla visibilidade do FAB (Botão Flutuante)
    const fab = document.getElementById('main-fab');
    if(fab) fab.style.display = t === 'config' ? 'none' : 'flex'; 
    
    // Lógicas específicas ao entrar na aba
    if (t === 'pacotes') {
        // Se a função existir (carregada do js/pacotes.js)
        if(typeof mudarAbaPacotes === 'function') mudarAbaPacotes('ativos'); 
        if(typeof carregarPacotes === 'function') carregarPacotes(); 
    }
    if (t === 'config') {
        if(typeof atualizarUIConfig === 'function') atualizarUIConfig();
    }
}

function switchConfigTab(tab) {
    document.getElementById('cfg-area-geral').classList.add('hidden');
    document.getElementById('cfg-area-msg').classList.add('hidden');
    
    const btnGeral = document.getElementById('btn-cfg-geral');
    const btnMsg = document.getElementById('btn-cfg-msg');

    // Reset visual dos botões
    if(btnGeral) btnGeral.className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    if(btnMsg) btnMsg.className = 'flex-1 py-2 text-sm font-bold text-slate-400';

    if (tab === 'geral') {
        document.getElementById('cfg-area-geral').classList.remove('hidden');
        if(btnGeral) btnGeral.className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    } else {
        document.getElementById('cfg-area-msg').classList.remove('hidden');
        if(btnMsg) btnMsg.className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    }
}

function switchModalTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    
    const btn = document.getElementById(`tab-btn-${tab}`);
    const content = document.getElementById(`tab-modal-${tab}`);
    
    if(btn) btn.classList.add('active');
    if(content) content.classList.add('active');
}

function acaoFab() { 
    if (abaAtiva === 'servicos' && typeof abrirModalServico === 'function') abrirModalServico(); 
    else if (abaAtiva === 'agenda' && typeof abrirModalAgendamento === 'function') abrirModalAgendamento(); 
    else if (abaAtiva === 'pacotes' && typeof abrirModalVenderPacote === 'function') abrirModalVenderPacote(); 
    else if (abaAtiva === 'equipa' && typeof abrirModalUsuario === 'function') abrirModalUsuario(); 
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
    if(typeof renderizarColorPicker === 'function') renderizarColorPicker(); 
    if(typeof renderizarColorPickerEdicao === 'function') renderizarColorPickerEdicao(); 
    
    // 5. Carregar dados
    carregarDoCache(); 
    sincronizarDadosAPI(); 
    
    // 6. Iniciar ciclo de atualização automática (Polling) a cada 15s
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    // Carregar dados do localStorage para as variáveis globais
    if(typeof getFromCache !== 'function') return;

    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    // Atualizar UI com dados em cache (se existirem)
    if (cachedServicos) { 
        servicosCache = cachedServicos; 
        if(typeof renderizarListaServicos === 'function') renderizarListaServicos(); 
        if(typeof atualizarDatalistServicos === 'function') atualizarDatalistServicos(); 
    }
    
    if (cachedConfig) { 
        config = cachedConfig; 
        if(typeof atualizarUIConfig === 'function') atualizarUIConfig(); 
    }
    
    if (cachedUsuarios) { 
        usuariosCache = cachedUsuarios; 
        if(typeof renderizarListaUsuarios === 'function') renderizarListaUsuarios(); 
        if(typeof popularSelectsUsuarios === 'function') popularSelectsUsuarios(); 
    }
    
    if (cachedAgendamentos) { 
        agendamentosRaw = cachedAgendamentos; 
    }
    
    if (cachedClientes) { 
        clientesCache = cachedClientes; 
        if(typeof atualizarDatalistClientes === 'function') atualizarDatalistClientes(); 
    }
    
    if (cachedPacotes) { 
        pacotesCache = cachedPacotes; 
    }
    
    // Renderizar a agenda principal
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
        if(typeof showSyncIndicator === 'function') showSyncIndicator(true); 
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
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false);

    } catch (error) { 
        console.error("Erro sincronização", error); 
        if (!hasData && container) container.innerHTML = '<p class="text-center text-red-400 text-sm">Erro de conexão.</p>'; 
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false); 
    }
}

function recarregarAgendaComFiltro(silencioso = false) {
    if (isSaving) return; // Não recarregar se estiver a salvar algo

    if (!silencioso && typeof showSyncIndicator === 'function') showSyncIndicator(true);
    
    // Preservar estado do modal aberto
    const modalIdInput = document.getElementById('id-agendamento-ativo'); 
    const activeTempId = (modalIdInput && String(modalIdInput.value).startsWith('temp_')) ? modalIdInput.value : null; 
    let tempItem = null; 
    if (activeTempId) { tempItem = agendamentosRaw.find(a => a.id_agendamento === activeTempId); }
    
    // Manter temporários locais que ainda não foram salvos
    const currentTemps = agendamentosRaw.filter(a => String(a.id_agendamento).startsWith('temp_'));

    fetch(`${API_URL}?action=getAgendamentos`).then(r => r.json()).then(dados => {
        let novosAgendamentos = Array.isArray(dados) ? dados : [];
        
        // Reconciliação de IDs temporários
        if (activeTempId && tempItem) {
            const realItem = novosAgendamentos.find(a => a.data_agendamento === tempItem.data_agendamento && a.hora_inicio === tempItem.hora_inicio && (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) );
            if (realItem) { 
                modalIdInput.value = realItem.id_agendamento; 
                if(typeof abrirModalDetalhes === 'function') abrirModalDetalhes(realItem.id_agendamento); 
            }
        }
        
        // Mesclar
        novosAgendamentos = [...novosAgendamentos, ...currentTemps];
        
        agendamentosRaw = novosAgendamentos; 
        saveToCache('agendamentos', agendamentosRaw); 
        
        if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual(); 
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false);
    }).catch((e) => { 
        console.error(e); 
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false); 
    });
}

// --- TRATAMENTO DE STATUS E EXCLUSÃO (CORRIGIDO) ---

function prepararStatus(st, btnEl) { 
    const id = document.getElementById('id-agendamento-ativo').value; 
    const idPacote = document.getElementById('id-pacote-agendamento-ativo').value; 
    
    // Busca o agendamento atual para verificar o status real
    const agendamentoAtual = agendamentosRaw.find(a => a.id_agendamento === id);
    const statusAtual = agendamentoAtual ? agendamentoAtual.status : '';

    const contentBotao = btnEl ? btnEl.innerHTML : '';
    
    if (String(id).startsWith('temp_')) { 
        if (btnEl) { 
            setLoading(btnEl, true, 'Sincronizando...'); 
            setTimeout(() => { setLoading(btnEl, false, contentBotao); }, 2000); 
        } 
        return; 
    }
    
    if (st === 'Excluir') {
        // CORREÇÃO CRÍTICA: Se já estiver Cancelado, não devolve crédito novamente.
        if (idPacote && statusAtual !== 'Cancelado') {
            mostrarConfirmacao('Apagar Agendamento', 'Este item pertence a um pacote. Deseja devolver o crédito ao cliente antes de apagar?', 
                () => executarMudancaStatusOtimista(id, st, true), // Sim, devolver
                () => executarMudancaStatusOtimista(id, st, false), // Não, apenas apagar
                'Sim, Devolver', 'Não, só Apagar'
            );
        } else {
            // Se não tem pacote OU já está cancelado, apenas apaga (sem opção de devolução)
            mostrarConfirmacao('Apagar Agendamento', 'Tem certeza que deseja apagar permanentemente este registro?', 
                () => executarMudancaStatusOtimista(id, st, false)
            );
        }
    } else if (st === 'Cancelado') { 
        if (idPacote) { 
            mostrarConfirmacao('Cancelar com Pacote', 'Devolver crédito ao cliente?', 
                () => executarMudancaStatusOtimista(id, st, true), 
                () => executarMudancaStatusOtimista(id, st, false), 
                'Sim, Devolver', 'Não, Debitar' 
            ); 
        } else { 
            mostrarConfirmacao('Cancelar Agendamento', 'Tem certeza que deseja cancelar?', 
                () => executarMudancaStatusOtimista(id, st, false)
            ); 
        } 
    } else if (st === 'Confirmado') { 
        executarMudancaStatusOtimista(id, st, false); 
    } else { 
        executarMudancaStatusOtimista(id, st, false); 
    } 
}

async function executarMudancaStatusOtimista(id, st, devolver) {
    if(typeof fecharModal === 'function') {
        fecharModal('modal-confirmacao'); 
        fecharModal('modal-detalhes');
    }
    
    const index = agendamentosRaw.findIndex(a => a.id_agendamento === id); 
    if (index === -1) return; 
    
    const backup = { ...agendamentosRaw[index] };
    
    // Atualização otimista local
    if (st === 'Excluir') { 
        agendamentosRaw.splice(index, 1); 
    } else { 
        agendamentosRaw[index].status = st; 
    } 
    
    // Se for devolver crédito, atualizar saldo do pacote otimisticamente
    if (devolver) {
        const idPacote = backup.id_pacote_usado || backup.id_pacote;
        const pIndex = pacotesCache.findIndex(p => p.id_pacote === idPacote);
        if (pIndex > -1) {
            pacotesCache[pIndex].qtd_restante = parseInt(pacotesCache[pIndex].qtd_restante) + 1;
            saveToCache('pacotes', pacotesCache);
        }
    }

    saveToCache('agendamentos', agendamentosRaw); 
    if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual();
    
    if(typeof showSyncIndicator === 'function') showSyncIndicator(true); 
    isSaving = true;
    
    try { 
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateStatusAgendamento', id_agendamento: id, novo_status: st, devolver_credito: devolver }) }); 
        const data = await res.json(); 
        
        if (data.status !== 'sucesso') { throw new Error(data.mensagem || 'Erro no servidor'); } 
        
        // Recarregar pacotes se houve devolução para garantir sincronia
        if (devolver) setTimeout(() => { if(typeof carregarPacotes === 'function') carregarPacotes(); }, 1000); 
        
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false); 
    } catch (e) { 
        console.error("Erro update status", e); 
        
        // Rollback em caso de erro
        if (st === 'Excluir') agendamentosRaw.splice(index, 0, backup); 
        else agendamentosRaw[index] = backup; 
        
        if (devolver) {
            const idPacote = backup.id_pacote_usado || backup.id_pacote;
            const pIndex = pacotesCache.findIndex(p => p.id_pacote === idPacote);
            if (pIndex > -1) {
                pacotesCache[pIndex].qtd_restante = Math.max(0, parseInt(pacotesCache[pIndex].qtd_restante) - 1);
                saveToCache('pacotes', pacotesCache);
            }
        }
        
        saveToCache('agendamentos', agendamentosRaw); 
        if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual(); 
        mostrarAviso('Erro de conexão. Alteração não salva.'); 
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false); 
    } finally { 
        isSaving = false; 
    }
}
