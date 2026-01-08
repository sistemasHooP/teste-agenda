/* --- UI HELPERS --- */

function setLoading(btn, l, t) {
    btn.disabled = l;
    if (l) {
        const isDarkBg = btn.classList.contains('btn-primary') || btn.classList.contains('bg-blue-600') || btn.classList.contains('bg-red-600') || btn.classList.contains('bg-slate-700');
        const spinnerType = isDarkBg ? 'spinner' : 'spinner spinner-dark';
        btn.innerHTML = `<span class="${spinnerType}"></span>`;
    } else {
        btn.innerHTML = t;
    }
}

function mostrarAviso(msg) {
    document.getElementById('aviso-msg').innerText = msg;
    document.getElementById('modal-aviso').classList.add('open');
}

function fecharModal(id) {
    document.getElementById(id).classList.remove('open');
    if(id==='modal-agendamento') document.getElementById('area-pacote-info')?.classList.add('hidden');
}

function mostrarConfirmacao(t, m, yesCb, noCb, yesTxt='Sim', noTxt='Cancelar') {
    document.getElementById('confirm-titulo').innerText = t;
    document.getElementById('confirm-msg').innerText = m;
    const oldY = document.getElementById('btn-confirm-yes');
    const oldN = document.getElementById('btn-confirm-no');
    const newY = oldY.cloneNode(true);
    const newN = oldN.cloneNode(true);
    newY.innerText = yesTxt;
    newN.innerText = noTxt;
    newY.disabled = false;
    newN.disabled = false;
    oldY.parentNode.replaceChild(newY, oldY);
    oldN.parentNode.replaceChild(newN, oldN);
    newY.onclick = () => { yesCb(); };
    newN.onclick = () => { fecharModal('modal-confirmacao'); if(noCb) noCb(); };
    document.getElementById('modal-confirmacao').classList.add('open');
}

function showSyncIndicator(show) {
    // isSyncing está em api.js
    isSyncing = show;
    document.getElementById('sync-indicator').style.display = show ? 'flex' : 'none';
}

/* --- NAVEGAÇÃO E ABAS --- */

let abaAtiva = 'agenda'; // Variável de estado local para UI

function switchTab(t, el) {
    abaAtiva = t;
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById(`tab-${t}`).classList.add('active');
    document.getElementById('main-fab').style.display = t==='config'?'none':'flex';
    
    // Funções de carregamento de api.js
    if (t === 'pacotes') carregarPacotes();
    if (t === 'config') atualizarUIConfig();
}

function switchConfigTab(tab) {
    document.getElementById('cfg-area-geral').classList.add('hidden');
    document.getElementById('cfg-area-msg').classList.add('hidden');
    document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    
    if(tab === 'geral') {
        document.getElementById('cfg-area-geral').classList.remove('hidden');
        document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    } else {
        document.getElementById('cfg-area-msg').classList.remove('hidden');
        document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    }
}

function acaoFab() {
    if(abaAtiva==='servicos') abrirModalServico();
    else if(abaAtiva==='agenda') abrirModalAgendamento();
    else if(abaAtiva==='pacotes') abrirModalVenderPacote();
    else if(abaAtiva==='equipa') abrirModalUsuario();
}

/* --- CONTROLE DE DATA E PAINEL --- */

function mudarSemana(d) {
    dataAtual.setDate(dataAtual.getDate() + (d * 7));
    atualizarDataEPainel();
}

function selecionarDia(dataIso) {
    const parts = dataIso.split('-');
    dataAtual = new Date(parts[0], parts[1]-1, parts[2]);
    atualizarDataEPainel();
}

function atualizarDataEPainel() {
    document.getElementById('data-picker').value = dataAtual.toISOString().split('T')[0];
    document.getElementById('mes-ano-display').innerText = dataAtual.toLocaleDateString('pt-PT', {month:'long', year:'numeric'});
    renderizarBarraSemanal();
    atualizarAgendaVisual();
}

/* --- RENDERIZADORES DE AGENDA --- */

