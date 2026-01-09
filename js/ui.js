// Variável local para controlar qual cliente está sendo visualizado no histórico
let currentHistoricoClienteId = null;

// ==========================================
// HELPERS (DATA LOCAL)
// ==========================================
// Resolve o problema do fuso horário que fazia aparecer o dia seguinte à noite
function getLocalISODate(date) {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
}

// ==========================================
// MENU LATERAL (SIDEBAR)
// ==========================================
function toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    
    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        overlay.classList.remove('open');
        setTimeout(() => overlay.style.display = 'none', 300);
    } else {
        overlay.style.display = 'block';
        void overlay.offsetWidth; // Força reflow
        menu.classList.add('open');
        overlay.classList.add('open');
        
        if(currentUser) {
            document.getElementById('menu-user-name').innerText = currentUser.nome;
            document.getElementById('menu-user-email').innerText = currentUser.email;
        }
    }
}

// ==========================================
// NAVEGAÇÃO E ABAS
// ==========================================
function switchTab(t, el) { 
    abaAtiva = t; 
    
    document.querySelectorAll('.menu-item').forEach(i=>i.classList.remove('active'));
    if(el) el.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); 
    document.getElementById(`tab-${t}`).classList.add('active'); 
    
    const titles = {
        'agenda': 'Minha Agenda',
        'clientes': 'Meus Clientes',
        'servicos': 'Serviços',
        'pacotes': 'Pacotes',
        'equipa': 'Equipe',
        'config': 'Configurações'
    };
    document.getElementById('header-title').innerText = titles[t] || 'Minha Agenda';

    const fab = document.getElementById('main-fab');
    if (t === 'config') fab.style.display = 'none';
    else {
        fab.style.display = 'flex';
        fab.classList.remove('btn-anim');
        void fab.offsetWidth; 
        fab.classList.add('btn-anim');
    }
    
    if (t === 'pacotes') carregarPacotes(); 
    if (t === 'clientes') renderizarListaClientes();
    if (t === 'config') atualizarUIConfig();
    if (t === 'agenda') {
        renderizarCalendarioSemanal();
        atualizarAgendaVisual();
    }
}

function switchConfigTab(tab) {
    document.getElementById('cfg-area-geral').classList.add('hidden');
    document.getElementById('cfg-area-msg').classList.add('hidden');
    document.getElementById('cfg-area-horarios').classList.add('hidden');

    document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-slate-400';
    document.getElementById('btn-cfg-horarios').className = 'flex-1 py-2 text-sm font-bold text-slate-400';

    if(tab === 'geral') {
        document.getElementById('cfg-area-geral').classList.remove('hidden');
        document.getElementById('btn-cfg-geral').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    } else if (tab === 'horarios') {
        document.getElementById('cfg-area-horarios').classList.remove('hidden');
        document.getElementById('btn-cfg-horarios').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    } else {
        document.getElementById('cfg-area-msg').classList.remove('hidden');
        document.getElementById('btn-cfg-msg').className = 'flex-1 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600';
    }
}

function acaoFab() { 
    if(abaAtiva==='servicos') abrirModalServico(); 
    else if(abaAtiva==='agenda') abrirModalAgendamento(); 
    else if(abaAtiva==='clientes') abrirModalCliente();
    else if(abaAtiva==='pacotes') abrirModalVenderPacote(); 
    else if(abaAtiva==='equipa') abrirModalUsuario(); 
}

// ==========================================
// AGENDA E CALENDÁRIO SEMANAL
// ==========================================

function irParaHoje() {
    dataAtual = new Date();
    atualizarDataEPainel();
}

function mudarSemana(direcao) {
    dataAtual.setDate(dataAtual.getDate() + (direcao * 7));
    atualizarDataEPainel();
}

function selecionarDiaSemana(diaIso) {
    const partes = diaIso.split('-');
    dataAtual = new Date(partes[0], partes[1] - 1, partes[2]);
    atualizarDataEPainel();
}

function atualizarDataEPainel() {
    const picker = document.getElementById('data-picker');
    // CORREÇÃO: Usar data local
    if(picker) picker.value = getLocalISODate(dataAtual);
    
    renderizarCalendarioSemanal();
    atualizarAgendaVisual(); 
}

