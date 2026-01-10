// --- LÓGICA DE GESTÃO DE PACOTES ---

function carregarPacotes() { 
    fetch(`${API_URL}?action=getPacotes`)
        .then(r => r.json())
        .then(d => { 
            pacotesCache = d; 
            renderizarListaPacotes(); 
        }); 
}

function mudarAbaPacotes(aba) {
    abaPacotesAtiva = aba;
    
    // Atualiza botões
    const btnAtivos = document.getElementById('btn-tab-pacotes-ativos');
    const btnHist = document.getElementById('btn-tab-pacotes-historico');
    
    if (aba === 'ativos') {
        btnAtivos.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all bg-white text-blue-600 shadow-sm";
        btnHist.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700";
    } else {
        btnAtivos.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700";
        btnHist.className = "flex-1 py-2 text-sm font-bold rounded-lg transition-all bg-white text-blue-600 shadow-sm";
    }
    
    renderizarListaPacotes();
}

function renderizarListaPacotes() { 
    const container = document.getElementById('lista-pacotes'); 
    const termoBusca = document.getElementById('search-pacotes') ? document.getElementById('search-pacotes').value.toLowerCase() : '';
    container.innerHTML = ''; 
    
    // Agrupar pacotes por id_transacao para mostrar como uma "venda" única
    const grupos = {};
    
    pacotesCache.forEach(p => {
        const id = p.id_transacao || 'sem_id_' + p.id_pacote;
        if (!grupos[id]) {
            grupos[id] = {
                id_transacao: p.id_transacao || 'N/A',
                nome_cliente: p.nome_cliente,
                data_compra: p.data_compra,
                valor_cobrado: p.valor_cobrado || 0,
                itens: []
            };
        }
        grupos[id].itens.push(p);
    });

    let chaves = Object.keys(grupos);

    // Ordenação Inteligente: Mais recentes primeiro
    chaves.sort((a, b) => {
        const dataA = grupos[a].data_compra; // YYYY-MM-DD
        const dataB = grupos[b].data_compra;
        if (dataA > dataB) return -1;
        if (dataA < dataB) return 1;
        return 0;
    });

    // Filtro por Busca (Nome)
    if (termoBusca) {
        chaves = chaves.filter(key => grupos[key].nome_cliente.toLowerCase().includes(termoBusca));
    }

    // Filtro por Aba (Ativos vs Histórico)
    chaves = chaves.filter(key => {
        const grupo = grupos[key];
        // Ativo = Tem pelo menos 1 item com saldo > 0
        const temSaldo = grupo.itens.some(item => parseInt(item.qtd_restante) > 0);
        
        if (abaPacotesAtiva === 'ativos') return temSaldo;
        return !temSaldo; // Histórico = Todos com saldo 0
    });

    if (chaves.length === 0) { 
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum pacote encontrado.</div>'; 
        return; 
    } 
    
    chaves.forEach(key => { 
        const g = grupos[key];
        const qtdItens = g.itens.length;
        const totalRestante = g.itens.reduce((acc, i) => acc + parseInt(i.qtd_restante), 0);
        const totalInicial = g.itens.reduce((acc, i) => acc + parseInt(i.qtd_total), 0);
        
        // Barra de progresso visual
        const progresso = totalInicial > 0 ? (totalRestante / totalInicial) * 100 : 0;
        let corBarra = 'bg-blue-500';
        if (progresso < 30) corBarra = 'bg-red-500';
        else if (progresso < 60) corBarra = 'bg-yellow-500';

        const div = document.createElement('div'); 
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors'; 
        div.onclick = () => abrirDetalhesPacote(key);
        
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-slate-800">${g.nome_cliente}</h4>
                    <p class="text-xs text-slate-500">${formatarDataBr(g.data_compra)} • ${qtdItens} serviços</p>
                </div>
                <div class="text-right">
                    <span class="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-1 rounded-lg border border-blue-100">Detalhes</span>
                </div>
            </div>
            <div class="flex justify-between items-center text-xs text-slate-500 mb-1 mt-3">
                <span>Saldo Total</span>
                <span class="font-bold">${totalRestante}/${totalInicial}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div class="${corBarra} h-1.5 rounded-full transition-all duration-500" style="width: ${progresso}%"></div>
            </div>
        `; 
        container.appendChild(div); 
    }); 
}

function abrirDetalhesPacote(idTransacao) {
    const modal = document.getElementById('modal-detalhes-pacote');
    const divSaldos = document.getElementById('tab-modal-saldos');
    const divHist = document.getElementById('tab-modal-historico');
    
    // Filtrar itens deste pacote
    const itens = pacotesCache.filter(p => p.id_transacao === idTransacao || (!p.id_transacao && idTransacao.startsWith('sem_id')));
    
    if (itens.length === 0) return;

    // Recolher IDs para filtrar o histórico global de agendamentos
    const idsPacotes = itens.map(i => String(i.id_pacote));

    // Buscar histórico nos agendamentos (memória)
    const historico = agendamentosCache.filter(ag => {
        const idUsado = String(ag.id_pacote_usado || ag.id_pacote || '');
        return idsPacotes.includes(idUsado);
    });

    // Guardar para o relatório (INCLUINDO HISTÓRICO)
    pacoteSelecionado = { id: idTransacao, itens: itens, info: itens[0], historico: historico };

    // Preencher Cabeçalho
    document.getElementById('pacote-info-id').innerText = '#' + (itens[0].id_transacao ? itens[0].id_transacao.slice(-6) : 'N/A');
    document.getElementById('pacote-info-valor').innerText = 'R$ ' + parseFloat(itens[0].valor_cobrado || 0).toFixed(2);
    document.getElementById('pacote-info-data').innerText = formatarDataBr(itens[0].data_compra);

    // Renderizar Saldos
    divSaldos.innerHTML = '';
    itens.forEach(item => {
        const percent = (item.qtd_restante / item.qtd_total) * 100;
        divSaldos.innerHTML += `
            <div class="mb-2">
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-slate-700 font-medium">${item.nome_servico}</span>
                    <span class="text-blue-600 font-bold">${item.qtd_restante}/${item.qtd_total}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>`;
    });

    // Renderizar Histórico (UI Display)
    divHist.innerHTML = '';
    if (historico.length === 0) {
        divHist.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Nenhum uso registrado.</p>';
    } else {
        // Ordenar histórico por data (mais recente primeiro)
        const histUI = [...historico].sort((a, b) => (b.data_agendamento + b.hora_inicio).localeCompare(a.data_agendamento + a.hora_inicio));
        
        histUI.forEach(h => {
            const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
            const nomeServico = servico ? servico.nome_servico : 'Serviço';
            
            let statusClass = 'text-blue-600';
            if (h.status === 'Concluido') statusClass = 'text-green-600';
            else if (h.status === 'Cancelado') statusClass = 'text-red-400 line-through';
            
            divHist.innerHTML += `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-sm">
                    <div>
                        <p class="font-bold text-slate-700">${formatarDataBr(h.data_agendamento)} <span class="font-normal text-xs text-slate-400">${h.hora_inicio}</span></p>
                        <p class="text-xs text-slate-500">${nomeServico}</p>
                    </div>
                    <span class="text-xs font-bold uppercase ${statusClass}">${h.status}</span>
                </div>`;
        });
    }
    
    // Resetar aba para Saldos e abrir
    switchModalTab('saldos');
    document.getElementById('modal-detalhes-pacote').classList.add('open');
}

function enviarRelatorioPacote() {
    if (!pacoteSelecionado) return;
    
    const info = pacoteSelecionado.info;
    const historico = pacoteSelecionado.historico || [];
    const cliente = clientesCache.find(c => String(c.id_cliente) === String(info.id_cliente));
    
    if (!cliente || !cliente.whatsapp) {
        mostrarAviso('Cliente sem WhatsApp cadastrado.');
        return;
    }

    let nums = String(cliente.whatsapp).replace(/\D/g, ''); 
    if (!nums.startsWith('55') && (nums.length === 10 || nums.length === 11)) nums = '55' + nums;

    let texto = `*Relatório de Pacote*\n`;
    texto += `👤 Cliente: ${info.nome_cliente}\n`;
    texto += `📅 Compra: ${formatarDataBr(info.data_compra)}\n\n`;
    
    texto += `*📊 Saldos Atuais:*\n`;
    pacoteSelecionado.itens.forEach(item => {
        texto += `- ${item.nome_servico}: ${item.qtd_restante} de ${item.qtd_total}\n`;
    });

    texto += `\n*📝 Serviços Utilizados:*\n`;
    if (historico.length === 0) {
        texto += `_Nenhum serviço utilizado ainda._\n`;
    } else {
        const histSorted = [...historico].sort((a, b) => {
             return (b.data_agendamento + b.hora_inicio).localeCompare(a.data_agendamento + a.hora_inicio);
        });

        histSorted.forEach(h => {
            const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
            const nomeSvc = servico ? servico.nome_servico : 'Serviço';
            // Ícones de status para o WhatsApp
            const statusStr = h.status === 'Concluido' ? '✅' : (h.status === 'Cancelado' ? '❌' : '📅');
            texto += `${statusStr} ${formatarDataBr(h.data_agendamento)} - ${nomeSvc}\n`;
        });
    }

    const agora = new Date();
    const dataHoraGeracao = agora.toLocaleString('pt-BR');
    texto += `\n_Gerado em: ${dataHoraGeracao}_`;

    window.open(`https://wa.me/${nums}?text=${encodeURIComponent(texto)}`, '_blank');
}

// --- VENDA DE PACOTES ---

function abrirModalVenderPacote() { 
    itensPacoteTemp = []; 
    atualizarListaVisualPacote(); 
    document.getElementById('input-servico-pacote-nome').value = ''; 
    document.getElementById('valor-total-pacote').value = ''; 
    document.getElementById('modal-vender-pacote').classList.add('open'); 
}

function adicionarItemAoPacote() {
    const nomeServico = document.getElementById('input-servico-pacote-nome').value;
    const qtdInput = document.getElementById('qtd-servico-pacote');
    const qtd = parseInt(qtdInput.value);
    
    if (!nomeServico || qtd < 1) return;
    
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase());
    
    if (!servico) {
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
    
    if (itensPacoteTemp.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Nenhum item adicionado.</p>';
        return;
    }
    
    itensPacoteTemp.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-sm';
        const subtotalFmt = item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        div.innerHTML = `
            <div class="flex-1">
                <div class="flex justify-between items-center">
                    <span class="font-medium text-slate-700">${item.qtd}x ${item.nome_servico}</span>
                    <span class="text-xs text-slate-500 font-medium ml-2">= ${subtotalFmt}</span>
                </div>
            </div>
            <button type="button" onclick="removerItemPacote(${index})" class="ml-3 text-red-400 hover:text-red-600 btn-anim"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
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

async function salvarVendaPacote(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-pacote'); 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    const f = e.target; 
    
    if (itensPacoteTemp.length === 0) { 
        mostrarAviso('Adicione serviços.'); 
        setLoading(btn, false, originalText); 
        return; 
    } 
    
    const cliente = clientesCache.find(c => c.nome === f.nome_cliente.value); 
    if (!cliente) { 
        mostrarAviso('Cliente inválido.'); 
        setLoading(btn, false, originalText); 
        return; 
    } 
    
    try { 
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'createPacote', id_cliente: cliente.id_cliente, nome_cliente: cliente.nome, itens: itensPacoteTemp, valor_total: f.valor_total.value, validade: f.validade.value }) }); 
        fecharModal('modal-vender-pacote'); 
        f.reset(); 
        mostrarAviso('Pacote vendido!'); 
        setTimeout(() => { carregarPacotes(); }, 1500); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

// --- VERIFICAÇÃO NO AGENDAMENTO ---

function verificarPacoteDisponivel() {
    const nomeCliente = document.getElementById('input-cliente-nome').value;
    const nomeServico = document.getElementById('input-servico-nome').value;
    const areaInfo = document.getElementById('area-pacote-info');
    const checkbox = document.getElementById('check-usar-pacote');
    const inputIdPacote = document.getElementById('id-pacote-selecionado');
    
    areaInfo.classList.add('hidden');
    inputIdPacote.value = '';
    checkbox.checked = false;
    
    if (!nomeCliente || !nomeServico) return;
    
    const cliente = clientesCache.find(c => c.nome.toLowerCase() === nomeCliente.toLowerCase());
    const servico = servicosCache.find(s => s.nome_servico.toLowerCase() === nomeServico.toLowerCase());
    
    if (!cliente || !servico) return;
    
    // Procura um pacote com saldo
    const pacote = pacotesCache.find(p => String(p.id_cliente) === String(cliente.id_cliente) && String(p.id_servico) === String(servico.id_servico) && parseInt(p.qtd_restante) > 0);
    
    if (pacote) {
        areaInfo.classList.remove('hidden');
        areaInfo.classList.add('flex');
        document.getElementById('pacote-saldo').innerText = pacote.qtd_restante;
        inputIdPacote.value = pacote.id_pacote;
        checkbox.checked = true;
    }
}