function renderizarBarraSemanal() {
    const container = document.getElementById('barra-dias-semana');
    container.innerHTML = '';
    const current = new Date(dataAtual);
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - current.getDay());
    
    const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const hojeStr = new Date().toISOString().split('T')[0];
    const selecionadoStr = dataAtual.toISOString().split('T')[0];
    
    for(let i=0; i<7; i++) {
        const dia = new Date(startOfWeek);
        dia.setDate(startOfWeek.getDate() + i);
        const diaIso = dia.toISOString().split('T')[0];
        const diaNum = dia.getDate();
        const diaNome = diasSemana[i];
        
        const div = document.createElement('div');
        div.className = 'calendar-day-item';
        if (diaIso === selecionadoStr) div.classList.add('selected');
        else if (diaIso === hojeStr) div.classList.add('is-today');
        
        div.onclick = () => selecionarDia(diaIso);
        div.innerHTML = `<span class="day-name">${diaNome}</span><span class="day-number">${diaNum}</span>`;
        container.appendChild(div);
    }
}

function renderizarGrade() {
    const container = document.getElementById('agenda-timeline');
    if(!container) return;
    container.innerHTML = '';
    
    const diaSemanaIndex = dataAtual.getDay();
    const horarioDia = (config.horarios_semanais && config.horarios_semanais[diaSemanaIndex]) ? config.horarios_semanais[diaSemanaIndex] : { ativo: true, inicio: '08:00', fim: '19:00' };
    
    if (!horarioDia.ativo) {
        container.innerHTML = `<div class="p-10 text-center text-slate-400 flex flex-col items-center"><i data-lucide="store" class="w-12 h-12 mb-2 text-slate-300"></i><p>Comércio Fechado</p></div>`;
        lucide.createIcons();
        return;
    }
    
    const [hA, mA] = horarioDia.inicio.split(':').map(Number);
    const [hF, mF] = horarioDia.fim.split(':').map(Number);
    const startMin = hA*60 + mA;
    const endMin = hF*60 + mF;
    const interval = parseInt(config.intervalo_minutos) || 60;
    const dateIso = dataAtual.toISOString().split('T')[0];
    
    for(let m = startMin; m < endMin; m += interval) {
        const hSlot = Math.floor(m/60);
        const mSlot = m % 60;
        const timeStr = `${String(hSlot).padStart(2,'0')}:${String(mSlot).padStart(2,'0')}`;
        const div = document.createElement('div');
        div.className = 'time-slot';
        div.style.height = '80px';
        div.innerHTML = `<div class="time-label">${timeStr}</div><div class="slot-content" id="slot-${m}"><div class="slot-livre-area" onclick="abrirModalAgendamento('${timeStr}')"></div></div>`;
        container.appendChild(div);
    }
    
    const events = agendamentosCache.filter(a => a.data_agendamento === dateIso && a.hora_inicio).map(a => {
        const [h, m] = a.hora_inicio.split(':').map(Number);
        const start = h*60 + m;
        const svc = servicosCache.find(s => String(s.id_servico) === String(a.id_servico));
        let dur = 60;
        if(a.status === 'Bloqueado') {
            const [hf, mf] = a.hora_fim ? a.hora_fim.split(':').map(Number) : [h+1, m];
            dur = (hf*60 + mf) - start;
        } else {
            dur = svc ? parseInt(svc.duracao_minutos) : 60;
        }
        return { ...a, start, end: start + dur, dur, svc };
    }).sort((a,b) => a.start - b.start);
    
    events.forEach(ev => {
        if(ev.start < startMin) return;
        const offset = (ev.start - startMin) % interval;
        const slotBase = ev.start - offset;
        const slotEl = document.getElementById(`slot-${slotBase}`);
        if(!slotEl) return;
        
        const height = (ev.dur / interval) * 80;
        const top = (offset / interval) * 80;
        
        const card = document.createElement('div');
        card.className = 'event-card';
        card.style.top = `${top + 2}px`;
        card.style.height = `calc(${height}px - 4px)`;
        card.style.left = `2px`;
        card.style.width = `calc(100% - 4px)`;
        
        if (ev.status === 'Bloqueado') {
            card.classList.add('status-bloqueado');
            card.innerHTML = `<i data-lucide="lock" class="w-4 h-4 mr-1"></i><span class="font-bold text-[10px] truncate">${ev.nome_cliente || 'Bloqueado'}</span>`;
            card.onclick = (e) => { e.stopPropagation(); abrirModalDetalhes(ev.id_agendamento); };
        } else {
            const color = getCorServico(ev.svc);
            card.style.backgroundColor = hexToRgba(color, 0.15);
            card.style.borderLeftColor = color;
            card.style.color = '#1e293b';
            let statusIcon = '';
            if(ev.status === 'Confirmado') {
                statusIcon = '<div class="absolute top-1 right-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>';
                card.classList.add('status-confirmado');
            } else if (ev.status === 'Concluido') card.classList.add('status-concluido');
            else if (ev.status === 'Cancelado') card.classList.add('status-cancelado');
            else card.style.borderLeftColor = color;
            
            card.onclick = (e) => { e.stopPropagation(); abrirModalDetalhes(ev.id_agendamento); };
            const name = ev.nome_cliente || ev.observacoes || 'Cliente';
            card.innerHTML = `<div style="width:90%" class="font-bold truncate text-[10px]">${name}</div>${height > 25 ? `<div class="text-xs truncate">${ev.hora_inicio} • ${ev.svc ? ev.svc.nome_servico : 'Serviço'}</div>` : ''}`;
        }
        slotEl.appendChild(card);
    });
    lucide.createIcons();
}

