/* --- INICIALIZAÇÃO E CACHE --- */

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
    
    // Polling para atualização automática
    if(pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
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

/* --- CRUD: SERVIÇOS --- */

async function salvarNovoServico(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-servico');
    const originalText = btn.innerText;
    setLoading(btn, true, originalText);
    const f = e.target;
    
    // Upload Imagem
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
        fecharModal('modal-servico');
        f.reset();
        carregarServicos();
    } catch(e){ mostrarAviso('Erro'); } 
    finally { setLoading(btn, false, originalText); }
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
        fecharModal('modal-editar-servico');
        carregarServicos();
    } catch(e) { mostrarAviso('Erro'); } 
    finally { setLoading(btn, false, originalText); }
}

function excluirServicoViaModal(){ 
    const id=document.getElementById('edit-id-servico').value; 
    mostrarConfirmacao('Excluir Serviço', 'Tem certeza?', async () => { 
        try { 
            await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'deleteServico', id_servico: id})}); 
            fecharModal('modal-confirmacao'); 
            fecharModal('modal-editar-servico'); 
            carregarServicos(); 
        } catch(e) { mostrarAviso('Erro'); } 
    }); 
}

/* --- CRUD: CLIENTES E USUÁRIOS --- */

async function salvarNovoCliente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-cliente');
    setLoading(btn, true, 'Salvar');
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
            atualizarDatalistClientes();
            document.getElementById('input-cliente-nome').value = data.nome;
            fecharModal('modal-cliente');
            f.reset();
            mostrarAviso('Cliente cadastrado!');
        } else { mostrarAviso('Erro ao cadastrar.'); }
    } catch(e) { mostrarAviso('Erro de conexão.'); } 
    finally { setLoading(btn, false, 'Salvar'); }
}

async function salvarUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-usuario');
    setLoading(btn, true, 'Salvar');
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
        fecharModal('modal-usuario');
        f.reset();
        carregarUsuarios();
        mostrarAviso('Profissional adicionado!');
    } catch(e) { mostrarAviso('Erro'); } 
    finally { setLoading(btn, false, 'Salvar'); }
}

/* --- CRUD: PACOTES --- */

async function salvarVendaPacote(e) {
    e.preventDefault();
    const btn=document.getElementById('btn-salvar-pacote');
    const originalText = btn.innerText;
    setLoading(btn, true, originalText);
    const f=e.target;
    
    if (itensPacoteTemp.length === 0) {
        mostrarAviso('Adicione serviços.');
        setLoading(btn, false, originalText);
        return;
    }
    
    const cliente = clientesCache.find(c => c.nome === f.nome_cliente.value);
    if(!cliente) {
        mostrarAviso('Cliente inválido.');
        setLoading(btn, false, originalText);
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
        fecharModal('modal-vender-pacote');
        f.reset();
        mostrarAviso('Pacote vendido!');
        setTimeout(() => { carregarPacotes(); }, 1500);
    } catch(e) { mostrarAviso('Erro'); } 
    finally { setLoading(btn, false, originalText); }
}

/* --- CRUD: AGENDAMENTOS E BLOQUEIOS --- */

async function salvarAgendamentoOtimista(e) {
    e.preventDefault();
    const f = e.target;
    const nomeCliente = f.nome_cliente.value;
    const nomeServico = f.nome_servico.value;
    const dataAg = f.data_agendamento.value;
    const horaIni = f.hora_inicio.value;
    
    const cliente = clientesCache.find(c => c.nome === nomeCliente);
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase());
    
    if(!servico) { mostrarAviso('Serviço não encontrado.'); return; }
    
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
    
    agendamentosRaw.push(novoItem);
    saveToCache('agendamentos', agendamentosRaw);
    atualizarAgendaVisual();
    showSyncIndicator(true);
    
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
                atualizarAgendaVisual();
                
                const modalIdInput = document.getElementById('id-agendamento-ativo');
                if(modalIdInput && modalIdInput.value === tempId) {
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
        atualizarAgendaVisual();
        mostrarAviso('Falha ao salvar agendamento. Tente novamente.');
        showSyncIndicator(false);
    }
    f.reset();
}

async function salvarBloqueio(e) {
    e.preventDefault();
    const f = e.target;
    const motivo = f.motivo.value;
    const hora = document.getElementById('input-hora-bloqueio').value;
    const duracao = f.duracao.value;
    const dataAg = document.getElementById('input-data-modal').value;
    
    fecharModal('modal-agendamento');
    
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
    atualizarAgendaVisual();
    showSyncIndicator(true);
    
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
    } catch(e) { mostrarAviso('Erro ao salvar bloqueio'); } 
    finally { showSyncIndicator(false); }
    f.reset();
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
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ 
            action: 'updateAgendamentoDataHora', 
            id_agendamento: id, 
            data_agendamento: novaData, 
            hora_inicio: novoHorario 
        }) });
        fecharModal('modal-editar-agendamento');
        recarregarAgendaComFiltro();
        mostrarAviso('Agendamento atualizado!');
    } catch(err) { mostrarAviso('Erro.'); } 
    finally { setLoading(btn, false, originalText); }
}

function prepararStatus(st, btnEl) { 
    const id = document.getElementById('id-agendamento-ativo').value; 
    const idPacote = document.getElementById('id-pacote-agendamento-ativo').value; 
    const contentBotao = btnEl ? btnEl.innerHTML : ''; 
    
    if(String(id).startsWith('temp_')) { 
        if(btnEl) { 
            setLoading(btnEl, true, 'Sincronizando...'); 
            setTimeout(() => { setLoading(btnEl, false, contentBotao); }, 2000); 
        } 
        return; 
    } 
    
    if (st === 'Excluir') { 
        mostrarConfirmacao('Apagar Agendamento', 'Tem certeza? Saldo será devolvido.', () => executarMudancaStatusOtimista(id, st, true)); 
    } else if (st === 'Cancelado') { 
        if(idPacote) { 
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
    if(index === -1) return; 
    const backup = { ...agendamentosRaw[index] }; 
    
    if(st === 'Excluir') { agendamentosRaw.splice(index, 1); } 
    else { agendamentosRaw[index].status = st; } 
    
    saveToCache('agendamentos', agendamentosRaw); 
    atualizarAgendaVisual(); 
    showSyncIndicator(true); 
    
    try { 
        const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'updateStatusAgendamento', id_agendamento:id, novo_status:st, devolver_credito: devolver }) }); 
        const data = await res.json(); 
        if (data.status !== 'sucesso') { throw new Error(data.mensagem || 'Erro no servidor'); } 
        if(devolver) setTimeout(carregarPacotes, 1000); 
        showSyncIndicator(false); 
    } catch(e) { 
        console.error("Erro update status", e); 
        if(st === 'Excluir') agendamentosRaw.splice(index, 0, backup); 
        else agendamentosRaw[index] = backup; 
        saveToCache('agendamentos', agendamentosRaw); 
        atualizarAgendaVisual(); 
        mostrarAviso('Erro de conexão. Alteração não salva.'); 
        showSyncIndicator(false); 
    } 
}

/* --- CONFIGURAÇÕES --- */

async function salvarConfigAPI(btn) { 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
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
        renderizarGrade(); 
        mostrarAviso('Configurações salvas!'); 
    } catch(e) { mostrarAviso('Erro ao salvar.'); } 
    finally { setLoading(btn, false, originalText); } 
}