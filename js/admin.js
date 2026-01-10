// ==========================================
// GESTÃO DE SERVIÇOS
// ==========================================

function carregarServicos() { 
    fetch(`${API_URL}?action=getServicos`)
        .then(r => r.json())
        .then(d => { 
            servicosCache = d; 
            renderizarListaServicos(); 
            atualizarDatalistServicos(); 
        }); 
}

function renderizarListaServicos() { 
    const container = document.getElementById('lista-servicos'); 
    if (!container) return;
    container.innerHTML = ''; 
    servicosCache.forEach(s => { 
        const div = document.createElement('div'); 
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center'; 
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background-color: ${getCorServico(s)}">${s.nome_servico.charAt(0)}</div>
                <div>
                    <h4 class="font-bold text-slate-800">${s.nome_servico}</h4>
                    <p class="text-xs text-slate-500">${s.duracao_minutos} min • R$ ${parseFloat(s.valor_unitario).toFixed(2)}</p>
                </div>
            </div>
            <button onclick="abrirModalEditarServico('${s.id_servico}')" class="text-slate-400 hover:text-blue-600"><i data-lucide="edit-2" class="w-5 h-5"></i></button>`; 
        container.appendChild(div); 
    }); 
    if(typeof lucide !== 'undefined') lucide.createIcons(); 
}

function atualizarDatalistServicos() { 
    const dl = document.getElementById('lista-servicos-datalist'); 
    if (dl) { 
        dl.innerHTML = ''; 
        servicosCache.forEach(i => { 
            const o = document.createElement('option'); 
            o.value = i.nome_servico; 
            dl.appendChild(o); 
        }); 
    } 
}

function abrirModalServico() { 
    document.getElementById('modal-servico').classList.add('open'); 
}

function abrirModalEditarServico(id) { 
    const s = servicosCache.find(x => x.id_servico === id); 
    if (!s) return; 
    
    document.getElementById('edit-id-servico').value = s.id_servico; 
    document.getElementById('edit-nome-servico').value = s.nome_servico; 
    document.getElementById('edit-valor-servico').value = s.valor_unitario; 
    document.getElementById('edit-duracao-servico').value = s.duracao_minutos; 
    document.getElementById('edit-check-online-booking').checked = String(s.agendamento_online) === 'true'; 
    document.getElementById('edit-input-cor-selecionada').value = getCorServico(s); 
    
    renderizarColorPickerEdicao(); 
    document.getElementById('modal-editar-servico').classList.add('open'); 
}

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
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'createServico', 
                nome_servico: f.nome_servico.value, 
                valor_unitario: f.valor_unitario.value, 
                duracao_minutos: f.duracao_minutos.value, 
                cor_hex: document.getElementById('input-cor-selecionada').value, 
                imagem_url: imagemUrl, 
                online_booking: document.getElementById('check-online-booking').checked 
            }) 
        }); 
        
        fecharModal('modal-servico'); 
        f.reset(); 
        carregarServicos(); 
    } catch (e) { 
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
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'updateServico', 
                id_servico: f.id_servico.value, 
                nome_servico: f.nome_servico.value, 
                valor_unitario: f.valor_unitario.value, 
                duracao_minutos: f.duracao_minutos.value, 
                cor_hex: f.cor_hex.value, 
                online_booking: document.getElementById('edit-check-online-booking').checked, 
                imagem_url: imagemUrl 
            }) 
        }); 
        
        fecharModal('modal-editar-servico'); 
        carregarServicos(); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}

function excluirServicoViaModal() { 
    const id = document.getElementById('edit-id-servico').value; 
    mostrarConfirmacao('Excluir Serviço', 'Tem certeza?', async () => { 
        try { 
            await fetch(API_URL, {method: 'POST', body: JSON.stringify({action: 'deleteServico', id_servico: id})}); 
            fecharModal('modal-confirmacao'); 
            fecharModal('modal-editar-servico'); 
            carregarServicos(); 
        } catch (e) { 
            mostrarAviso('Erro'); 
        } 
    }); 
}

// ==========================================
// GESTÃO DE EQUIPA (USUÁRIOS)
// ==========================================

function carregarUsuarios() { 
    fetch(`${API_URL}?action=getUsuarios`)
        .then(r => r.json())
        .then(d => { 
            usuariosCache = d; 
            renderizarListaUsuarios(); 
            popularSelectsUsuarios(); 
        }); 
}

function renderizarListaUsuarios() { 
    const container = document.getElementById('lista-usuarios'); 
    if (!container) return;
    container.innerHTML = ''; 
    usuariosCache.forEach(u => { 
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">${u.nome.charAt(0)}</div>
                    <div>
                        <h4 class="font-bold text-slate-800">${u.nome}</h4>
                        <p class="text-xs text-slate-400 capitalize">${u.nivel}</p>
                    </div>
                </div>
            </div>`; 
    }); 
}