function atualizarAgendaVisual() {
    if (!agendamentosRaw) return;
    const filtroId = String(currentProfId);
    agendamentosCache = agendamentosRaw.filter(a => {
        const aId = a.id_profissional ? String(a.id_profissional) : '';
        if (currentUser.nivel === 'admin') { return aId === filtroId; }
        else { return aId === String(currentUser.id_usuario); }
    });
    renderizarGrade();
}

/* --- RENDERIZADORES DE LISTAS E CONFIG --- */

function atualizarUIConfig() {
    document.getElementById('cfg-intervalo').value = config.intervalo_minutos;
    document.getElementById('cfg-concorrencia').checked = config.permite_encaixe;
    document.getElementById('cfg-lembrete-template').value = config.mensagem_lembrete || "Olá {cliente}, seu agendamento é dia {data} às {hora}.";
    
    const container = document.getElementById('lista-horarios-semana');
    container.innerHTML = '';
    const diasNome = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    if (!config.horarios_semanais || config.horarios_semanais.length === 0) {
        config.horarios_semanais = [];
        for(let i=0; i<7; i++) config.horarios_semanais.push({ dia: i, ativo: i!==0, inicio: config.abertura || '08:00', fim: config.fechamento || '19:00' });
    }
    
    config.horarios_semanais.forEach((dia, idx) => {
        const div = document.createElement('div');
        div.className = 'bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2';
        div.innerHTML = `<div class="flex justify-between items-center"><span class="font-bold text-slate-700 text-sm">${diasNome[idx]}</span><label class="toggle-switch"><input type="checkbox" onchange="toggleDiaSemana(${idx}, this.checked)" ${dia.ativo ? 'checked' : ''}><span class="slider"></span></label></div><div class="grid grid-cols-2 gap-2 ${dia.ativo ? '' : 'hidden'}" id="horarios-dia-${idx}"><input type="time" value="${dia.inicio}" onchange="updateHorarioDia(${idx}, 'inicio', this.value)" class="p-2 text-sm bg-white border rounded outline-none"><input type="time" value="${dia.fim}" onchange="updateHorarioDia(${idx}, 'fim', this.value)" class="p-2 text-sm bg-white border rounded outline-none"></div>`;
        container.appendChild(div);
    });
    
    renderizarListaMsgRapidasConfig();
}

function toggleDiaSemana(idx, ativo) {
    config.horarios_semanais[idx].ativo = ativo;
    document.getElementById(`horarios-dia-${idx}`).classList.toggle('hidden', !ativo);
}

function updateHorarioDia(idx, campo, valor) {
    config.horarios_semanais[idx][campo] = valor;
}

