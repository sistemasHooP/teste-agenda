// ==========================================
// GESTÃO DE CLIENTES (LISTAGEM, DETALHES E HISTÓRICO)
// ==========================================

let clienteEmEdicao = null;

/**
 * Renderiza a lista de clientes na aba "Clientes".
 * Filtra por nome, whatsapp ou email com base no input de pesquisa.
 */
function renderizarListaClientes() {
    const container = document.getElementById('lista-clientes-ui');
    if (!container) return;
    
    const termoInput = document.getElementById('search-clientes');
    const termo = termoInput ? termoInput.value.toLowerCase() : '';
    
    container.innerHTML = '';

    // Se a cache estiver vazia ou indefinida
    if (!clientesCache || clientesCache.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum cliente cadastrado.</div>';
        return;
    }

    // Filtrar clientes
    const filtrados = clientesCache.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(termo)) || 
        (c.whatsapp && c.whatsapp.includes(termo)) ||
        (c.email && c.email.toLowerCase().includes(termo))
    );

    if (filtrados.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum cliente encontrado.</div>';
        return;
    }

    // Gerar HTML da lista
    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors';
        div.onclick = () => abrirModalDetalhesCliente(c.id_cliente);

        const inicial = c.nome ? c.nome.charAt(0).toUpperCase() : '?';

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
                    ${inicial}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800">${c.nome || 'Sem Nome'}</h4>
                    <p class="text-xs text-slate-500">${c.whatsapp || 'Sem telefone'}</p>
                </div>
            </div>
            <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
        `;
        container.appendChild(div);
    });
    
    // Atualizar ícones se a biblioteca estiver carregada
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Abre o modal de detalhes do cliente selecionado.
 * Preenche os campos de edição e carrega o histórico.
 */
function abrirModalDetalhesCliente(idCliente) {
    const cliente = clientesCache.find(c => String(c.id_cliente) === String(idCliente));
    if (!cliente) return;

    clienteEmEdicao = cliente;

    // Preencher Aba Perfil (Edição)
    document.getElementById('edit-id-cliente').value = cliente.id_cliente;
    document.getElementById('edit-nome-cliente').value = cliente.nome;
    document.getElementById('edit-whatsapp-cliente').value = cliente.whatsapp;
    document.getElementById('edit-email-cliente').value = cliente.email;

    // Resetar filtros de data do histórico
    document.getElementById('filter-inicio-hist').value = '';
    document.getElementById('filter-fim-hist').value = '';

    // Renderizar Histórico inicial (sem filtros de data)
    filtrarHistoricoCliente();

    // Abrir Modal na aba de Perfil por defeito
    if(typeof switchModalTab === 'function') switchModalTab('perfil-cliente');
    
    document.getElementById('modal-detalhes-cliente').classList.add('open');
}

/**
 * Filtra e renderiza o histórico de agendamentos do cliente.
 * Usa os inputs de data inicio/fim do modal.
 */
function filtrarHistoricoCliente() {
    const container = document.getElementById('lista-historico-cliente');
    container.innerHTML = '';

    if (!clienteEmEdicao) return;

    // Obter valores dos filtros de data
    const inicioVal = document.getElementById('filter-inicio-hist').value;
    const fimVal = document.getElementById('filter-fim-hist').value;
    
    // Ajustar datas para comparação (zerar horas para comparação justa de dia)
    const inicio = inicioVal ? new Date(inicioVal + 'T00:00:00') : null;
    const fim = fimVal ? new Date(fimVal + 'T23:59:59') : null;

    // 1. Filtrar agendamentos relacionados a este cliente
    // Verifica tanto pelo ID quanto pelo Nome (para manter compatibilidade com registos antigos sem ID)
    let historico = agendamentosCache.filter(ag => 
        String(ag.id_cliente) === String(clienteEmEdicao.id_cliente) || 
        (ag.nome_cliente && ag.nome_cliente.toLowerCase() === clienteEmEdicao.nome.toLowerCase())
    );

    // 2. Aplicar filtro de data se selecionado
    if (inicio || fim) {
        historico = historico.filter(h => {
            const dataH = new Date(h.data_agendamento + 'T00:00:00'); // Garante formato correto
            
            if (inicio && dataH < inicio) return false;
            if (fim && dataH > fim) return false;
            return true;
        });
    }

    // 3. Ordenar (mais recente primeiro)
    historico.sort((a, b) => {
        return (b.data_agendamento + b.hora_inicio).localeCompare(a.data_agendamento + a.hora_inicio);
    });

    if (historico.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Nenhum histórico encontrado para o período.</p>';
        return;
    }

    // 4. Renderizar lista
    historico.forEach(h => {
        // Encontrar nome do serviço
        let nomeServico = 'Serviço desconhecido';
        
        if (h.id_servico === 'BLOQUEIO') {
            nomeServico = 'Bloqueio / Indisponível';
        } else {
            const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
            if (servico) nomeServico = servico.nome_servico;
            else nomeServico = 'Serviço (Removido)';
        }
        
        let statusClass = 'text-blue-600';
        let statusTexto = h.status;

        if (h.status === 'Concluido') statusClass = 'text-green-600';
        else if (h.status === 'Cancelado') statusClass = 'text-red-400 line-through';
        else if (h.status === 'Bloqueado') { statusClass = 'text-slate-500'; statusTexto = 'Bloq.'; }
        else if (h.status === 'Confirmado') statusClass = 'text-green-600 font-bold';

        // Formatação da data para o display
        const dataFormatada = (typeof formatarDataBr === 'function') ? formatarDataBr(h.data_agendamento) : h.data_agendamento;

        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm mb-2';
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-700 flex items-center gap-2">
                    ${dataFormatada} 
                    <span class="font-normal text-xs text-slate-400 bg-white px-1 rounded border">${h.hora_inicio}</span>
                </p>
                <p class="text-xs text-slate-500 mt-1">${nomeServico}</p>
            </div>
            <span class="text-xs font-bold uppercase ${statusClass} px-2 py-1 bg-white rounded border border-slate-100">${statusTexto}</span>
        `;
        container.appendChild(div);
    });
}

