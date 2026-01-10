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

// --- RENDERIZAÇÃO DA GRADE (TIMELINE) ---

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
    isSaving = true; // Bloqueia polling
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createAgendamento', nome_cliente: nomeCliente, id_cliente: novoItem.id_cliente, id_servico: novoItem.id_servico, data_agendamento: dataAg, hora_inicio: horaIni, usar_pacote_id: novoItem.id_pacote_usado, id_profissional: profId }) });
        const data = await res.json();
        
        // Tratamento de Erro do Backend
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
        isSaving = false; // Libera polling
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

function mudarProfissionalAgenda() { 
    currentProfId = document.getElementById('select-profissional-agenda').value; 
    atualizarAgendaVisual(); 
}

// --- MODAIS DA AGENDA ---

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

// --- COMUNICAÇÃO VIA WHATSAPP ---

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
    
    const btnConf = document.getElementById('btn-confirmar');
    btnConf.disabled = false;
    btnConf.className = "w-full p-3 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm border border-blue-100 flex items-center justify-center gap-2 btn-anim";
    btnConf.innerHTML = '<i data-lucide="thumbs-up" class="w-4 h-4"></i> Confirmar Presença';
    
    const btnConc = document.getElementById('btn-concluir');
    btnConc.disabled = false;
    
    document.getElementById('id-agendamento-ativo').value = id; 
    const idPacote = ag.id_pacote_usado || ag.id_pacote || ''; 
    document.getElementById('id-pacote-agendamento-ativo').value = idPacote;
    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico)); 
    const nomeCliente = ag.nome_cliente || ag.observacoes || 'Cliente'; 
    const isConcluido = ag.status === 'Concluido';
    const isCancelado = ag.status === 'Cancelado';

    document.getElementById('detalhe-cliente').innerText = nomeCliente;
    document.getElementById('detalhe-servico').innerText = servico ? servico.nome_servico : 'Serviço';
    document.getElementById('detalhe-data').innerText = formatarDataBr(ag.data_agendamento);
    document.getElementById('detalhe-hora').innerText = `${ag.hora_inicio} - ${ag.hora_fim}`;
    
    const badge = document.getElementById('detalhe-status-badge');
    badge.innerText = ag.status || 'Agendado';
    badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase ';
    
    if(isConcluido) badge.className += 'bg-slate-200 text-slate-600';
    else if(isCancelado) badge.className += 'bg-red-100 text-red-600';
    else if(ag.status === 'Confirmado') badge.className += 'bg-green-100 text-green-700';
    else badge.className += 'bg-blue-100 text-blue-700';

    document.getElementById('btn-editar-horario').style.display = isConcluido || isCancelado ? 'none' : 'flex';
    document.getElementById('btn-cancelar').style.display = isConcluido || isCancelado ? 'none' : 'flex';
    document.getElementById('btn-excluir').style.display = isCancelado ? 'block' : 'none';

    const nBtn = btnConf.cloneNode(true);
    btnConf.parentNode.replaceChild(nBtn, btnConf);
    nBtn.onclick = () => prepararStatus('Confirmado', nBtn);
    
    if (isConcluido || isCancelado) { 
        nBtn.style.display = 'none'; 
        document.getElementById('btn-concluir').style.display = 'none'; 
    } else { 
        if (ag.status === 'Confirmado') { 
            nBtn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Já Confirmado'; 
            nBtn.className = "w-full p-3 bg-green-50 text-green-700 font-bold rounded-xl text-sm border border-green-200 flex items-center justify-center gap-2 cursor-default"; 
            nBtn.onclick = null; 
            nBtn.disabled = true; 
            nBtn.style.display = 'flex'; 
        } else { 
            nBtn.style.display = 'flex'; 
        } 
        document.getElementById('btn-concluir').style.display = 'flex'; 
    }
    
    document.getElementById('modal-detalhes').classList.add('open'); 
    lucide.createIcons(); 
}