function popularSelectsUsuarios() { 
    const selectHeader = document.getElementById('select-profissional-agenda'); 
    if (selectHeader) {
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
    }
    
    const selectModal = document.getElementById('select-prof-modal'); 
    if (selectModal) {
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
}

function abrirModalUsuario() { 
    document.getElementById('modal-usuario').classList.add('open'); 
}

async function salvarUsuario(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-salvar-usuario'); 
    setLoading(btn, true, 'Salvar'); 
    const f = e.target; 
    
    try { 
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'createUsuario', 
                nome: f.nome.value, 
                email: f.email.value, 
                senha: f.senha.value, 
                nivel: f.nivel.value, 
                cor: '#3b82f6' 
            }) 
        }); 
        
        fecharModal('modal-usuario'); 
        f.reset(); 
        carregarUsuarios(); 
        mostrarAviso('Profissional adicionado!'); 
    } catch (e) { 
        mostrarAviso('Erro'); 
    } finally { 
        setLoading(btn, false, 'Salvar'); 
    } 
}

// ==========================================
// GESTÃO DE CLIENTES
// ==========================================

function abrirModalCliente() { 
    document.getElementById('modal-cliente').classList.add('open'); 
}

function atualizarDatalistClientes() { 
    const dl = document.getElementById('lista-clientes'); 
    if (dl) { 
        dl.innerHTML = ''; 
        clientesCache.forEach(c => { 
            const o = document.createElement('option'); 
            o.value = c.nome; 
            dl.appendChild(o); 
        }); 
    } 
}

async function salvarNovoCliente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-cliente');
    setLoading(btn, true, 'Salvar');
    const f = e.target;
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'createCliente',
                nome: f.nome.value,
                whatsapp: f.whatsapp.value,
                email: f.email.value
            })
        });
        const data = await res.json();
        
        if (data.status === 'sucesso') {
            clientesCache.push({
                id_cliente: data.id_cliente,
                nome: data.nome,
                whatsapp: f.whatsapp.value
            });
            atualizarDatalistClientes();
            document.getElementById('input-cliente-nome').value = data.nome;
            fecharModal('modal-cliente');
            f.reset();
            mostrarAviso('Cliente cadastrado!');
        } else {
            mostrarAviso('Erro ao cadastrar.');
        }
    } catch (e) {
        mostrarAviso('Erro de conexão.');
    } finally {
        setLoading(btn, false, 'Salvar');
    }
}

// ==========================================
// GESTÃO DE CONFIGURAÇÕES
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
    if (!container) return;
    container.innerHTML = '';

    const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    if (!config.horarios_semanais || !Array.isArray(config.horarios_semanais) || config.horarios_semanais.length === 0) {
        config.horarios_semanais = [];
        for (let i = 0; i < 7; i++) {
            config.horarios_semanais.push({
                dia: i,
                ativo: i !== 0,
                inicio: '08:00',
                fim: '19:00'
            });
        }
    }

    config.horarios_semanais.forEach(dia => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100';
        
        const isChecked = dia.ativo ? 'checked' : '';
        const opacityClass = dia.ativo ? '' : 'opacity-50';
        const pointerEvents = dia.ativo ? '' : 'pointer-events-none';

        div.innerHTML = `
            <div class="flex items-center gap-3 w-1/3">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="day-active-${dia.dia}" class="sr-only peer" ${isChecked} onchange="toggleDiaConfig(${dia.dia})">
                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span class="text-sm font-bold text-slate-700">${diasNomes[dia.dia]}</span>
            </div>
            <div id="day-times-${dia.dia}" class="flex items-center gap-2 w-2/3 justify-end ${opacityClass} ${pointerEvents}">
                <input type="time" id="day-start-${dia.dia}" value="${dia.inicio}" class="bg-white border border-slate-200 rounded-lg p-1 text-sm text-center w-20 outline-none">
                <span class="text-slate-400 text-xs">até</span>
                <input type="time" id="day-end-${dia.dia}" value="${dia.fim}" class="bg-white border border-slate-200 rounded-lg p-1 text-sm text-center w-20 outline-none">
            </div>
        `;
        container.appendChild(div);
    });
}