function renderizarListaMsgRapidasConfig() {
    const div = document.getElementById('lista-msg-rapidas');
    div.innerHTML = '';
    if(!config.mensagens_rapidas) config.mensagens_rapidas = [];
    config.mensagens_rapidas.forEach((msg, idx) => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200';
        item.innerHTML = ` <span class="text-xs text-slate-600 truncate flex-1 mr-2">${msg}</span> <button onclick="removerMsgRapida(${idx})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button> `;
        div.appendChild(item);
    });
    lucide.createIcons();
}

function adicionarMsgRapida() {
    const input = document.getElementById('nova-msg-rapida');
    const val = input.value.trim();
    if(!val) return;
    if(!config.mensagens_rapidas) config.mensagens_rapidas = [];
    config.mensagens_rapidas.push(val);
    input.value = '';
    renderizarListaMsgRapidasConfig();
}

function removerMsgRapida(idx) {
    config.mensagens_rapidas.splice(idx, 1);
    renderizarListaMsgRapidasConfig();
}

function atualizarDatalistServicos() { const dl = document.getElementById('lista-servicos-datalist'); if(dl) { dl.innerHTML = ''; servicosCache.forEach(i=>{ const o=document.createElement('option'); o.value=i.nome_servico; dl.appendChild(o); }); } }
function atualizarDatalistClientes() { const dl = document.getElementById('lista-clientes'); if(dl) { dl.innerHTML = ''; clientesCache.forEach(c=>{ const o=document.createElement('option'); o.value=c.nome; dl.appendChild(o); }); } }

function popularSelectsUsuarios() { 
    const selectHeader = document.getElementById('select-profissional-agenda'); 
    selectHeader.innerHTML = ''; 
    const optMe = document.createElement('option'); 
    optMe.value = currentUser.id_usuario; 
    optMe.text = "Minha Agenda"; 
    selectHeader.appendChild(optMe); 
    
    usuariosCache.forEach(u => { 
        if (u.id_usuario !== currentUser.id_usuario) { 
            const opt = document.createElement('option'); 
            opt.value = u.id_usuario; 
            opt.text = u.nome; 
            selectHeader.appendChild(opt); 
        } 
    }); 
    
    const selectModal = document.getElementById('select-prof-modal'); 
    selectModal.innerHTML = ''; 
    const optMeModal = document.createElement('option'); 
    optMeModal.value = currentUser.id_usuario; 
    optMeModal.text = currentUser.nome + " (Eu)"; 
    selectModal.appendChild(optMeModal); 
    
    usuariosCache.forEach(u => { 
        if (u.id_usuario !== currentUser.id_usuario) { 
            const opt = document.createElement('option'); 
            opt.value = u.id_usuario; 
            opt.text = u.nome; 
            selectModal.appendChild(opt); 
        } 
    }); 
}

