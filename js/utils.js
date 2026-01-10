// --- UTILS DE UI E HELPERS ---

function formatarDataBr(s) { 
    if (!s) return ''; 
    if (s.includes('T')) return new Date(s).toLocaleDateString('pt-BR'); 
    return s.split('-').reverse().join('/'); 
}

function calcularHoraFim(inicio, duracao) { 
    const [h, m] = inicio.split(':').map(Number); 
    const fimMin = h * 60 + m + parseInt(duracao); 
    return `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`; 
}

function mostrarAviso(msg) { 
    document.getElementById('aviso-msg').innerText = msg; 
    document.getElementById('modal-aviso').classList.add('open'); 
}

function mostrarConfirmacao(t, m, yesCb, noCb, yesTxt = 'Sim', noTxt = 'Cancelar') { 
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
    newN.onclick = () => { fecharModal('modal-confirmacao'); if (noCb) noCb(); }; 
    
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

function getCorServico(s) { 
    return s ? (s.cor_hex || s.cor || '#3b82f6') : '#3b82f6'; 
}

function hexToRgba(hex, a) { 
    if (!hex) return `rgba(59,130,246,${a})`; 
    hex = hex.replace('#', ''); 
    return `rgba(${parseInt(hex.substring(0, 2), 16)},${parseInt(hex.substring(2, 4), 16)},${parseInt(hex.substring(4, 6), 16)},${a})`; 
}

function fecharModal(id) { 
    document.getElementById(id).classList.remove('open'); 
    if (id === 'modal-agendamento') document.getElementById('area-pacote-info')?.classList.add('hidden'); 
}

// --- COLOR PICKERS ---

function renderizarColorPicker() { 
    const c = document.getElementById('color-picker-container'); 
    c.innerHTML = ''; 
    PALETA_CORES.forEach((cor, i) => {
        const d = document.createElement('div');
        d.className = `color-option ${i === 4 ? 'selected' : ''}`;
        d.style.backgroundColor = cor;
        d.onclick = () => {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('input-cor-selecionada').value = cor;
        };
        c.appendChild(d);
    });
}

function renderizarColorPickerEdicao() { 
    const c = document.getElementById('edit-color-picker-container'); 
    c.innerHTML = ''; 
    PALETA_CORES.forEach((cor, i) => {
        const d = document.createElement('div');
        d.className = `color-option ${i === 4 ? 'selected' : ''}`;
        d.style.backgroundColor = cor;
        d.onclick = () => {
            document.querySelectorAll('#edit-color-picker-container .color-option').forEach(el => el.classList.remove('selected'));
            d.classList.add('selected');
            document.getElementById('edit-input-cor-selecionada').value = cor;
        };
        c.appendChild(d);
    });
}

function showSyncIndicator(show) { 
    isSyncing = show; 
    document.getElementById('sync-indicator').style.display = show ? 'flex' : 'none'; 
}