// Tornar a função toggleDiaConfig global para funcionar no onchange do HTML
window.toggleDiaConfig = function(diaIndex) {
    const checkbox = document.getElementById(`day-active-${diaIndex}`);
    const timeContainer = document.getElementById(`day-times-${diaIndex}`);
    
    if (checkbox.checked) {
        timeContainer.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        timeContainer.classList.add('opacity-50', 'pointer-events-none');
    }
};

function renderizarListaMsgRapidasConfig() {
    const div = document.getElementById('lista-msg-rapidas');
    if (!div) return;
    div.innerHTML = '';
    if (!config.mensagens_rapidas) config.mensagens_rapidas = [];
    
    config.mensagens_rapidas.forEach((msg, idx) => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200';
        item.innerHTML = `
            <span class="text-xs text-slate-600 truncate flex-1 mr-2">${msg}</span>
            <button onclick="removerMsgRapida(${idx})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
        div.appendChild(item);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function adicionarMsgRapida() {
    const input = document.getElementById('nova-msg-rapida');
    const val = input.value.trim();
    if (!val) return;
    if (!config.mensagens_rapidas) config.mensagens_rapidas = [];
    config.mensagens_rapidas.push(val);
    input.value = '';
    renderizarListaMsgRapidasConfig();
}

function removerMsgRapida(idx) {
    config.mensagens_rapidas.splice(idx, 1);
    renderizarListaMsgRapidasConfig();
}

async function salvarConfigAPI(btn) { 
    const originalText = btn.innerText; 
    setLoading(btn, true, originalText); 
    
    const intervalo = document.getElementById('cfg-intervalo').value; 
    const encaixe = document.getElementById('cfg-concorrencia').checked; 
    const msgLembrete = document.getElementById('cfg-lembrete-template').value;
    const msgsRapidas = config.mensagens_rapidas;

    const novosHorarios = [];
    for (let i = 0; i < 7; i++) {
        novosHorarios.push({
            dia: i,
            ativo: document.getElementById(`day-active-${i}`).checked,
            inicio: document.getElementById(`day-start-${i}`).value,
            fim: document.getElementById(`day-end-${i}`).value
        });
    }

    const diaAtivo = novosHorarios.find(d => d.ativo) || { inicio: '08:00', fim: '19:00' };

    try { 
        await fetch(API_URL, {method: 'POST', body: JSON.stringify({ 
            action: 'saveConfig', 
            abertura: diaAtivo.inicio, 
            fechamento: diaAtivo.fim, 
            intervalo_minutos: intervalo, 
            permite_encaixe: encaixe,
            mensagem_lembrete: msgLembrete,
            mensagens_rapidas: msgsRapidas,
            horarios_semanais: novosHorarios
        })}); 
        
        config.abertura = diaAtivo.inicio;
        config.fechamento = diaAtivo.fim;
        config.intervalo_minutos = parseInt(intervalo);
        config.permite_encaixe = encaixe;
        config.mensagem_lembrete = msgLembrete;
        config.horarios_semanais = novosHorarios;
        
        saveToCache('config', config);
        // Se a grade estiver visível, pode ser necessário atualizar, mas como é admin, provavelmente não
        mostrarAviso('Configurações salvas!'); 
    } catch (e) { 
        mostrarAviso('Erro ao salvar.'); 
    } finally { 
        setLoading(btn, false, originalText); 
    } 
}