function renderizarListaServicos() { const container = document.getElementById('lista-servicos'); container.innerHTML = ''; servicosCache.forEach(s => { const div = document.createElement('div'); div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center'; div.innerHTML = `<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background-color: ${getCorServico(s)}">${s.nome_servico.charAt(0)}</div><div><h4 class="font-bold text-slate-800">${s.nome_servico}</h4><p class="text-xs text-slate-500">${s.duracao_minutos} min • R$ ${parseFloat(s.valor_unitario).toFixed(2)}</p></div></div><button onclick="abrirModalEditarServico('${s.id_servico}')" class="text-slate-400 hover:text-blue-600"><i data-lucide="edit-2" class="w-5 h-5"></i></button>`; container.appendChild(div); }); lucide.createIcons(); }
function renderizarListaPacotes() { const container = document.getElementById('lista-pacotes'); container.innerHTML = ''; if(!pacotesCache || pacotesCache.length === 0) { container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum pacote ativo.</div>'; return; } pacotesCache.forEach(p => { const div = document.createElement('div'); div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100'; div.innerHTML = `<div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-slate-800">${p.nome_cliente}</h4><p class="text-xs text-slate-500">${p.nome_servico}</p></div><span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">${p.qtd_restante}/${p.qtd_total}</span></div><div class="w-full bg-slate-100 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full" style="width: ${(p.qtd_restante/p.qtd_total)*100}%"></div></div>`; container.appendChild(div); }); }
function renderizarListaUsuarios() { const container = document.getElementById('lista-usuarios'); container.innerHTML = ''; usuariosCache.forEach(u => { const div = document.createElement('div'); div.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"; div.innerHTML = `<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">${u.nome.charAt(0)}</div><div><h4 class="font-bold text-slate-800">${u.nome}</h4><p class="text-xs text-slate-400 capitalize">${u.nivel}</p></div></div>`; container.appendChild(div); }); }

function renderizarColorPicker() { const c=document.getElementById('color-picker-container'); c.innerHTML=''; PALETA_CORES.forEach((cor,i)=>{const d=document.createElement('div');d.className=`color-option ${i===4?'selected':''}`;d.style.backgroundColor=cor;d.onclick=()=>{document.querySelectorAll('.color-option').forEach(el=>el.classList.remove('selected'));d.classList.add('selected');document.getElementById('input-cor-selecionada').value=cor};c.appendChild(d)})}
function renderizarColorPickerEdicao() { const c=document.getElementById('edit-color-picker-container'); c.innerHTML=''; PALETA_CORES.forEach((cor,i)=>{const d=document.createElement('div');d.className=`color-option ${i===4?'selected':''}`;d.style.backgroundColor=cor;d.onclick=()=>{document.querySelectorAll('#edit-color-picker-container .color-option').forEach(el=>el.classList.remove('selected'));d.classList.add('selected');document.getElementById('edit-input-cor-selecionada').value=cor};c.appendChild(d)})}

/* --- INTERAÇÕES DE PACOTE E MODAIS --- */

// Variável temporária para criação de pacotes (movida do global para cá pois é UI state)
let itensPacoteTemp = [];

function mudarProfissionalAgenda() { 
    currentProfId = document.getElementById('select-profissional-agenda').value; 
    atualizarAgendaVisual(); 
}

function adicionarItemAoPacote() { 
    const nomeServico = document.getElementById('input-servico-pacote-nome').value; 
    const qtdInput = document.getElementById('qtd-servico-pacote'); 
    const qtd = parseInt(qtdInput.value); 
    if(!nomeServico || qtd < 1) return; 
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); 
    if(!servico) { mostrarAviso('Serviço não encontrado na lista.'); return; } 
    const subtotal = (parseFloat(servico.valor_unitario || 0) * qtd); 
    itensPacoteTemp.push({ id_servico: servico.id_servico, nome_servico: servico.nome_servico, valor_unitario: servico.valor_unitario, qtd: qtd, subtotal: subtotal }); 
    atualizarListaVisualPacote(); 
    atualizarTotalSugerido(); 
    document.getElementById('input-servico-pacote-nome').value = ""; 
    qtdInput.value = "1"; 
}

function atualizarListaVisualPacote() { 
    const container = document.getElementById('lista-itens-pacote'); 
    container.innerHTML = ''; 
    if(itensPacoteTemp.length === 0) { container.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Nenhum item adicionado.</p>'; return; } 
    itensPacoteTemp.forEach((item, index) => { 
        const div = document.createElement('div'); 
        div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-sm'; 
        const subtotalFmt = item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
        div.innerHTML = ` <div class="flex-1"> <div class="flex justify-between items-center"> <span class="font-medium text-slate-700">${item.qtd}x ${item.nome_servico}</span> <span class="text-xs text-slate-500 font-medium ml-2">= ${subtotalFmt}</span> </div> </div> <button type="button" onclick="removerItemPacote(${index})" class="ml-3 text-red-400 hover:text-red-600 btn-anim"><i data-lucide="trash-2" class="w-4 h-4"></i></button> `; 
        container.appendChild(div); 
    }); 
    lucide.createIcons(); 
}

function removerItemPacote(index) { itensPacoteTemp.splice(index, 1); atualizarListaVisualPacote(); atualizarTotalSugerido(); }
function atualizarTotalSugerido() { const total = itensPacoteTemp.reduce((acc, item) => acc + item.subtotal, 0); document.getElementById('valor-total-pacote').value = total.toFixed(2); }

function verificarPacoteDisponivel() { 
    const nomeCliente = document.getElementById('input-cliente-nome').value; 
    const nomeServico = document.getElementById('input-servico-nome').value; 
    const areaInfo = document.getElementById('area-pacote-info'); 
    const checkbox = document.getElementById('check-usar-pacote'); 
    const inputIdPacote = document.getElementById('id-pacote-selecionado'); 
    areaInfo.classList.add('hidden'); 
    inputIdPacote.value = ''; 
    checkbox.checked = false; 
    if(!nomeCliente || !nomeServico) return; 
    const cliente = clientesCache.find(c => c.nome.toLowerCase() === nomeCliente.toLowerCase()); 
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); 
    if(!cliente || !servico) return; 
    const pacote = pacotesCache.find(p => String(p.id_cliente) === String(cliente.id_cliente) && String(p.id_servico) === String(servico.id_servico) && parseInt(p.qtd_restante) > 0); 
    if(pacote) { 
        areaInfo.classList.remove('hidden'); 
        areaInfo.classList.add('flex'); 
        document.getElementById('pacote-saldo').innerText = pacote.qtd_restante; 
        inputIdPacote.value = pacote.id_pacote; 
        checkbox.checked = true; 
    } 
}

function abrirDetalhesPacote(grupo) { 
    const modal = document.getElementById('modal-detalhes-pacote'); 
    const divSaldos = document.getElementById('tab-modal-saldos'); 
    const divHist = document.getElementById('tab-modal-historico'); 
    divSaldos.innerHTML = ''; 
    divHist.innerHTML = ''; 
    const idsPacotesDoGrupo = grupo.itens.map(i => String(i.id_pacote)); 
    grupo.itens.forEach(item => { 
        const servico = servicosCache.find(s => String(s.id_servico) === String(item.id_servico)); 
        const nome = servico ? servico.nome_servico : 'Serviço'; 
        const percent = (item.qtd_restante / item.qtd_total) * 100; 
        divSaldos.innerHTML += `<div class="mb-2"><div class="flex justify-between text-sm mb-1"><span class="text-slate-700 font-medium">${nome}</span><span class="text-blue-600 font-bold">${item.qtd_restante}/${item.qtd_total}</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width: ${percent}%"></div></div></div>`; 
    }); 
    const historico = agendamentosCache.filter(ag => { const idUsado = String(ag.id_pacote_usado || ag.id_pacote || ''); return idsPacotesDoGrupo.includes(idUsado); }); 
    if (historico.length === 0) { divHist.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Nenhum uso registrado hoje.</p>'; } 
    else { 
        historico.forEach(h => { 
            const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico)); 
            const nomeServico = servico ? servico.nome_servico : 'Serviço'; 
            const statusClass = h.status === 'Concluido' ? 'text-green-600' : (h.status === 'Cancelado' ? 'text-red-400 line-through' : 'text-blue-600'); 
            divHist.innerHTML += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-sm"><div><p class="font-bold text-slate-700">${formatarDataBr(h.data_agendamento)} <span class="font-normal text-xs text-slate-400">${h.hora_inicio}</span></p><p class="text-xs text-slate-500">${nomeServico}</p></div><span class="text-xs font-bold uppercase ${statusClass}">${h.status}</span></div>`; 
        }); 
    } 
    modal.classList.add('open'); 
}

function switchModalAgendaTab(mode) { 
    document.querySelectorAll('.tab-agenda-mode').forEach(el => el.classList.add('hidden')); 
    document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('active')); 
    document.getElementById(`form-${mode}`).classList.remove('hidden'); 
    document.getElementById(`tab-btn-${mode}`).classList.add('active'); 
}

