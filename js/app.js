// ==========================================
// LÓGICA PRINCIPAL (CONTROLADOR)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    // Verificar sessão
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if (savedUser) { 
        currentUser = JSON.parse(savedUser); 
        iniciarApp(); 
    }
    
    // Listeners Globais
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) fecharModal(overlay.id);
        });
    });

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

// --- INICIALIZAÇÃO ---

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
    
    // Inicializar componentes visuais (Funções em utils.js)
    if(typeof renderizarColorPicker === 'function') renderizarColorPicker(); 
    if(typeof renderizarColorPickerEdicao === 'function') renderizarColorPickerEdicao(); 
    
    carregarDoCache(); 
    sincronizarDadosAPI(); 
    
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    // Carrega dados e chama renderizações específicas de cada módulo
    if(typeof getFromCache !== 'function') return;

    const cServicos = getFromCache('servicos');
    const cConfig = getFromCache('config');
    const cUsuarios = getFromCache('usuarios');
    const cAgendamentos = getFromCache('agendamentos');
    const cClientes = getFromCache('clientes');
    const cPacotes = getFromCache('pacotes');

    if (cServicos) { 
        servicosCache = cServicos; 
        if(typeof renderizarListaServicos === 'function') renderizarListaServicos(); // admin.js
        if(typeof atualizarDatalistServicos === 'function') atualizarDatalistServicos(); // admin.js
    }
    if (cConfig) { 
        config = cConfig; 
        if(typeof atualizarUIConfig === 'function') atualizarUIConfig(); // admin.js
    }
    if (cUsuarios) { 
        usuariosCache = cUsuarios; 
        if(typeof renderizarListaUsuarios === 'function') renderizarListaUsuarios(); // admin.js
        if(typeof popularSelectsUsuarios === 'function') popularSelectsUsuarios(); // admin.js
    }
    if (cAgendamentos) { agendamentosRaw = cAgendamentos; }
    if (cClientes) { 
        clientesCache = cClientes; 
        if(typeof atualizarDatalistClientes === 'function') atualizarDatalistClientes(); // admin.js
    }
    if (cPacotes) { pacotesCache = cPacotes; }
    
    // Renderiza a Agenda (agenda.js)
    if(typeof atualizarDataEPainel === 'function') atualizarDataEPainel();
}

// --- SINCRONIZAÇÃO ---

async function sincronizarDadosAPI() {
    const hasData = document.querySelectorAll('.time-slot').length > 0; 
    const container = document.getElementById('agenda-timeline'); 
    
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
        
        const [resConfig, resServicos, resClientes, resPacotes, resAgendamentos, resUsuarios] = await Promise.all([ 
            fetchSafe('getConfig'), 
            fetchSafe('getServicos'), 
            fetchSafe('getClientes'), 
            fetchSafe('getPacotes'), 
            fetchSafe('getAgendamentos'), 
            currentUser.nivel === 'admin' ? fetchSafe('getUsuarios') : Promise.resolve([]) 
        ]);
        
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
        if(Array.isArray(resUsuarios) && resUsuarios.length > 0) { usuariosCache = resUsuarios; saveToCache('usuarios', usuariosCache); }
        
        // Atualizar Interfaces
        if(typeof atualizarDataEPainel === 'function') atualizarDataEPainel(); 
        if(typeof atualizarDatalistServicos === 'function') atualizarDatalistServicos(); 
        if(typeof atualizarDatalistClientes === 'function') atualizarDatalistClientes(); 
        if(typeof renderizarListaServicos === 'function') renderizarListaServicos(); 
        
        // Atualizar aba ativa se necessário
        if (currentUser.nivel === 'admin') { 
            if(abaAtiva === 'pacotes' && typeof renderizarListaPacotes === 'function') renderizarListaPacotes(); 
            if(abaAtiva === 'clientes' && typeof renderizarListaClientes === 'function') renderizarListaClientes();
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
    if (isSaving) return;

    if (!silencioso && typeof showSyncIndicator === 'function') showSyncIndicator(true);
    
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
                modalIdInput.value = realItem.id_agendamento; 
                if(typeof abrirModalDetalhes === 'function') abrirModalDetalhes(realItem.id_agendamento); 
            }
        }
        
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

// --- NAVEGAÇÃO E MODAIS ---

