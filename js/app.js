// ==========================================
// INICIALIZAÇÃO E EVENTOS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa ícones (Lucide)
    lucide.createIcons();
    
    // Verifica sessão salva
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if(savedUser) { 
        currentUser = JSON.parse(savedUser); 
        iniciarApp(); 
    }
    
    // Fechar modais ao clicar fora (Overlay)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // Se for o menu lateral, usa a função específica
                if (overlay.id === 'menu-overlay') {
                    toggleMenu();
                } else {
                    fecharModal(overlay.id);
                }
            }
        });
    });

    // Prevenir saída durante sincronização
    window.addEventListener('beforeunload', function (e) {
        if (isSyncing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// ==========================================
// CICLO DE VIDA DA APLICAÇÃO
// ==========================================

function iniciarApp() {
    // UI Transitions
    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('app-header').classList.remove('hidden'); 
    document.getElementById('app-header').classList.add('flex'); 
    // Navbar inferior removida no novo design
    // document.getElementById('bottom-nav').classList.remove('hidden'); 
    
    document.getElementById('main-fab').classList.remove('hidden'); 
    document.getElementById('main-fab').classList.add('flex'); 
    
    // User Info (Agora no Menu Lateral também)
    if(document.getElementById('user-name-display')) {
        document.getElementById('user-name-display').innerText = `Olá, ${currentUser.nome}`;
    }
    if(document.getElementById('menu-user-name')) {
        document.getElementById('menu-user-name').innerText = currentUser.nome;
        document.getElementById('menu-user-email').innerText = currentUser.email;
    }

    document.getElementById('tab-agenda').classList.add('active');
    
    currentProfId = String(currentUser.id_usuario); 
    
    // Admin Checks
    if (currentUser.nivel !== 'admin') { 
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); 
    } else { 
        const selProf = document.getElementById('select-profissional-agenda');
        if(selProf) selProf.classList.remove('hidden'); 
    }
    
    // Inicializações Visuais
    renderizarColorPicker(); 
    renderizarColorPickerEdicao(); 
    
    // Carregamento de Dados
    carregarDoCache(); 
    sincronizarDadosAPI(); 
    
    // Polling de Agendamentos (cada 15s)
    pollingInterval = setInterval(() => recarregarAgendaComFiltro(true), 15000);
}

function carregarDoCache() {
    const cachedServicos = getFromCache('servicos');
    const cachedConfig = getFromCache('config');
    const cachedUsuarios = getFromCache('usuarios');
    const cachedAgendamentos = getFromCache('agendamentos');
    const cachedClientes = getFromCache('clientes');
    const cachedPacotes = getFromCache('pacotes');

    if(cachedServicos) { 
        servicosCache = cachedServicos; 
        renderizarListaServicos(); 
        atualizarDatalistServicos(); 
    }
    
    if(cachedConfig) { 
        config = cachedConfig; 
        atualizarUIConfig(); 
    }
    
    if(cachedUsuarios) { 
        usuariosCache = cachedUsuarios; 
        popularSelectsUsuarios(); 
        renderizarListaUsuarios(); 
    }
    
    if(cachedAgendamentos) { 
        agendamentosRaw = cachedAgendamentos; 
    }
    
    if(cachedClientes) { 
        clientesCache = cachedClientes; 
        atualizarDatalistClientes(); 
    }
    
    if(cachedPacotes) { 
        pacotesCache = cachedPacotes; 
    }
    
    // Atualiza o painel e RENDERIZA O CALENDÁRIO SEMANAL
    atualizarDataEPainel();
}