function abrirModalAgendamento(h) { 
    document.getElementById('modal-agendamento').classList.add('open'); 
    const dataIso = dataAtual.toISOString().split('T')[0]; 
    document.getElementById('input-data-modal').value = dataIso; 
    if(h) { 
        document.getElementById('input-hora-modal').value = h; 
        document.getElementById('input-hora-bloqueio').value = h; 
    } 
    switchModalAgendaTab('agendar'); 
    if(currentUser.nivel==='admin'){ 
        document.getElementById('div-select-prof-modal').classList.remove('hidden'); 
        document.getElementById('select-prof-modal').value=currentProfId; 
    } else { 
        document.getElementById('div-select-prof-modal').classList.add('hidden'); 
    } 
}

function abrirModalDetalhes(id) { 
    const ag = agendamentosCache.find(a => a.id_agendamento === id); 
    if(!ag) return; 
    resetarBotoesModal(); 
    document.getElementById('id-agendamento-ativo').value = id; 
    document.getElementById('id-pacote-agendamento-ativo').value = ag.id_pacote_usado || ''; 
    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico)); 
    const nomeCliente = ag.nome_cliente || 'Cliente'; 
    const isConcluido = ag.status === 'Concluido'; 
    const isCancelado = ag.status === 'Cancelado'; 
    const isBloqueio = ag.status === 'Bloqueado'; 
    document.getElementById('detalhe-cliente').innerText = nomeCliente; 
    document.getElementById('detalhe-servico').innerText = isBloqueio ? 'Bloqueio de Agenda' : (servico ? servico.nome_servico : 'Serviço'); 
    document.getElementById('detalhe-data').innerText = formatarDataBr(ag.data_agendamento); 
    document.getElementById('detalhe-hora').innerText = `${ag.hora_inicio} - ${ag.hora_fim}`; 
    const badge = document.getElementById('detalhe-status-badge'); 
    badge.innerText = ag.status || 'Agendado'; 
    badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase '; 
    if(isConcluido) badge.className += 'bg-slate-200 text-slate-600'; 
    else if(isCancelado) badge.className += 'bg-red-100 text-red-600'; 
    else if(isBloqueio) badge.className += 'bg-slate-300 text-slate-600'; 
    else if(ag.status === 'Confirmado') badge.className += 'bg-green-100 text-green-700'; 
    else badge.className += 'bg-blue-100 text-blue-700'; 
    document.getElementById('acoes-whatsapp-area').style.display = isBloqueio ? 'none' : 'block'; 
    document.getElementById('btn-editar-horario').style.display = isConcluido || isCancelado ? 'none' : 'flex'; 
    document.getElementById('btn-cancelar').style.display = isConcluido || isCancelado || isBloqueio ? 'none' : 'flex'; 
    if(isBloqueio) { 
        const btnExcluir = document.getElementById('btn-excluir'); 
        btnExcluir.style.display = 'block'; 
        btnExcluir.innerText = "Remover Bloqueio"; 
        document.getElementById('btn-confirmar').style.display = 'none'; 
        document.getElementById('btn-concluir').style.display = 'none'; 
    } else { 
        document.getElementById('btn-excluir').style.display = isCancelado ? 'block' : 'none'; 
        document.getElementById('btn-excluir').innerText = "Apagar Permanentemente"; 
        if (!isConcluido && !isCancelado) { 
            document.getElementById('btn-confirmar').style.display = 'flex'; 
            document.getElementById('btn-concluir').style.display = 'flex'; 
        } else { 
            document.getElementById('btn-confirmar').style.display = 'none'; 
            document.getElementById('btn-concluir').style.display = 'none'; 
        } 
    } 
    document.getElementById('modal-detalhes').classList.add('open'); 
    lucide.createIcons(); 
}