function switchTab(t, el) { 
    abaAtiva = t; 
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); 
    if(el) el.classList.add('active'); 
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    const tabContent = document.getElementById(`tab-${t}`);
    if(tabContent) tabContent.classList.add('active'); 
    
    const fab = document.getElementById('main-fab');
    if(fab) fab.style.display = t === 'config' ? 'none' : 'flex'; 
    
    // Carregamento Lazy das abas
    if (t === 'pacotes') {
        if(typeof mudarAbaPacotes === 'function') mudarAbaPacotes('ativos'); 
        if(typeof carregarPacotes === 'function') carregarPacotes(); 
    }
    if (t === 'clientes') {
        if(typeof renderizarListaClientes === 'function') renderizarListaClientes();
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
    else if (abaAtiva === 'clientes' && typeof abrirModalCliente === 'function') abrirModalCliente(); 
}

function mudarProfissionalAgenda() { 
    currentProfId = document.getElementById('select-profissional-agenda').value; 
    if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual(); 
}

// --- FUNÇÕES DE AGENDAMENTO E BLOQUEIO ---

function abrirModalAgendamento(h, tabDefault = 'agendar') { 
    document.getElementById('modal-agendamento').classList.add('open'); 
    
    const dateStr = dataAtual.toISOString().split('T')[0];
    document.getElementById('input-data-modal').value = dateStr; 
    document.getElementById('input-data-bloqueio').value = dateStr;

    if (h) {
        document.getElementById('input-hora-modal').value = h; 
        document.getElementById('input-hora-bloqueio').value = h;
    }
    
    if (currentUser.nivel === 'admin') { 
        document.getElementById('div-select-prof-modal').classList.remove('hidden'); 
        document.getElementById('select-prof-modal').value = currentProfId; 
    } else { 
        document.getElementById('div-select-prof-modal').classList.add('hidden'); 
    }

    switchTipoAgendamento(tabDefault);
}

function switchTipoAgendamento(tipo) {
    const btnAgendar = document.getElementById('btn-tipo-agendar');
    const btnBloquear = document.getElementById('btn-tipo-bloquear');
    const formAgendar = document.getElementById('form-agendamento');
    const formBloquear = document.getElementById('form-bloqueio');

    if (tipo === 'agendar') {
        btnAgendar.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all bg-white text-blue-600 shadow-sm";
        btnBloquear.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700";
        formAgendar.classList.remove('hidden');
        formAgendar.classList.add('block');
        formBloquear.classList.add('hidden');
        formBloquear.classList.remove('block');
    } else {
        btnAgendar.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700";
        btnBloquear.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all bg-white text-blue-600 shadow-sm";
        formAgendar.classList.add('hidden');
        formAgendar.classList.remove('block');
        formBloquear.classList.remove('hidden');
        formBloquear.classList.add('block');
    }
}

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
    if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual();
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
                if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual();
                
                const modalIdInput = document.getElementById('id-agendamento-ativo'); 
                if (modalIdInput && modalIdInput.value === tempId) { 
                    modalIdInput.value = data.id_agendamento; 
                    if(typeof abrirModalDetalhes === 'function') abrirModalDetalhes(data.id_agendamento); 
                } 
            } 
        }
        showSyncIndicator(false);
    } catch (err) { 
        console.error("Erro ao salvar", err); 
        agendamentosRaw = agendamentosRaw.filter(a => a.id_agendamento !== tempId); 
        saveToCache('agendamentos', agendamentosRaw); 
        
        if (usarPacote && idPacote) {
            const pIndex = pacotesCache.findIndex(p => p.id_pacote === idPacote);
            if (pIndex > -1) {
                pacotesCache[pIndex].qtd_restante = parseInt(pacotesCache[pIndex].qtd_restante) + 1;
                saveToCache('pacotes', pacotesCache);
            }
        }

        if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual();
        mostrarAviso(err.message || 'Falha ao salvar agendamento.'); 
        showSyncIndicator(false); 
    } finally { 
        isSaving = false; 
    }
    f.reset();
}