function renderizarCalendarioSemanal() {
    const container = document.getElementById('week-calendar-days');
    const labelMes = document.getElementById('current-month-year');
    if(!container) return;

    container.innerHTML = '';
    
    const mesAno = dataAtual.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    if(labelMes) labelMes.innerText = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

    const diaSemana = dataAtual.getDay(); 
    const domingoDaSemana = new Date(dataAtual);
    domingoDaSemana.setDate(dataAtual.getDate() - diaSemana);

    // CORREÇÃO: Usar data local para 'hoje'
    const hojeIso = getLocalISODate(new Date());
    const selecionadoIso = getLocalISODate(dataAtual);
    const diasSigla = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

    for (let i = 0; i < 7; i++) {
        const diaLoop = new Date(domingoDaSemana);
        diaLoop.setDate(domingoDaSemana.getDate() + i);
        
        const diaIso = getLocalISODate(diaLoop);
        const numeroDia = diaLoop.getDate();
        
        const isSelected = diaIso === selecionadoIso;
        const isToday = diaIso === hojeIso;

        const el = document.createElement('div');
        el.className = `day-col ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`;
        el.onclick = () => selecionarDiaSemana(diaIso);
        
        el.innerHTML = `
            <span class="week-day-name">${diasSigla[i]}</span>
            <span class="week-day-number">${numeroDia}</span>
        `;
        
        container.appendChild(el);
    }
}

function mudarProfissionalAgenda() { 
    currentProfId = document.getElementById('select-profissional-agenda').value; 
    atualizarAgendaVisual(); 
}

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
    if(!container) return; 
    container.innerHTML = '';

    const diaIndex = dataAtual.getDay(); 
    let horarioDia = null;
    
    if (config.horarios_semanais && Array.isArray(config.horarios_semanais)) {
        horarioDia = config.horarios_semanais.find(h => parseInt(h.dia) === diaIndex);
    }

    let abertura = config.abertura;
    let fechamento = config.fechamento;
    let isDiaFechado = false;

    if (horarioDia) {
        abertura = horarioDia.inicio;
        fechamento = horarioDia.fim;
        if (!horarioDia.ativo) isDiaFechado = true;
    }

    // CORREÇÃO: Usar data local para comparar com agendamentos
    const dateIso = getLocalISODate(dataAtual);

    if (isDiaFechado) {
        const temAgendamentos = agendamentosCache.some(a => a.data_agendamento === dateIso);
        
        if(!temAgendamentos) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                    <i data-lucide="moon" class="w-12 h-12 mb-2 text-slate-300"></i>
                    <p class="font-medium">Fechado neste dia</p>
                    <button onclick="abrirModalAgendamento()" class="mt-4 text-blue-600 text-sm font-bold hover:underline">Agendar mesmo assim</button>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        abertura = config.abertura;
        fechamento = config.fechamento;
    }

    const [hA, mA] = abertura.split(':').map(Number); 
    const [hF, mF] = fechamento.split(':').map(Number); 
    const startMin = hA*60 + mA; 
    const endMin = hF*60 + mF; 
    const interval = parseInt(config.intervalo_minutos) || 60; 

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

    const events = agendamentosCache
        .filter(a => a.data_agendamento === dateIso && a.hora_inicio)
        .map(a => { 
            const [h, m] = a.hora_inicio.split(':').map(Number); 
            const start = h*60 + m; 
            
            let dur = 60;
            if (a.id_servico === 'BLOQUEIO') {
                if (a.hora_fim) {
                    const [hFim, mFim] = a.hora_fim.split(':').map(Number);
                    const endMin = hFim * 60 + mFim;
                    dur = endMin - start;
                }
            } else {
                const svc = servicosCache.find(s => String(s.id_servico) === String(a.id_servico)); 
                dur = svc ? parseInt(svc.duracao_minutos) : 60; 
            }
            if (dur <= 0) dur = 60;

            const svc = servicosCache.find(s => String(s.id_servico) === String(a.id_servico)); 
            return { ...a, start, end: start + dur, dur, svc }; 
        })
        .sort((a,b) => a.start - b.start);

    let groups = []; 
    let lastEnd = -1; 
    events.forEach(ev => { 
        if(ev.start >= lastEnd) { 
            groups.push([ev]); 
            lastEnd = ev.end; 
        } else { 
            groups[groups.length-1].push(ev); 
            if(ev.end > lastEnd) lastEnd = ev.end; 
        } 
    });

    groups.forEach(group => { 
        const width = 100 / group.length; 
        group.forEach((ev, idx) => { 
            if(ev.start < startMin || ev.start >= endMin) return; 
            
            const offset = (ev.start - startMin) % interval; 
            const slotBase = ev.start - offset; 
            const slotEl = document.getElementById(`slot-${slotBase}`); 
            
            if(!slotEl) return; 
            
            const height = (ev.dur / interval) * 80; 
            const top = (offset / interval) * 80; 
            const left = idx * width; 
            
            const card = document.createElement('div'); 
            card.className = 'event-card'; 
            card.style.top = `${top + 2}px`; 
            card.style.height = `calc(${height}px - 4px)`; 
            card.style.left = `calc(${left}% + 2px)`; 
            card.style.width = `calc(${width}% - 4px)`; 
            
            const isBloqueio = ev.id_servico === 'BLOQUEIO';

            if (isBloqueio) {
                card.style.backgroundColor = '#f1f5f9';
                card.style.borderLeftColor = '#64748b';
                card.style.color = '#475569';
                card.innerHTML = `<div class="flex items-center gap-1"><i data-lucide="lock" class="w-3 h-3"></i> <span class="font-bold text-[10px] truncate">${ev.nome_cliente || 'Bloqueado'}</span></div>`;
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
                
                const name = ev.nome_cliente || ev.observacoes || 'Cliente'; 
                card.innerHTML = `${statusIcon}<div style="width:90%" class="font-bold truncate text-[10px]">${name}</div>${width > 25 ? `<div class="text-xs truncate">${ev.hora_inicio} • ${ev.svc ? ev.svc.nome_servico : 'Serviço'}</div>` : ''}`; 
            }
            
            card.onclick = (e) => { e.stopPropagation(); abrirModalDetalhes(ev.id_agendamento); }; 
            slotEl.appendChild(card); 
        }); 
    });
}