/**
 * Salva as edições do perfil do cliente.
 */
async function salvarEdicaoCliente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-update-cliente');
    const originalText = btn.innerText;
    
    if(typeof setLoading === 'function') setLoading(btn, true, 'Salvar');

    const id = document.getElementById('edit-id-cliente').value;
    const nome = document.getElementById('edit-nome-cliente').value;
    const whatsapp = document.getElementById('edit-whatsapp-cliente').value;
    const email = document.getElementById('edit-email-cliente').value;

    try {
        // Chamada à API
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateCliente',
                id_cliente: id,
                nome: nome,
                whatsapp: whatsapp,
                email: email
            })
        });

        const data = await response.json();

        if (data.status === 'sucesso') {
            // Atualizar cache local imediatamente (Otimista)
            const idx = clientesCache.findIndex(c => String(c.id_cliente) === String(id));
            if (idx !== -1) {
                clientesCache[idx].nome = nome;
                clientesCache[idx].whatsapp = whatsapp;
                clientesCache[idx].email = email;
                
                // Re-salvar no localStorage
                if(typeof saveToCache === 'function') saveToCache('clientes', clientesCache);
            }

            if(typeof fecharModal === 'function') fecharModal('modal-detalhes-cliente');
            renderizarListaClientes(); // Atualiza a lista visual
            
            // Tenta atualizar outros locais onde o nome aparece (opcional, requer recarregar agenda)
            if(typeof recarregarAgendaComFiltro === 'function') recarregarAgendaComFiltro(true);

            if(typeof mostrarAviso === 'function') mostrarAviso('Cliente atualizado com sucesso!');
        } else {
            throw new Error(data.mensagem || 'Erro ao atualizar');
        }

    } catch (error) {
        if(typeof mostrarAviso === 'function') mostrarAviso('Erro ao atualizar: ' + error.message);
        console.error(error);
    } finally {
        if(typeof setLoading === 'function') setLoading(btn, false, originalText);
    }
}

/**
 * Exclui um cliente.
 */
function excluirCliente() {
    if (!clienteEmEdicao) return;
    
    if(typeof mostrarConfirmacao === 'function') {
        mostrarConfirmacao(
            'Excluir Cliente', 
            'Tem a certeza? O histórico de agendamentos será mantido, mas o cliente não aparecerá mais na lista para novos agendamentos.', 
            async () => {
                // Callback de confirmação (SIM)
                if(typeof fecharModal === 'function') fecharModal('modal-confirmacao'); // Fecha o diálogo de confirmação
                
                // Feedback visual de carregamento (opcional, pode ser um toast)
                if(typeof mostrarAviso === 'function') mostrarAviso('A excluir cliente...');

                try {
                    await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'deleteCliente',
                            id_cliente: clienteEmEdicao.id_cliente
                        })
                    });

                    // Remover do cache local
                    clientesCache = clientesCache.filter(c => String(c.id_cliente) !== String(clienteEmEdicao.id_cliente));
                    if(typeof saveToCache === 'function') saveToCache('clientes', clientesCache);
                    
                    // Fechar modal principal
                    if(typeof fecharModal === 'function') {
                        fecharModal('modal-detalhes-cliente');
                    }
                    
                    renderizarListaClientes();
                    if(typeof mostrarAviso === 'function') mostrarAviso('Cliente excluído com sucesso.');
                    
                } catch (error) {
                    if(typeof mostrarAviso === 'function') mostrarAviso('Erro ao excluir: ' + error.message);
                    console.error(error);
                }
            }
        );
    }
}
