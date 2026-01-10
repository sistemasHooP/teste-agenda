// --- GESTÃO DE CLIENTES (LISTAGEM E DETALHES) ---

let clienteEmEdicao = null;

function renderizarListaClientes() {
    const container = document.getElementById('lista-clientes-ui');
    if (!container) return;
    
    const termoInput = document.getElementById('search-clientes');
    const termo = termoInput ? termoInput.value.toLowerCase() : '';
    
    container.innerHTML = '';

    // Filtrar clientes
    const filtrados = clientesCache.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        (c.whatsapp && c.whatsapp.includes(termo)) ||
        (c.email && c.email.toLowerCase().includes(termo))
    );

    if (filtrados.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-10">Nenhum cliente encontrado.</div>';
        return;
    }

    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors';
        div.onclick = () => abrirModalDetalhesCliente(c.id_cliente);

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
                    ${c.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800">${c.nome}</h4>
                    <p class="text-xs text-slate-500">${c.whatsapp || 'Sem telefone'}</p>
                </div>
            </div>
            <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
        `;
        container.appendChild(div);
    });
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function abrirModalDetalhesCliente(idCliente) {
    const cliente = clientesCache.find(c => String(c.id_cliente) === String(idCliente));
    if (!cliente) return;

    clienteEmEdicao = cliente;

    // Preencher Aba Perfil
    document.getElementById('edit-id-cliente').value = cliente.id_cliente;
    document.getElementById('edit-nome-cliente').value = cliente.nome;
    document.getElementById('edit-whatsapp-cliente').value = cliente.whatsapp;
    document.getElementById('edit-email-cliente').value = cliente.email;

    // Resetar filtros de data do histórico
    document.getElementById('filter-inicio-hist').value = '';
    document.getElementById('filter-fim-hist').value = '';

    // Renderizar Histórico inicial
    filtrarHistoricoCliente();

    // Abrir Modal na aba de Perfil
    if(typeof switchModalTab === 'function') switchModalTab('perfil-cliente');
    document.getElementById('modal-detalhes-cliente').classList.add('open');
}

function filtrarHistoricoCliente() {
    const container = document.getElementById('lista-historico-cliente');
    container.innerHTML = '';

    if (!clienteEmEdicao) return;

    // Obter filtros de data
    const inicioVal = document.getElementById('filter-inicio-hist').value;
    const fimVal = document.getElementById('filter-fim-hist').value;
    
    const inicio = inicioVal ? new Date(inicioVal) : null;
    const fim = fimVal ? new Date(fimVal) : null;

    // Filtrar agendamentos globais relacionados a este cliente
    // Verifica tanto pelo ID quanto pelo Nome (para manter compatibilidade com registros antigos)
    let historico = agendamentosCache.filter(ag => 
        String(ag.id_cliente) === String(clienteEmEdicao.id_cliente) || 
        (ag.nome_cliente && ag.nome_cliente.toLowerCase() === clienteEmEdicao.nome.toLowerCase())
    );

    // Aplicar filtro de data se selecionado
    if (inicio || fim) {
        historico = historico.filter(h => {
            const dataH = new Date(h.data_agendamento);
            // Ajuste para comparar apenas datas (ignorar horas)
            if (inicio && dataH < inicio) return false;
            if (fim && dataH > fim) return false;
            return true;
        });
    }

    // Ordenar (mais recente primeiro)
    historico.sort((a, b) => {
        return (b.data_agendamento + b.hora_inicio).localeCompare(a.data_agendamento + a.hora_inicio);
    });

    if (historico.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Nenhum histórico encontrado.</p>';
        return;
    }

    historico.forEach(h => {
        // Encontrar nome do serviço
        const servico = servicosCache.find(s => String(s.id_servico) === String(h.id_servico));
        const nomeServico = servico ? servico.nome_servico : (h.id_servico === 'BLOQUEIO' ? 'Bloqueio' : 'Serviço');
        
        let statusClass = 'text-blue-600';
        if (h.status === 'Concluido') statusClass = 'text-green-600';
        else if (h.status === 'Cancelado') statusClass = 'text-red-400 line-through';
        else if (h.status === 'Bloqueado') statusClass = 'text-slate-500';

        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-sm';
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-700">${formatarDataBr(h.data_agendamento)} <span class="font-normal text-xs text-slate-400">${h.hora_inicio}</span></p>
                <p class="text-xs text-slate-500">${nomeServico}</p>
            </div>
            <span class="text-xs font-bold uppercase ${statusClass}">${h.status}</span>
        `;
        container.appendChild(div);
    });
}

async function salvarEdicaoCliente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-update-cliente');
    const originalText = btn.innerText;
    setLoading(btn, true, 'Salvar');

    const id = document.getElementById('edit-id-cliente').value;
    const nome = document.getElementById('edit-nome-cliente').value;
    const whatsapp = document.getElementById('edit-whatsapp-cliente').value;
    const email = document.getElementById('edit-email-cliente').value;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateCliente',
                id_cliente: id,
                nome: nome,
                whatsapp: whatsapp,
                email: email
            })
        });

        // Atualizar cache local imediatamente
        const idx = clientesCache.findIndex(c => String(c.id_cliente) === String(id));
        if (idx !== -1) {
            clientesCache[idx].nome = nome;
            clientesCache[idx].whatsapp = whatsapp;
            clientesCache[idx].email = email;
            
            // Re-salvar no localStorage
            if(typeof saveToCache === 'function') saveToCache('clientes', clientesCache);
        }

        if(typeof fecharModal === 'function') fecharModal('modal-detalhes-cliente');
        renderizarListaClientes();
        if(typeof mostrarAviso === 'function') mostrarAviso('Cliente atualizado!');

    } catch (error) {
        if(typeof mostrarAviso === 'function') mostrarAviso('Erro ao atualizar.');
        console.error(error);
    } finally {
        setLoading(btn, false, originalText);
    }
}

function excluirCliente() {
    if (!clienteEmEdicao) return;
    
    if(typeof mostrarConfirmacao === 'function') {
        mostrarConfirmacao('Excluir Cliente', 'Tem a certeza? O histórico será mantido, mas o cliente não aparecerá na lista.', async () => {
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
                
                if(typeof fecharModal === 'function') {
                    fecharModal('modal-confirmacao');
                    fecharModal('modal-detalhes-cliente');
                }
                
                renderizarListaClientes();
                if(typeof mostrarAviso === 'function') mostrarAviso('Cliente excluído.');
                
            } catch (error) {
                if(typeof mostrarAviso === 'function') mostrarAviso('Erro ao excluir.');
            }
        });
    }
}