// ==========================================
// CLIENTES E HISTÓRICO
// ==========================================

function renderizarListaClientes(filtro = '') {
    const container = document.getElementById('lista-clientes-tab');
    if (!container) return;
    
    container.innerHTML = '';
    
    const termo = filtro.toLowerCase();
    const filtrados = clientesCache.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        (c.whatsapp && c.whatsapp.includes(termo)) ||
        (c.email && c.email.toLowerCase().includes(termo))
    );

    filtrados.sort((a, b) => a.nome.localeCompare(b.nome));

    if (filtrados.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum cliente encontrado.</div>';
        return;
    }

    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center transition-colors';
        
        div.innerHTML = `
            <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="abrirModalHistoricoCliente('${c.id_cliente}')">
                <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    ${c.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800">${c.nome}</h4>
                    <p class="text-xs text-slate-400">${c.whatsapp || 'Sem telefone'}</p>
                </div>
            </div>
            <button onclick="abrirModalEditarCliente('${c.id_cliente}')" class="p-2 text-slate-400 hover:text-blue-600 btn-anim">
                <i data-lucide="edit-2" class="w-5 h-5"></i>
            </button>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function filtrarListaClientes() {
    const termo = document.getElementById('busca-cliente').value;
    renderizarListaClientes(termo);
}

function abrirModalHistoricoCliente(idCliente) {
    const cliente = clientesCache.find(c => String(c.id_cliente) === String(idCliente));
    if(!cliente) return;

    currentHistoricoClienteId = idCliente;

    document.getElementById('hist-nome-cliente').innerText = cliente.nome;
    
    // Reseta inputs de data
    document.getElementById('hist-data-inicio').value = '';
    document.getElementById('hist-data-fim').value = '';

    aplicarFiltroHistorico(); 
    document.getElementById('modal-historico-cliente').classList.add('open');
}

function aplicarFiltroHistorico() {
    if (!currentHistoricoClienteId) return;

    const dataInicioVal = document.getElementById('hist-data-inicio').value;
    const dataFimVal = document.getElementById('hist-data-fim').value;

    let historico = agendamentosRaw.filter(a => String(a.id_cliente) === String(currentHistoricoClienteId));

    if (dataInicioVal) {
        historico = historico.filter(a => a.data_agendamento >= dataInicioVal);
    }
    if (dataFimVal) {
        historico = historico.filter(a => a.data_agendamento <= dataFimVal);
    }

    historico.sort((a, b) => {
        const dataA = new Date(a.data_agendamento + 'T' + a.hora_inicio);
        const dataB = new Date(b.data_agendamento + 'T' + b.hora_inicio);
        return dataB - dataA;
    });

    renderizarItensHistorico(historico);
}

function renderizarItensHistorico(lista) {
    const container = document.getElementById('lista-historico-conteudo');
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">Nenhum histórico encontrado no período.</p>';
        return;
    }

    lista.forEach(h => {
        const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
        const nomeServico = servico ? servico.nome_servico : (h.id_servico === 'BLOQUEIO' ? 'Bloqueio' : 'Serviço Removido');
        
        let statusCor = 'text-slate-500';
        if (h.status === 'Confirmado') statusCor = 'text-green-600';
        else if (h.status === 'Cancelado') statusCor = 'text-red-500';
        else if (h.status === 'Concluido') statusCor = 'text-blue-600';

        const item = document.createElement('div');
        item.className = 'flex gap-3 relative pb-4 border-l-2 border-slate-100 ml-2 pl-4 last:border-0';
        item.innerHTML = `
            <div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white"></div>
            <div class="w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-xs font-bold text-slate-400">${formatarDataBr(h.data_agendamento)}</span>
                    <span class="text-[10px] font-bold uppercase ${statusCor} bg-slate-50 px-2 py-0.5 rounded border border-slate-100">${h.status}</span>
                </div>
                <p class="font-bold text-slate-700 text-sm leading-tight mb-0.5">${nomeServico}</p>
                <p class="text-xs text-slate-400">${h.hora_inicio} - ${h.hora_fim}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

