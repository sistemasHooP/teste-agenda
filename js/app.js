/* --- INICIALIZAÇÃO E CACHE --- */

window.iniciarApp = function() {
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
    
    if (typeof window.renderizarColorPicker === 'function') window.renderizarColorPicker();
    if (typeof window.renderizarColorPickerEdicao === 'function') window.renderizarColorPickerEdicao();
    window.carregarDoCache();
    window.sincronizarDadosAPI();
    
    // Polling para atualização automática
    if(pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        if (typeof window.recarregarAgendaComFiltro === 'function') window.recarregarAgendaComFiltro(true);
    }, 15000);
};

window.carregarDoCache = function() {
    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    if(cachedServicos) { 
        servicosCache = cachedServicos; 
        if (typeof window.renderizarListaServicos === 'function') window.renderizarListaServicos(); 
        if (typeof window.atualizarDatalistServicos === 'function') window.atualizarDatalistServicos(); 
    }
    if(cachedConfig) { 
        config = cachedConfig; 
        if (typeof window.atualizarUIConfig === 'function') window.atualizarUIConfig(); 
    }
    if(cachedUsuarios) { 
        usuariosCache = cachedUsuarios; 
        if (typeof window.popularSelectsUsuarios === 'function') window.popularSelectsUsuarios(); 
        if (typeof window.renderizarListaUsuarios === 'function') window.renderizarListaUsuarios(); 
    }
    if(cachedAgendamentos) { agendamentosRaw = cachedAgendamentos; }
    if(cachedClientes) { 
        clientesCache = cachedClientes; 
        if (typeof window.atualizarDatalistClientes === 'function') window.atualizarDatalistClientes(); 
    }
    if(cachedPacotes) { pacotesCache = cachedPacotes; }

    if (typeof window.atualizarDataEPainel === 'function') window.atualizarDataEPainel();
};

/* --- CRUD: SERVIÇOS --- */

window.salvarNovoServico = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-servico');
    const originalText = btn.innerText;
    window.setLoading(btn, true, originalText);
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
        await fetch(API_URL,{method:'POST',body:JSON.stringify({
            action:'createServico', 
            nome_servico:f.nome_servico.value, 
            valor_unitario:f.valor_unitario.value, 
            duracao_minutos:f.duracao_minutos.value, 
            cor_hex:document.getElementById('input-cor-selecionada').value, 
            imagem_url: imagemUrl, 
            online_booking: document.getElementById('check-online-booking').checked 
        })});
        window.fecharModal('modal-servico');
        f.reset();
        window.carregarServicos();
    } catch(e){ window.mostrarAviso('Erro'); } 
    finally { window.setLoading(btn, false, originalText); }
};

window.salvarEdicaoServico = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-edicao-servico');
    const originalText = btn.innerText;
    window.setLoading(btn, true, originalText);
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
        await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action: 'updateServico', 
            id_servico: f.id_servico.value, 
            nome_servico: f.nome_servico.value, 
            valor_unitario: f.valor_unitario.value, 
            duracao_minutos: f.duracao_minutos.value, 
            cor_hex: f.cor_hex.value, 
            online_booking: document.getElementById('edit-check-online-booking').checked, 
            imagem_url: imagemUrl 
        })});
        window.fecharModal('modal-editar-servico');
        window.carregarServicos();
    } catch(e) { window.mostrarAviso('Erro'); } 
    finally { window.setLoading(btn, false, originalText); }
};

window.excluirServicoViaModal = function(){ 
    const id=document.getElementById('edit-id-servico').value; 
    window.mostrarConfirmacao('Excluir Serviço', 'Tem certeza?', async () => { 
        try { 
            await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'deleteServico', id_servico: id})}); 
            window.fecharModal('modal-confirmacao'); 
            window.fecharModal('modal-editar-servico'); 
            window.carregarServicos(); 
        } catch(e) { window.mostrarAviso('Erro'); } 
    }); 
};

/* --- CRUD: CLIENTES E USUÁRIOS --- */