async function salvarBloqueio(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-bloqueio');
    const originalText = btn.innerText;
    setLoading(btn, true, 'Salvando...');
    
    const f = e.target;
    const dataAg = f.data_agendamento.value;
    const horaIni = f.hora_inicio.value;
    const duracao = f.duracao_minutos.value;
    const motivo = f.motivo.value;
    
    fecharModal('modal-agendamento');
    
    // Otimista
    const tempId = 'blk_' + Date.now();
    const novoBloqueio = {
        id_agendamento: tempId,
        id_cliente: 'SYSTEM',
        id_servico: 'BLOQUEIO',
        data_agendamento: dataAg,
        hora_inicio: horaIni,
        hora_fim: calcularHoraFim(horaIni, duracao),
        status: 'Bloqueado',
        nome_cliente: motivo || 'Bloqueio',
        id_profissional: currentProfId
    };
    
    agendamentosRaw.push(novoBloqueio);
    saveToCache('agendamentos', agendamentosRaw);
    if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual();
    
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'bloquearHorario',
                data_agendamento: dataAg,
                hora_inicio: horaIni,
                duracao_minutos: duracao,
                motivo: motivo,
                id_profissional: currentProfId
            })
        });
        
        recarregarAgendaComFiltro(); 
        mostrarAviso('Horário bloqueado com sucesso.');
    } catch(err) {
        console.error(err);
        mostrarAviso('Erro ao bloquear horário.');
        agendamentosRaw = agendamentosRaw.filter(a => a.id_agendamento !== tempId);
        saveToCache('agendamentos', agendamentosRaw);
        if(typeof atualizarAgendaVisual === 'function') atualizarAgendaVisual();
    } finally {
        setLoading(btn, false, originalText);
        f.reset();
    }
}

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

// --- TRATAMENTO DE STATUS ---