// ==========================================
// MODAIS - ABERTURA E FECHO
// ==========================================
function fecharModal(id) { 
    document.getElementById(id).classList.remove('open'); 
    if(id==='modal-agendamento') document.getElementById('area-pacote-info')?.classList.add('hidden'); 
}

function abrirModalAgendamento(h) { 
    document.getElementById('modal-agendamento').classList.add('open'); 
    document.getElementById('input-data-modal').value = getLocalISODate(dataAtual); // USANDO DATA LOCAL
    if(h) document.getElementById('input-hora-modal').value = h; 
    
    if(currentUser.nivel==='admin'){ 
        document.getElementById('div-select-prof-modal').classList.remove('hidden'); 
        document.getElementById('select-prof-modal').value=currentProfId; 
    } else { 
        document.getElementById('div-select-prof-modal').classList.add('hidden'); 
    } 
}

function abrirModalBloqueio(h) {
    document.getElementById('modal-bloqueio').classList.add('open');
    document.getElementById('input-data-bloqueio').value = getLocalISODate(dataAtual); // USANDO DATA LOCAL
    if(h) document.getElementById('input-hora-bloqueio').value = h;
    fecharModal('modal-agendamento');
}

function abrirModalCliente() { document.getElementById('modal-cliente').classList.add('open'); }
function abrirModalServico() { document.getElementById('modal-servico').classList.add('open'); }
function abrirModalUsuario() { document.getElementById('modal-usuario').classList.add('open'); }

function abrirModalEditarCliente(idCliente) {
    const c = clientesCache.find(x => String(x.id_cliente) === String(idCliente));
    if(!c) return;

    document.getElementById('edit-id-cliente').value = c.id_cliente;
    document.getElementById('edit-nome-cliente').value = c.nome;
    document.getElementById('edit-whatsapp-cliente').value = c.whatsapp || '';
    document.getElementById('edit-email-cliente').value = c.email || '';

    document.getElementById('modal-editar-cliente').classList.add('open');
}

function abrirModalEditarUsuario(id) {
    const u = usuariosCache.find(x => String(x.id_usuario) === String(id));
    if(!u) return;

    document.getElementById('edit-id-usuario').value = u.id_usuario;
    document.getElementById('edit-nome-usuario').value = u.nome;
    document.getElementById('edit-email-usuario').value = u.email;
    document.getElementById('edit-senha-usuario').value = ''; 
    document.getElementById('edit-nivel-usuario').value = u.nivel;
    document.getElementById('edit-user-color-input').value = u.cor || '#3b82f6';
    renderizarColorPickerUsuarioEdicao();

    document.getElementById('modal-editar-usuario').classList.add('open');
}

function abrirModalVenderPacote() { 
    itensPacoteTemp=[]; 
    atualizarListaVisualPacote(); 
    document.getElementById('input-servico-pacote-nome').value=''; 
    document.getElementById('valor-total-pacote').value=''; 
    document.getElementById('modal-vender-pacote').classList.add('open'); 
}

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