window.salvarNovoCliente = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-cliente');
    window.setLoading(btn, true, 'Salvar');
    const f = e.target;
    try {
        const res = await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action: 'createCliente', 
            nome: f.nome.value, 
            whatsapp: f.whatsapp.value, 
            email: f.email.value 
        })});
        const data = await res.json();
        if(data.status === 'sucesso') {
            clientesCache.push({ id_cliente: data.id_cliente, nome: data.nome, whatsapp: f.whatsapp.value });
            window.atualizarDatalistClientes();
            document.getElementById('input-cliente-nome').value = data.nome;
            window.fecharModal('modal-cliente');
            f.reset();
            window.mostrarAviso('Cliente cadastrado!');
        } else { window.mostrarAviso('Erro ao cadastrar.'); }
    } catch(e) { window.mostrarAviso('Erro de conexão.'); } 
    finally { window.setLoading(btn, false, 'Salvar'); }
};

window.salvarUsuario = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-usuario');
    window.setLoading(btn, true, 'Salvar');
    const f = e.target;
    try {
        await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action: 'createUsuario', 
            nome: f.nome.value, 
            email: f.email.value, 
            senha: f.senha.value, 
            nivel: f.nivel.value, 
            cor: '#3b82f6' 
        })});
        window.fecharModal('modal-usuario');
        f.reset();
        window.carregarUsuarios();
        window.mostrarAviso('Profissional adicionado!');
    } catch(e) { window.mostrarAviso('Erro'); } 
    finally { window.setLoading(btn, false, 'Salvar'); }
};

/* --- CRUD: PACOTES --- */

window.salvarVendaPacote = async function(e) {
    e.preventDefault();
    const btn=document.getElementById('btn-salvar-pacote');
    const originalText = btn.innerText;
    window.setLoading(btn, true, originalText);
    const f=e.target;
    
    if (itensPacoteTemp.length === 0) {
        window.mostrarAviso('Adicione serviços.');
        window.setLoading(btn, false, originalText);
        return;
    }
    
    const cliente = clientesCache.find(c => c.nome === f.nome_cliente.value);
    if(!cliente) {
        window.mostrarAviso('Cliente inválido.');
        window.setLoading(btn, false, originalText);
        return;
    }
    
    try {
        await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action:'createPacote', 
            id_cliente: cliente.id_cliente, 
            nome_cliente: cliente.nome, 
            itens: itensPacoteTemp, 
            valor_total: f.valor_total.value, 
            validade: f.validade.value 
        })});
        window.fecharModal('modal-vender-pacote');
        f.reset();
        window.mostrarAviso('Pacote vendido!');
        setTimeout(() => { window.carregarPacotes(); }, 1500);
    } catch(e) { window.mostrarAviso('Erro'); } 
    finally { window.setLoading(btn, false, originalText); }
};

/* --- CRUD: AGENDAMENTOS E BLOQUEIOS --- */

window.salvarAgendamentoOtimista = async function(e) {
    e.preventDefault();
    const f = e.target;
    const nomeCliente = f.nome_cliente.value;
    const nomeServico = f.nome_servico.value;
    const dataAg = f.data_agendamento.value;
    const horaIni = f.hora_inicio.value;
    
    const cliente = clientesCache.find(c => c.nome === nomeCliente);
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase());
    
    if(!servico) { window.mostrarAviso('Serviço não encontrado.'); return; }
    
    window.fecharModal('modal-agendamento');
    
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
    
    agendamentosRaw.push(novoItem);
    saveToCache('agendamentos', agendamentosRaw);
    window.atualizarAgendaVisual();
    window.showSyncIndicator(true);
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ 
            action: 'createAgendamento', 
            nome_cliente: nomeCliente, 
            id_cliente: novoItem.id_cliente, 
            id_servico: novoItem.id_servico, 
            data_agendamento: dataAg, 
            hora_inicio: horaIni, 
            usar_pacote_id: novoItem.id_pacote_usado, 
            id_profissional: profId 
        }) });
        
        const data = await res.json();
        
        if (data.status === 'sucesso' && data.id_agendamento) {
            const idx = agendamentosRaw.findIndex(a => a.id_agendamento === tempId);
            if (idx !== -1) {
                agendamentosRaw[idx].id_agendamento = data.id_agendamento;
                if (data.id_cliente) agendamentosRaw[idx].id_cliente = data.id_cliente;
                saveToCache('agendamentos', agendamentosRaw);
                window.atualizarAgendaVisual();
                
                const modalIdInput = document.getElementById('id-agendamento-ativo');
                if(modalIdInput && modalIdInput.value === tempId) {
                    modalIdInput.value = data.id_agendamento;
                    window.abrirModalDetalhes(data.id_agendamento);
                }
            }
        }
        window.showSyncIndicator(false);
    } catch (err) {
        console.error("Erro ao salvar", err);
        agendamentosRaw = agendamentosRaw.filter(a => a.id_agendamento !== tempId);
        saveToCache('agendamentos', agendamentosRaw);
        window.atualizarAgendaVisual();
        window.mostrarAviso('Falha ao salvar agendamento. Tente novamente.');
        window.showSyncIndicator(false);
    }
    f.reset();
};

