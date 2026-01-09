// ==========================================
// CONSTANTES GLOBAIS
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbxgSkDYPhTJerGbFsubJE9b_xuwCM6KnAtWh5gFF3WEIEGFWf-SIHd_iWUH3J4JitWUHA/exec';
const PALETA_CORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const IMGBB_API_KEY = 'fa0265b3bfc740c1eb09a7e4d6ec493a';
const CACHE_KEY_PREFIX = 'minhaAgenda_';

// ==========================================
// ESTADO GLOBAL (VARIÁVEIS)
// ==========================================
// Inicializadas aqui para estarem acessíveis em todo o escopo (api.js, ui.js, app.js)
let currentUser = null;
let currentProfId = null;
let dataAtual = new Date();
let servicosCache = [];
let agendamentosCache = [];
let clientesCache = [];
let pacotesCache = [];
let usuariosCache = [];
let itensPacoteTemp = [];
let abaAtiva = 'agenda';
let config = { 
    abertura: '08:00', 
    fechamento: '19:00', 
    intervalo_minutos: 60, 
    permite_encaixe: false,
    mensagem_lembrete: "Olá {cliente}, seu agendamento é dia {data} às {hora}.",
    mensagens_rapidas: [] 
};
let agendamentosRaw = [];
let isSyncing = false;
let pollingInterval = null;

// ==========================================
// FUNÇÕES DE CACHE LOCAL
// ==========================================
function saveToCache(key, data) { 
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(data)); 
}

function getFromCache(key) { 
    const data = localStorage.getItem(CACHE_KEY_PREFIX + key); 
    return data ? JSON.parse(data) : null; 
}

// ==========================================
// FORMATAÇÃO E DATA/HORA
// ==========================================
function formatarDataBr(s) { 
    if(!s) return ''; 
    if(s.includes('T')) return new Date(s).toLocaleDateString('pt-BR'); 
    return s.split('-').reverse().join('/'); 
}

function calcularHoraFim(inicio, duracao) { 
    const [h, m] = inicio.split(':').map(Number); 
    const fimMin = h * 60 + m + parseInt(duracao); 
    return `${String(Math.floor(fimMin / 60)).padStart(2,'0')}:${String(fimMin % 60).padStart(2,'0')}`; 
}

// ==========================================
// CORES E VISUAL
// ==========================================
function getCorServico(s) { 
    return s ? (s.cor_hex || s.cor || '#3b82f6') : '#3b82f6'; 
}

function hexToRgba(hex, a) { 
    if(!hex) return `rgba(59,130,246,${a})`; 
    hex = hex.replace('#',''); 
    return `rgba(${parseInt(hex.substring(0,2),16)},${parseInt(hex.substring(2,4),16)},${parseInt(hex.substring(4,6),16)},${a})`; 
}

function hexToRgb(hex) { 
    var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); 
    return r ? parseInt(r[1],16)+", "+parseInt(r[2],16)+", "+parseInt(r[3],16) : "59,130,246"; 
}

// ==========================================
// HELPERS DE LÓGICA DE NEGÓCIO
// ==========================================
function getWhatsappCliente(idAgendamento) {
    const ag = agendamentosCache.find(a => a.id_agendamento === idAgendamento);
    if(!ag) return null;
    
    // Tenta achar cliente pelo ID
    let cliente = clientesCache.find(c => String(c.id_cliente) === String(ag.id_cliente));
    
    // Se não achar pelo ID (casos antigos ou manuais), tenta pelo nome
    if(!cliente) {
        cliente = clientesCache.find(c => c.nome === ag.nome_cliente);
    }
    
    if(cliente && cliente.whatsapp) {
        let nums = String(cliente.whatsapp).replace(/\D/g, ''); 
        
        // Lógica para garantir o +55
        if (!nums.startsWith('55') && (nums.length === 10 || nums.length === 11)) {
            nums = '55' + nums;
        }
        
        return nums;
    }
    return null;
}