function prepararStatus(st, btnEl) { 
    const id = document.getElementById('id-agendamento-ativo').value; 
    const idPacote = document.getElementById('id-pacote-agendamento-ativo').value; 
    
    // Obter o objeto atualizado
    const agendamentoAtual = agendamentosRaw.find(a => a.id_agendamento === id);
    if (!agendamentoAtual) return;

    const statusAtual = agendamentoAtual.status;
    const isBlock = agendamentoAtual.id_servico === 'BLOQUEIO';

    const contentBotao = btnEl ? btnEl.innerHTML : '';
    
    if (String(id).startsWith('temp_')) { 
        if (btnEl) { 
            setLoading(btnEl, true, 'Sincronizando...'); 
            setTimeout(() => { setLoading(btnEl, false, contentBotao); }, 2000); 
        } 
        return; 
    }
    
    if (st === 'Excluir') {
        if (isBlock) {
             mostrarConfirmacao('Remover Bloqueio', 'Tem certeza que deseja liberar este horário?', 
                () => executarMudancaStatusOtimista(id, st, false)
            );
        } else if (idPacote && statusAtual !== 'Cancelado') {
            mostrarConfirmacao('Apagar Agendamento', 'Este item pertence a um pacote. Deseja devolver o crédito ao cliente antes de apagar?', 
                () => executarMudancaStatusOtimista(id, st, true), 
                () => executarMudancaStatusOtimista(id, st, false), 
                'Sim, Devolver', 'Não, só Apagar'
            );
        } else {
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
    
    if (st === 'Excluir') { 
        agendamentosRaw.splice(index, 1); 
    } else { 
        agendamentosRaw[index].status = st; 
    } 
    
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
        
        if (devolver) setTimeout(() => { if(typeof carregarPacotes === 'function') carregarPacotes(); }, 1000); 
        
        if(typeof showSyncIndicator === 'function') showSyncIndicator(false); 
    } catch (e) { 
        console.error("Erro update status", e); 
        
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

// --- WHATSAPP & MODAL DETALHES ---

function getWhatsappCliente(idAgendamento) {
    const ag = agendamentosCache.find(a => a.id_agendamento === idAgendamento);
    if(!ag) return null;
    
    let cliente = clientesCache.find(c => String(c.id_cliente) === String(ag.id_cliente));
    if(!cliente) cliente = clientesCache.find(c => c.nome === ag.nome_cliente);
    
    if(cliente && cliente.whatsapp) {
        let nums = String(cliente.whatsapp).replace(/\D/g, ''); 
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

function abrirModalDetalhes(id) { 
    const ag = agendamentosCache.find(a => a.id_agendamento === id); if(!ag) return; 
    
    document.getElementById('id-agendamento-ativo').value = id; 
    const idPacote = ag.id_pacote_usado || ag.id_pacote || ''; 
    document.getElementById('id-pacote-agendamento-ativo').value = idPacote;

    // Verificar se é bloqueio
    const isBlock = ag.id_servico === 'BLOQUEIO' || ag.status === 'Bloqueado';
    
    const servico = isBlock ? null : servicosCache.find(s => String(s.id_servico) === String(ag.id_servico)); 
    const nomeCliente = isBlock ? (ag.nome_cliente || 'Bloqueio de Agenda') : (ag.nome_cliente || 'Cliente');
    const isConcluido = ag.status === 'Concluido';
    const isCancelado = ag.status === 'Cancelado';

    document.getElementById('detalhe-cliente').innerText = nomeCliente;
    document.getElementById('detalhe-servico').innerText = isBlock ? 'Horário Indisponível' : (servico ? servico.nome_servico : 'Serviço');
    document.getElementById('detalhe-data').innerText = formatarDataBr(ag.data_agendamento);
    document.getElementById('detalhe-hora').innerText = `${ag.hora_inicio} - ${ag.hora_fim}`;
    
    const badge = document.getElementById('detalhe-status-badge');
    badge.innerText = ag.status || 'Agendado';
    badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase ';
    
    if(isBlock) badge.className += 'bg-slate-200 text-slate-600';
    else if(isConcluido) badge.className += 'bg-slate-200 text-slate-600';
    else if(isCancelado) badge.className += 'bg-red-100 text-red-600';
    else if(ag.status === 'Confirmado') badge.className += 'bg-green-100 text-green-700';
    else badge.className += 'bg-blue-100 text-blue-700';

    // Controlo de Botões
    const btnEditar = document.getElementById('btn-editar-horario');
    const btnCancelar = document.getElementById('btn-cancelar');
    const btnExcluir = document.getElementById('btn-excluir');
    const btnConfirmar = document.getElementById('btn-confirmar');
    const btnConcluir = document.getElementById('btn-concluir');

    // Reset estados
    if(btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.classList.remove('opacity-70', 'cursor-default');
        btnConfirmar.classList.add('btn-anim');
    }

    if (isConcluido || isCancelado) {
        if(btnEditar) btnEditar.style.display = 'none';
        if(btnCancelar) btnCancelar.style.display = 'none';
        if(btnConfirmar) btnConfirmar.style.display = 'none';
        if(btnConcluir) btnConcluir.style.display = 'none';
        if(btnExcluir) {
            btnExcluir.style.display = 'block'; 
            btnExcluir.innerHTML = 'Apagar Permanentemente';
            btnExcluir.className = "hidden w-full p-3 text-red-400 text-xs font-bold mt-2 hover:text-red-600";
            btnExcluir.classList.remove('hidden');
        }
    } else if (isBlock) {
        if(btnEditar) btnEditar.style.display = 'none';
        if(btnCancelar) btnCancelar.style.display = 'none';
        if(btnConfirmar) btnConfirmar.style.display = 'none';
        if(btnConcluir) btnConcluir.style.display = 'none';
        if(btnExcluir) {
            btnExcluir.style.display = 'block';
            btnExcluir.innerHTML = 'Remover Bloqueio';
            btnExcluir.className = "w-full p-3 bg-red-50 text-red-600 font-bold rounded-xl text-sm border border-red-100 flex items-center justify-center gap-2 btn-anim";
            btnExcluir.classList.remove('hidden');
        }
    } else {
        if(btnEditar) btnEditar.style.display = 'flex';
        if(btnCancelar) btnCancelar.style.display = 'flex';
        if(btnExcluir) btnExcluir.style.display = 'none';
        
        if (ag.status === 'Confirmado') {
            btnConfirmar.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Já Confirmado';
            btnConfirmar.className = "w-full p-3 bg-green-50 text-green-700 font-bold rounded-xl text-sm border border-green-200 flex items-center justify-center gap-2 cursor-default opacity-70";
            btnConfirmar.disabled = true;
            btnConfirmar.onclick = null;
            btnConfirmar.style.display = 'flex';
            btnConcluir.style.display = 'flex';
        } else {
            btnConfirmar.innerHTML = '<i data-lucide="thumbs-up" class="w-4 h-4"></i> Confirmar Presença';
            btnConfirmar.className = "w-full p-3 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm border border-blue-100 flex items-center justify-center gap-2 btn-anim";
            
            const nBtn = btnConfirmar.cloneNode(true);
            btnConfirmar.parentNode.replaceChild(nBtn, btnConfirmar);
            nBtn.onclick = () => prepararStatus('Confirmado', nBtn);
            
            nBtn.style.display = 'flex';
            btnConcluir.style.display = 'flex';
        }
    }
    
    document.getElementById('modal-detalhes').classList.add('open'); 
    lucide.createIcons(); 
}
