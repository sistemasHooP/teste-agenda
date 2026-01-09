// ==========================================
// AUTENTICAÇÃO E INICIALIZAÇÃO
// ==========================================

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
            if(manter) localStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser)); 
            else sessionStorage.setItem('minhaAgendaUser', JSON.stringify(currentUser)); 
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

// ==========================================
// SINCRONIZAÇÃO DE DADOS (GET)
// ==========================================

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

        if(resConfig && resConfig.abertura) { 
            config = resConfig; 
            saveToCache('config', config); 
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
                const realItem = novosAgendamentos.find(a => 
                    a.data_agendamento === tempItem.data_agendamento && 
                    a.hora_inicio === tempItem.hora_inicio && 
                    (a.nome_cliente === tempItem.nome_cliente || (a.observacoes && a.observacoes.includes(tempItem.nome_cliente))) 
                );
                
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

// ==========================================
// OPERAÇÕES DE ESCRITA (POST)
// ==========================================

// --- AGENDAMENTOS E BLOQUEIOS ---

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
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'createAgendamento', 
                nome_cliente: nomeCliente, 
                id_cliente: novoItem.id_cliente, 
                id_servico: novoItem.id_servico, 
                data_agendamento: dataAg, 
                hora_inicio: horaIni, 
                usar_pacote_id: novoItem.id_pacote_usado, 
                id_profissional: profId 
            }) 
        });
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

async function bloquearHorarioAPI(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-bloqueio'); 
    const originalText = btn.innerText;
    setLoading(btn, true, originalText);

    const f = e.target;
    const dataBloq = f.data.value; 
    const horaBloq = f.hora.value;
    const duracao = f.duracao.value;
    const motivo = f.motivo.value;
    
    // Admin pode bloquear agenda de outros
    const profId = (currentUser.nivel === 'admin' && document.getElementById('select-prof-modal')?.value) ? document.getElementById('select-prof-modal').value : currentUser.id_usuario;

    // Atualização Otimista
    const tempId = 'blk_' + Date.now();
    const fimMin = parseInt(duracao) || 60;
    const horaFim = calcularHoraFim(horaBloq, fimMin);

    const novoItem = {
        id_agendamento: tempId,
        id_cliente: 'SYSTEM',
        id_servico: 'BLOQUEIO', // Identificador especial para a UI
        data_agendamento: dataBloq,
        hora_inicio: horaBloq,
        hora_fim: horaFim,
        status: 'Bloqueado',
        nome_cliente: motivo || 'Bloqueio', // Exibido como título do card
        observacoes: motivo,
        id_profissional: profId
    };

    agendamentosRaw.push(novoItem);
    saveToCache('agendamentos', agendamentosRaw);
    atualizarAgendaVisual();
    
    fecharModal('modal-bloqueio');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'bloquearHorario',
                data_agendamento: dataBloq,
                hora_inicio: horaBloq,
                duracao_minutos: duracao,
                motivo: motivo,
                id_profissional: profId
            })
        });
        const data = await res.json();

        if (data.status === 'sucesso' && data.id_agendamento) {
            const idx = agendamentosRaw.findIndex(a => a.id_agendamento === tempId);
            if (idx !== -1) {
                agendamentosRaw[idx].id_agendamento = data.id_agendamento;
                saveToCache('agendamentos', agendamentosRaw);
            }
            mostrarAviso('Horário bloqueado!');
        } else {
            throw new Error(data.mensagem || 'Erro ao bloquear');
        }
    } catch (err) {
        console.error(err);
        agendamentosRaw = agendamentosRaw.filter(a => a.id_agendamento !== tempId);
        saveToCache('agendamentos', agendamentosRaw);
        atualizarAgendaVisual();
        mostrarAviso('Erro ao bloquear horário.');
    } finally {
        setLoading(btn, false, originalText);
        f.reset();
    }
}