function abrirModalDetalhes(id) { 
    const ag = agendamentosCache.find(a => a.id_agendamento === id); if(!ag) return; 
    resetarBotoesModal();
    document.getElementById('id-agendamento-ativo').value = id; 
    const idPacote = ag.id_pacote_usado || ag.id_pacote || ''; 
    document.getElementById('id-pacote-agendamento-ativo').value = idPacote;
    
    const isBloqueio = ag.id_servico === 'BLOQUEIO';
    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico)); 
    const nomeCliente = ag.nome_cliente || ag.observacoes || 'Cliente'; 
    const isConcluido = ag.status === 'Concluido';
    const isCancelado = ag.status === 'Cancelado';

    document.getElementById('detalhe-cliente').innerText = isBloqueio ? (ag.observacoes || 'Bloqueio') : nomeCliente;
    document.getElementById('detalhe-servico').innerText = isBloqueio ? 'Horário Bloqueado' : (servico ? servico.nome_servico : 'Serviço');
    document.getElementById('detalhe-data').innerText = formatarDataBr(ag.data_agendamento);
    document.getElementById('detalhe-hora').innerText = `${ag.hora_inicio} - ${ag.hora_fim}`;
    
    const badge = document.getElementById('detalhe-status-badge');
    badge.innerText = ag.status || 'Agendado';
    badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase ';
    
    if(isConcluido) badge.className += 'bg-slate-200 text-slate-600';
    else if(isCancelado) badge.className += 'bg-red-100 text-red-600';
    else if(isBloqueio) badge.className += 'bg-slate-200 text-slate-600';
    else if(ag.status === 'Confirmado') badge.className += 'bg-green-100 text-green-700';
    else badge.className += 'bg-blue-100 text-blue-700';

    const commsDiv = document.getElementById('sec-comunicacao');
    if(commsDiv) commsDiv.style.display = isBloqueio ? 'none' : 'block';

    document.getElementById('btn-editar-horario').style.display = isConcluido || isCancelado || isBloqueio ? 'none' : 'flex';
    document.getElementById('btn-cancelar').style.display = isConcluido || isCancelado || isBloqueio ? 'none' : 'flex';
    document.getElementById('btn-excluir').style.display = isCancelado ? 'block' : 'none';

    // Atualização de Textos
    const btnEditar = document.getElementById('btn-editar-horario');
    if(btnEditar) btnEditar.innerHTML = '<i data-lucide="clock" class="w-4 h-4"></i> Editar Agendamento';
    
    const btnCancelar = document.getElementById('btn-cancelar');
    if(btnCancelar) btnCancelar.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4"></i> Cancelar Agendamento';

    const btnConfirmar = document.getElementById('btn-confirmar');
    const nBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nBtn, btnConfirmar);
    nBtn.onclick = () => prepararStatus('Confirmado', nBtn);
    
    const btnConcluir = document.getElementById('btn-concluir');
    const btnExcluir = document.getElementById('btn-excluir');

    if (isBloqueio) {
        nBtn.style.display = 'none';
        btnConcluir.style.display = 'none';
        
        btnExcluir.style.display = 'flex';
        btnExcluir.innerText = 'Desbloquear Horário';
        btnExcluir.className = 'w-full p-3 bg-red-50 text-red-600 font-bold rounded-xl text-sm border border-red-100 flex items-center justify-center gap-2 btn-anim mt-2';
        btnExcluir.onclick = () => prepararStatus('Excluir', btnExcluir);
    } else {
        if (isConcluido || isCancelado) { 
            nBtn.style.display = 'none'; 
            btnConcluir.style.display = 'none'; 
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
            btnConcluir.style.display = 'flex'; 
        }
        
        btnExcluir.innerText = 'Apagar Permanentemente';
        btnExcluir.className = 'hidden w-full p-3 text-red-400 text-xs font-bold mt-2';
        if (isCancelado) btnExcluir.style.display = 'block';
    }
    
    document.getElementById('modal-detalhes').classList.add('open'); 
    lucide.createIcons(); 
}

function copiarResumoAgendamento() {
    const id = document.getElementById('id-agendamento-ativo').value;
    const ag = agendamentosCache.find(a => a.id_agendamento === id);
    if (!ag) return;

    const servico = servicosCache.find(s => String(s.id_servico) === String(ag.id_servico));
    const nomeServico = servico ? servico.nome_servico : 'Serviço';
    
    const texto = `📅 Agendamento\n👤 ${ag.nome_cliente}\n✂️ ${nomeServico}\n🗓️ ${formatarDataBr(ag.data_agendamento)}\n⏰ ${ag.hora_inicio}`;
    
    navigator.clipboard.writeText(texto).then(() => {
        mostrarAviso("Resumo copiado para a área de transferência!");
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
        mostrarAviso("Erro ao copiar.");
    });
}