function resetarBotoesModal() { 
    const btnConf = document.getElementById('btn-confirmar'); 
    btnConf.disabled = false; 
    btnConf.className = "w-full p-3 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm border border-blue-100 flex items-center justify-center gap-2 btn-anim"; 
    btnConf.innerHTML = '<i data-lucide="thumbs-up" class="w-4 h-4"></i> Confirmar Presença'; 
    const btnConc = document.getElementById('btn-concluir'); 
    btnConc.disabled = false; 
}

function abrirModalCliente() { document.getElementById('modal-cliente').classList.add('open'); }
function abrirModalServico() { document.getElementById('modal-servico').classList.add('open'); }
function abrirModalVenderPacote() { itensPacoteTemp=[]; atualizarListaVisualPacote(); document.getElementById('input-servico-pacote-nome').value=''; document.getElementById('valor-total-pacote').value=''; document.getElementById('modal-vender-pacote').classList.add('open'); }
function abrirModalUsuario() { document.getElementById('modal-usuario').classList.add('open'); }

function abrirModalEditarAgendamento() { 
    const id=document.getElementById('id-agendamento-ativo').value; 
    const ag=agendamentosCache.find(x=>x.id_agendamento===id); 
    if(!ag)return; 
    fecharModal('modal-detalhes'); 
    document.getElementById('edit-agenda-id').value=id; 
    document.getElementById('edit-agenda-cliente').innerText=ag.nome_cliente; 
    const svc=servicosCache.find(s=>String(s.id_servico)===String(ag.id_servico)); 
    document.getElementById('edit-agenda-servico').innerText=svc?svc.nome_servico:'Serviço'; 
    document.getElementById('edit-agenda-data').value=ag.data_agendamento; 
    document.getElementById('edit-agenda-hora').value=ag.hora_inicio; 
    document.getElementById('modal-editar-agendamento').classList.add('open'); 
}