window.salvarBloqueio = async function(e) {
    e.preventDefault();
    const f = e.target;
    const motivo = f.motivo.value;
    const hora = document.getElementById('input-hora-bloqueio').value;
    const duracao = f.duracao.value;
    const dataAg = document.getElementById('input-data-modal').value;
    
    window.fecharModal('modal-agendamento');
    
    const tempId = 'temp_blk_' + Date.now();
    const profId = (currentUser.nivel === 'admin' && document.getElementById('select-prof-modal').value) ? document.getElementById('select-prof-modal').value : currentUser.id_usuario;
    
    const novoItem = { 
        id_agendamento: tempId, 
        id_cliente: 'SYSTEM', 
        id_servico: 'BLOQUEIO', 
        data_agendamento: dataAg, 
        hora_inicio: hora, 
        hora_fim: calcularHoraFim(hora, duracao), 
        status: 'Bloqueado', 
        nome_cliente: motivo, 
        id_profissional: profId 
    };
    
    agendamentosRaw.push(novoItem);
    saveToCache('agendamentos', agendamentosRaw);
    window.atualizarAgendaVisual();
    window.showSyncIndicator(true);
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ 
            action: 'bloquearHorario', 
            motivo: motivo, 
            data_agendamento: dataAg, 
            hora_inicio: hora, 
            duracao_minutos: duracao, 
            id_profissional: profId 
        }) });
        
        const data = await res.json();
        if (data.status === 'sucesso') {
            const idx = agendamentosRaw.findIndex(a => a.id_agendamento === tempId);
            if (idx !== -1) agendamentosRaw[idx].id_agendamento = data.id_agendamento;
            saveToCache('agendamentos', agendamentosRaw);
        }
    } catch(e) { window.mostrarAviso('Erro ao salvar bloqueio'); } 
    finally { window.showSyncIndicator(false); }
    f.reset();
};

window.salvarEdicaoAgendamento = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-edicao-agenda');
    const originalText = btn.innerText;
    window.setLoading(btn, true, originalText);
    
    const id = document.getElementById('edit-agenda-id').value;
    const novaData = document.getElementById('edit-agenda-data').value;
    const novoHorario = document.getElementById('edit-agenda-hora').value;
    
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ 
            action: 'updateAgendamentoDataHora', 
            id_agendamento: id, 
            data_agendamento: novaData, 
            hora_inicio: novoHorario 
        }) });
        window.fecharModal('modal-editar-agendamento');
        window.recarregarAgendaComFiltro();
        window.mostrarAviso('Agendamento atualizado!');
    } catch(err) { window.mostrarAviso('Erro.'); } 
    finally { window.setLoading(btn, false, originalText); }
};