function resetarBotoesModal() {
    const btnConf = document.getElementById('btn-confirmar');
    btnConf.disabled = false;
    btnConf.className = "w-full p-3 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm border border-blue-100 flex items-center justify-center gap-2 btn-anim";
    btnConf.innerHTML = '<i data-lucide="thumbs-up" class="w-4 h-4"></i> Confirmar Presença';
    
    const btnConc = document.getElementById('btn-concluir');
    btnConc.disabled = false;
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
        mostrarConfirmacao('Apagar/Desbloquear', 'Tem certeza? Esta ação é irreversível.', () => executarMudancaStatusOtimista(id, st, true)); 
    } else if (st === 'Cancelado') { 
        if(idPacote) { 
            mostrarConfirmacao('Cancelar com Pacote', 'Devolver crédito ao cliente?', 
                () => executarMudancaStatusOtimista(id, st, true), 
                () => executarMudancaStatusOtimista(id, st, false), 
                'Sim, Devolver', 'Não, Debitar' 
            ); 
        } else { 
            mostrarConfirmacao('Cancelar Agendamento', 'Tem certeza que deseja cancelar?', () => executarMudancaStatusOtimista(id, st, false)); 
        } 
    } else if (st === 'Confirmado') { 
        executarMudancaStatusOtimista(id, st, false); 
    } else { 
        executarMudancaStatusOtimista(id, st, false); 
    } 
}

// ==========================================
// RENDERIZAÇÃO DE LISTAS
// ==========================================

function renderizarListaServicos() { 
    const container = document.getElementById('lista-servicos'); 
    container.innerHTML = ''; 
    servicosCache.forEach(s => { 
        const div = document.createElement('div'); 
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center'; 
        div.innerHTML = `<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background-color: ${getCorServico(s)}">${s.nome_servico.charAt(0)}</div><div><h4 class="font-bold text-slate-800">${s.nome_servico}</h4><p class="text-xs text-slate-500">${s.duracao_minutos} min • R$ ${parseFloat(s.valor_unitario).toFixed(2)}</p></div></div><button onclick="abrirModalEditarServico('${s.id_servico}')" class="text-slate-400 hover:text-blue-600"><i data-lucide="edit-2" class="w-5 h-5"></i></button>`; 
        container.appendChild(div); 
    }); 
    lucide.createIcons(); 
}

function renderizarListaPacotes() { 
    const container = document.getElementById('lista-pacotes'); 
    container.innerHTML = ''; 
    
    if(!pacotesCache || pacotesCache.length === 0) { 
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum pacote ativo.</div>'; 
        return; 
    } 
    
    pacotesCache.forEach(p => { 
        const div = document.createElement('div'); 
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100'; 
        div.innerHTML = `<div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-slate-800">${p.nome_cliente}</h4><p class="text-xs text-slate-500">${p.nome_servico}</p></div><span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">${p.qtd_restante}/${p.qtd_total}</span></div><div class="w-full bg-slate-100 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full" style="width: ${(p.qtd_restante/p.qtd_total)*100}%"></div></div>`; 
        container.appendChild(div); 
    }); 
}