function abrirModalEditarServico(id) { 
    const s=servicosCache.find(x=>x.id_servico===id); 
    if(!s)return; 
    document.getElementById('edit-id-servico').value=s.id_servico; 
    document.getElementById('edit-nome-servico').value=s.nome_servico; 
    document.getElementById('edit-valor-servico').value=s.valor_unitario; 
    document.getElementById('edit-duracao-servico').value=s.duracao_minutos; 
    document.getElementById('edit-check-online-booking').checked=String(s.agendamento_online)==='true'; 
    document.getElementById('edit-input-cor-selecionada').value=getCorServico(s); 
    renderizarColorPickerEdicao(); 
    document.getElementById('modal-editar-servico').classList.add('open'); 
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

function getWhatsappCliente(idAgendamento) {
    const ag = agendamentosCache.find(a => a.id_agendamento === idAgendamento);
    if (!ag) return null;
    
    // Tenta encontrar cliente pelo ID se disponível, senão pelo nome
    let cliente = null;
    if (ag.id_cliente && ag.id_cliente !== 'cli_temp') {
        cliente = clientesCache.find(c => String(c.id_cliente) === String(ag.id_cliente));
    } else {
        cliente = clientesCache.find(c => c.nome === ag.nome_cliente);
    }
    
    if (cliente && cliente.whatsapp) {
        return cliente.whatsapp.replace(/\D/g, ''); // Remove caracteres não numéricos
    }
    return null;
}

/* --- FUNÇÕES ADICIONADAS PARA ENVIO DE WHATSAPP --- */

function enviarLembrete() {
    const id = document.getElementById('id-agendamento-ativo').value;
    const ag = agendamentosCache.find(a => a.id_agendamento === id);
    if (!ag) return;

    const numero = getWhatsappCliente(id);
    if (!numero) {
        mostrarAviso('Cliente sem WhatsApp cadastrado.');
        return;
    }

    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico));
    const nomeServico = servico ? servico.nome_servico : 'Serviço';
    
    // Formata a mensagem usando o template da configuração
    let msg = config.mensagem_lembrete || "Olá {cliente}, seu agendamento é dia {data} às {hora}.";
    msg = msg.replace('{cliente}', ag.nome_cliente)
             .replace('{data}', formatarDataBr(ag.data_agendamento))
             .replace('{hora}', ag.hora_inicio)
             .replace('{servico}', nomeServico);

    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
}

function abrirChatDireto() {
    const id = document.getElementById('id-agendamento-ativo').value;
    const numero = getWhatsappCliente(id);
    
    if(!numero) { 
        mostrarAviso('Cliente sem WhatsApp cadastrado.'); 
        return; 
    }
    
    window.open(`https://wa.me/${numero}`, '_blank');
}