async function executarMudancaStatusOtimista(id, st, devolver) {
    fecharModal('modal-confirmacao'); 
    fecharModal('modal-detalhes');

    const index = agendamentosRaw.findIndex(a => a.id_agendamento === id); 
    if(index === -1) return; 
    const backup = { ...agendamentosRaw[index] };

    if(st === 'Excluir') { 
        agendamentosRaw.splice(index, 1); 
    } else { 
        agendamentosRaw[index].status = st; 
    } 
    
    saveToCache('agendamentos', agendamentosRaw); 
    atualizarAgendaVisual();
    showSyncIndicator(true);

    try { 
        const res = await fetch(API_URL, { 
            method:'POST', 
            body:JSON.stringify({ 
                action:'updateStatusAgendamento', 
                id_agendamento:id, 
                novo_status:st, 
                devolver_credito: devolver 
            }) 
        }); 
        const data = await res.json(); 
        
        if (data.status !== 'sucesso') { 
            throw new Error(data.mensagem || 'Erro no servidor'); 
        } 
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

async function salvarEdicaoAgendamento(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-edicao-agenda'); 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    
    const id = document.getElementById('edit-agenda-id').value; 
    const novaData = document.getElementById('edit-agenda-data').value; 
    const novoHorario = document.getElementById('edit-agenda-hora').value; 
    
    try { 
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'updateAgendamentoDataHora', 
                id_agendamento: id, 
                data_agendamento: novaData, 
                hora_inicio: novoHorario 
            }) 
        }); 
        fecharModal('modal-editar-agendamento'); 
        recarregarAgendaComFiltro(); 
        mostrarAviso('Agendamento atualizado!'); 
    } catch(err) { 
        mostrarAviso('Erro.'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

// --- CONFIGURAÇÕES ---

async function salvarConfigAPI(btn) { 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    
    const abertura = document.getElementById('cfg-abertura').value; 
    const fechamento = document.getElementById('cfg-fechamento').value; 
    const intervalo = document.getElementById('cfg-intervalo').value; 
    const encaixe = document.getElementById('cfg-concorrencia').checked; 
    const msgLembrete = document.getElementById('cfg-lembrete-template').value;
    const msgsRapidas = config.mensagens_rapidas;
    // Captura os horários semanais atualizados que foram modificados em memória (js/ui.js)
    const horariosSemanais = config.horarios_semanais;

    try { 
        await fetch(API_URL, {method:'POST', body:JSON.stringify({ 
            action: 'saveConfig', 
            abertura: abertura, 
            fechamento: fechamento, 
            intervalo_minutos: intervalo, 
            permite_encaixe: encaixe,
            mensagem_lembrete: msgLembrete,
            mensagens_rapidas: msgsRapidas,
            horarios_semanais: horariosSemanais 
        })}); 
        
        config.abertura = abertura;
        config.fechamento = fechamento;
        config.intervalo_minutos = parseInt(intervalo);
        config.permite_encaixe = encaixe;
        config.mensagem_lembrete = msgLembrete;
        
        saveToCache('config', config);
        renderizarGrade(); 
        mostrarAviso('Configurações salvas!'); 
    } catch(e) { 
        mostrarAviso('Erro ao salvar.'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

// --- PACOTES ---

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
    } catch(e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

// --- USUÁRIOS E CLIENTES ---

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
    } catch(e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, 'Salvar'); 
    } 
}

async function salvarEdicaoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-edicao-usuario');
    const originalText = btn.innerText;
    setLoading(btn, true, originalText);

    const f = e.target;
    
    try {
        await fetch(API_URL, {method:'POST', body:JSON.stringify({
            action: 'updateUsuario',
            id_usuario: f.id_usuario.value,
            nome: f.nome.value,
            email: f.email.value,
            senha: f.senha.value,
            nivel: f.nivel.value,
            cor: f.cor.value
        })});

        fecharModal('modal-editar-usuario');
        carregarUsuarios();
        mostrarAviso('Profissional atualizado!');
    } catch(e) {
        mostrarAviso('Erro ao atualizar.');
    } finally {
        setLoading(btn, false, originalText);
    }
}

async function excluirUsuarioViaModal() {
    const id = document.getElementById('edit-id-usuario').value;
    
    if(String(id) === String(currentUser.id_usuario)) {
        mostrarAviso("Você não pode excluir seu próprio usuário.");
        return;
    }

    mostrarConfirmacao('Excluir Profissional', 'Tem certeza? Isso não apaga os agendamentos dele.', async () => {
        try {
            await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'deleteUsuario', id_usuario: id})});
            fecharModal('modal-confirmacao');
            fecharModal('modal-editar-usuario');
            carregarUsuarios();
            mostrarAviso('Profissional removido.');
        } catch(e) {
            mostrarAviso('Erro ao excluir.');
        }
    });
}

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
        } else { 
            mostrarAviso('Erro ao cadastrar.'); 
        } 
    } catch(e) { 
        mostrarAviso('Erro de conexão.'); 
    } finally { 
        setLoading(btn, false, 'Salvar'); 
    } 
}

async function salvarEdicaoCliente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-edicao-cliente');
    const originalText = btn.innerText;
    setLoading(btn, true, originalText);

    const f = e.target;

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateCliente',
                id_cliente: f.id_cliente.value,
                nome: f.nome.value,
                whatsapp: f.whatsapp.value,
                email: f.email.value
            })
        });
        
        const data = await res.json();

        if (data.status === 'sucesso') {
            const idx = clientesCache.findIndex(c => String(c.id_cliente) === String(f.id_cliente.value));
            if (idx !== -1) {
                clientesCache[idx].nome = f.nome.value;
                clientesCache[idx].whatsapp = f.whatsapp.value;
                clientesCache[idx].email = f.email.value;
            }
            
            atualizarDatalistClientes();
            if (abaAtiva === 'clientes') {
                renderizarListaClientes(document.getElementById('busca-cliente').value);
            }

            fecharModal('modal-editar-cliente');
            mostrarAviso('Cliente atualizado!');
        } else {
            mostrarAviso(data.mensagem || 'Erro ao atualizar.');
        }
    } catch (err) {
        mostrarAviso('Erro de conexão.');
    } finally {
        setLoading(btn, false, originalText);
    }
}

// --- SERVIÇOS ---

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
    } catch(e){ 
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
    } catch(e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

async function excluirServicoViaModal(){ 
    const id=document.getElementById('edit-id-servico').value; 
    mostrarConfirmacao('Excluir Serviço', 'Tem certeza?', async () => { 
        try { 
            await fetch(API_URL, {method:'POST', body:JSON.stringify({action:'deleteServico', id_servico: id})}); 
            fecharModal('modal-confirmacao'); 
            fecharModal('modal-editar-servico'); 
            carregarServicos(); 
        } catch(e) { 
            mostrarAviso('Erro'); 
        } 
    }); 
}