function renderizarListaUsuarios() { 
    const container = document.getElementById('lista-usuarios'); 
    container.innerHTML = ''; 
    usuariosCache.forEach(u => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center";
        
        const bgCor = u.cor || '#e2e8f0';
        const textCor = u.cor ? 'white' : '#475569';
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style="background-color: ${bgCor}; color: ${textCor}">
                    ${u.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800">${u.nome}</h4>
                    <p class="text-xs text-slate-400 capitalize">${u.nivel}</p>
                </div>
            </div>
            <button onclick="abrirModalEditarUsuario('${u.id_usuario}')" class="text-slate-400 hover:text-blue-600 btn-anim">
                <i data-lucide="edit-2" class="w-5 h-5"></i>
            </button>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

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

function atualizarDatalistServicos() { 
    const dl = document.getElementById('lista-servicos-datalist'); 
    if(dl) { 
        dl.innerHTML = ''; 
        servicosCache.forEach(i=>{ const o=document.createElement('option'); o.value=i.nome_servico; dl.appendChild(o); }); 
    } 
}

function atualizarDatalistClientes() { 
    const dl = document.getElementById('lista-clientes'); 
    if(dl) { 
        dl.innerHTML = ''; 
        clientesCache.forEach(c=>{ const o=document.createElement('option'); o.value=c.nome; dl.appendChild(o); }); 
    } 
}

function renderizarColorPicker() { 
    const c=document.getElementById('color-picker-container'); 
    c.innerHTML=''; 
    PALETA_CORES.forEach((cor,i)=>{
        const d=document.createElement('div');
        d.className=`color-option ${i===4?'selected':''}`;
        d.style.backgroundColor=cor;
        d.onclick=()=>{
            document.querySelectorAll('.color-option').forEach(el=>el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('input-cor-selecionada').value=cor
        };
        c.appendChild(d)
    })
}

function renderizarColorPickerEdicao() { 
    const c=document.getElementById('edit-color-picker-container'); 
    c.innerHTML=''; 
    PALETA_CORES.forEach((cor,i)=>{
        const d=document.createElement('div');
        d.className=`color-option ${i===4?'selected':''}`;
        d.style.backgroundColor=cor;
        d.onclick=()=>{
            document.querySelectorAll('#edit-color-picker-container .color-option').forEach(el=>el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('edit-input-cor-selecionada').value=cor
        };
        c.appendChild(d)
    })
}

function renderizarColorPickerUsuarioEdicao() {
    const c = document.getElementById('edit-user-color-picker');
    if(!c) return;
    c.innerHTML = '';
    const current = document.getElementById('edit-user-color-input').value;
    
    PALETA_CORES.forEach((cor) => {
        const d = document.createElement('div');
        d.className = `color-option ${cor === current ? 'selected' : ''}`;
        d.style.backgroundColor = cor;
        d.onclick = () => {
            document.querySelectorAll('#edit-user-color-picker .color-option').forEach(el => el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('edit-user-color-input').value = cor;
        };
        c.appendChild(d);
    });
}

// ==========================================
// CONFIGURAÇÃO UI
// ==========================================

function atualizarUIConfig() {
    document.getElementById('cfg-abertura').value = config.abertura;
    document.getElementById('cfg-fechamento').value = config.fechamento;
    document.getElementById('cfg-intervalo').value = config.intervalo_minutos;
    document.getElementById('cfg-concorrencia').checked = config.permite_encaixe;
    
    document.getElementById('cfg-lembrete-template').value = config.mensagem_lembrete || "Olá {cliente}, seu agendamento é dia {data} às {hora}.";
    renderizarListaMsgRapidasConfig();

    renderizarListaHorariosSemanais();
}

function renderizarListaHorariosSemanais() {
    const container = document.getElementById('lista-horarios-semanais');
    if(!container) return;
    container.innerHTML = '';

    const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    if (!config.horarios_semanais || !Array.isArray(config.horarios_semanais) || config.horarios_semanais.length === 0) {
        config.horarios_semanais = diasNomes.map((_, i) => ({
            dia: i,
            ativo: i !== 0, 
            inicio: config.abertura || '08:00',
            fim: config.fechamento || '19:00'
        }));
    }

    config.horarios_semanais.sort((a, b) => a.dia - b.dia);

    config.horarios_semanais.forEach((diaConfig, index) => {
        const row = document.createElement('div');
        row.className = 'bg-slate-50 p-3 rounded-xl border border-slate-200';
        
        const isAtivo = diaConfig.ativo;

        row.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-slate-700">${diasNomes[diaConfig.dia]}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" ${isAtivo ? 'checked' : ''} onchange="toggleDiaSemana(${index})">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
            <div class="flex gap-3 ${isAtivo ? '' : 'hidden'}">
                <div class="flex-1">
                    <label class="text-[10px] uppercase font-bold text-slate-400">Início</label>
                    <input type="time" value="${diaConfig.inicio}" onchange="atualizarHorarioDia(${index}, 'inicio', this.value)" class="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none">
                </div>
                <div class="flex-1">
                    <label class="text-[10px] uppercase font-bold text-slate-400">Fim</label>
                    <input type="time" value="${diaConfig.fim}" onchange="atualizarHorarioDia(${index}, 'fim', this.value)" class="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none">
                </div>
            </div>
            <div class="${isAtivo ? 'hidden' : 'block'} text-center py-2 text-xs text-slate-400 font-medium">
                Fechado
            </div>
        `;
        container.appendChild(row);
    });
}

function toggleDiaSemana(index) {
    config.horarios_semanais[index].ativo = !config.horarios_semanais[index].ativo;
    renderizarListaHorariosSemanais();
}

function atualizarHorarioDia(index, field, value) {
    config.horarios_semanais[index][field] = value;
}

function renderizarListaMsgRapidasConfig() {
    const div = document.getElementById('lista-msg-rapidas');
    div.innerHTML = '';
    if(!config.mensagens_rapidas) config.mensagens_rapidas = [];
    
    config.mensagens_rapidas.forEach((msg, idx) => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200';
        item.innerHTML = `
            <span class="text-xs text-slate-600 truncate flex-1 mr-2">${msg}</span>
            <button onclick="removerMsgRapida(${idx})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
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

// ==========================================
// PACOTES UI INTERNALS
// ==========================================

function adicionarItemAoPacote() { 
    const nomeServico = document.getElementById('input-servico-pacote-nome').value; 
    const qtdInput = document.getElementById('qtd-servico-pacote'); 
    const qtd = parseInt(qtdInput.value); 
    
    if(!nomeServico || qtd < 1) return; 
    
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase()); 
    if(!servico) { 
        mostrarAviso('Serviço não encontrado na lista.'); 
        return; 
    } 
    
    const subtotal = (parseFloat(servico.valor_unitario || 0) * qtd); 
    itensPacoteTemp.push({ 
        id_servico: servico.id_servico, 
        nome_servico: servico.nome_servico, 
        valor_unitario: servico.valor_unitario, 
        qtd: qtd, 
        subtotal: subtotal 
    }); 
    
    atualizarListaVisualPacote(); 
    atualizarTotalSugerido(); 
    document.getElementById('input-servico-pacote-nome').value = ""; 
    qtdInput.value = "1"; 
}

function atualizarListaVisualPacote() { 
    const container = document.getElementById('lista-itens-pacote'); 
    container.innerHTML = ''; 
    if(itensPacoteTemp.length === 0) { 
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Nenhum item adicionado.</p>'; 
        return; 
    } 
    itensPacoteTemp.forEach((item, index) => { 
        const div = document.createElement('div'); 
        div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-sm'; 
        const subtotalFmt = item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
        div.innerHTML = ` <div class="flex-1"> <div class="flex justify-between items-center"> <span class="font-medium text-slate-700">${item.qtd}x ${item.nome_servico}</span> <span class="text-xs text-slate-500 font-medium ml-2">= ${subtotalFmt}</span> </div> </div> <button type="button" onclick="removerItemPacote(${index})" class="ml-3 text-red-400 hover:text-red-600 btn-anim"><i data-lucide="trash-2" class="w-4 h-4"></i></button> `; 
        container.appendChild(div); 
    }); 
    lucide.createIcons(); 
}

function removerItemPacote(index) { 
    itensPacoteTemp.splice(index, 1); 
    atualizarListaVisualPacote(); 
    atualizarTotalSugerido(); 
}

function atualizarTotalSugerido() { 
    const total = itensPacoteTemp.reduce((acc, item) => acc + item.subtotal, 0); 
    document.getElementById('valor-total-pacote').value = total.toFixed(2); 
}

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
    modal.classList.add('open'); 
}

// ==========================================
// WHATSAPP / COMUNICAÇÃO
// ==========================================

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

// ==========================================
// HELPERS UI
// ==========================================

function mostrarAviso(msg) { 
    document.getElementById('aviso-msg').innerText = msg; 
    document.getElementById('modal-aviso').classList.add('open'); 
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
    newN.onclick = () => { 
        fecharModal('modal-confirmacao'); 
        if(noCb) noCb(); 
    }; 
    
    document.getElementById('modal-confirmacao').classList.add('open'); 
}

function setLoading(btn, l, t) { 
    btn.disabled = l; 
    if (l) { 
        const isDarkBg = btn.classList.contains('btn-primary') || btn.classList.contains('bg-blue-600') || btn.classList.contains('bg-red-600'); 
        const spinnerType = isDarkBg ? 'spinner' : 'spinner spinner-dark'; 
        btn.innerHTML = `<span class="${spinnerType}"></span>`; 
    } else { 
        btn.innerHTML = t; 
    } 
}

function showSyncIndicator(show) { 
    isSyncing = show; 
    document.getElementById('sync-indicator').style.display = show ? 'flex' : 'none'; 
}