window.prepararStatus = function(st, btnEl) { 
    const id = document.getElementById('id-agendamento-ativo').value; 
    const idPacote = document.getElementById('id-pacote-agendamento-ativo').value; 
    const contentBotao = btnEl ? btnEl.innerHTML : ''; 
    
    if(String(id).startsWith('temp_')) { 
        if(btnEl) { 
            window.setLoading(btnEl, true, 'Sincronizando...'); 
            setTimeout(() => { window.setLoading(btnEl, false, contentBotao); }, 2000); 
        } 
        return; 
    } 
    
    if (st === 'Excluir') { 
        window.mostrarConfirmacao('Apagar Agendamento', 'Tem certeza? Saldo será devolvido.', () => window.executarMudancaStatusOtimista(id, st, true)); 
    } else if (st === 'Cancelado') { 
        if(idPacote) { 
            window.mostrarConfirmacao('Cancelar com Pacote', 'Devolver crédito ao cliente?', () => window.executarMudancaStatusOtimista(id, st, true), () => window.executarMudancaStatusOtimista(id, st, false), 'Sim, Devolver', 'Não, Debitar' ); 
        } else { 
            window.mostrarConfirmacao('Cancelar Agendamento', 'Tem certeza que deseja cancelar?', () => window.executarMudancaStatusOtimista(id, st, false)); 
        } 
    } else if (st === 'Confirmado') { 
        window.executarMudancaStatusOtimista(id, st, false); 
    } else { 
        window.executarMudancaStatusOtimista(id, st, false); 
    } 
};

window.executarMudancaStatusOtimista = async function(id, st, devolver) { 
    window.fecharModal('modal-confirmacao'); 
    window.fecharModal('modal-detalhes'); 
    
    const index = agendamentosRaw.findIndex(a => a.id_agendamento === id); 
    if(index === -1) return; 
    const backup = { ...agendamentosRaw[index] }; 
    
    if(st === 'Excluir') { agendamentosRaw.splice(index, 1); } 
    else { agendamentosRaw[index].status = st; } 
    
    saveToCache('agendamentos', agendamentosRaw); 
    window.atualizarAgendaVisual(); 
    window.showSyncIndicator(true); 
    
    try { 
        const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'updateStatusAgendamento', id_agendamento:id, novo_status:st, devolver_credito: devolver }) }); 
        const data = await res.json(); 
        if (data.status !== 'sucesso') { throw new Error(data.mensagem || 'Erro no servidor'); } 
        if(devolver) setTimeout(window.carregarPacotes, 1000); 
        window.showSyncIndicator(false); 
    } catch(e) { 
        console.error("Erro update status", e); 
        if(st === 'Excluir') agendamentosRaw.splice(index, 0, backup); 
        else agendamentosRaw[index] = backup; 
        saveToCache('agendamentos', agendamentosRaw); 
        window.atualizarAgendaVisual(); 
        window.mostrarAviso('Erro de conexão. Alteração não salva.'); 
        window.showSyncIndicator(false); 
    } 
};

/* --- CONFIGURAÇÕES --- */

window.salvarConfigAPI = async function(btn) { 
    const originalText = btn.innerText; 
    window.setLoading(btn, true, originalText); 
    const intervalo = document.getElementById('cfg-intervalo').value; 
    const encaixe = document.getElementById('cfg-concorrencia').checked; 
    const msgLembrete = document.getElementById('cfg-lembrete-template').value; 
    
    try { 
        await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action: 'saveConfig', 
            abertura: config.horarios_semanais.find(d=>d.ativo)?.inicio || '08:00', 
            fechamento: config.horarios_semanais.find(d=>d.ativo)?.fim || '19:00', 
            intervalo_minutos: intervalo, 
            permite_encaixe: encaixe, 
            mensagem_lembrete: msgLembrete, 
            mensagens_rapidas: config.mensagens_rapidas, 
            horarios_semanais: config.horarios_semanais 
        })}); 
        
        config.intervalo_minutos = parseInt(intervalo); 
        config.permite_encaixe = encaixe; 
        config.mensagem_lembrete = msgLembrete; 
        
        saveToCache('config', config); 
        window.renderizarGrade(); 
        window.mostrarAviso('Configurações salvas!'); 
    } catch(e) { window.mostrarAviso('Erro ao salvar.'); } 
    finally { window.setLoading(btn, false, originalText); } 
};
