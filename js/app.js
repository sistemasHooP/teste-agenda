// ==========================================
// INICIALIZAÇÃO E EVENTOS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa ícones
    lucide.createIcons();
    
    // Verifica sessão salva
    const savedUser = localStorage.getItem('minhaAgendaUser') || sessionStorage.getItem('minhaAgendaUser');
    if(savedUser) { 
        currentUser = JSON.parse(savedUser); 
        iniciarApp(); 
    }
    
    // Listener do DatePicker
    document.getElementById('data-picker').addEventListener('change', (e) => { 
        const p=e.target.value.split('-'); 
        dataAtual=new Date(p[0],p[1]-1,p[2]); 
        atualizarDataEPainel(); 
    });

    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal(overlay.id);
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
    document.getElementById('bottom-nav').classList.remove('hidden'); 
    document.getElementById('bottom-nav').classList.add('flex'); 
    document.getElementById('main-fab').classList.remove('hidden'); 
    document.getElementById('main-fab').classList.add('flex'); 
    
    // User Info
    document.getElementById('user-name-display').innerText = `Olá, ${currentUser.nome}`; 
    document.getElementById('tab-agenda').classList.add('active');
    
    currentProfId = String(currentUser.id_usuario); 
    
    // Admin Checks
    if (currentUser.nivel !== 'admin') { 
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); 
    } else { 
        document.getElementById('select-profissional-agenda').classList.remove('hidden'); 
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
    
    atualizarDataEPainel();
}