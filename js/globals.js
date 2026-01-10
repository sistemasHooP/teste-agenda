// --- CONSTANTES ---
const API_URL = 'https://script.google.com/macros/s/AKfycbxgSkDYPhTJerGbFsubJE9b_xuwCM6KnAtWh5gFF3WEIEGFWf-SIHd_iWUH3J4JitWUHA/exec';
const PALETA_CORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const IMGBB_API_KEY = 'fa0265b3bfc740c1eb09a7e4d6ec493a';
const CACHE_KEY_PREFIX = 'minhaAgenda_';

// --- ESTADO GLOBAL ---
let currentUser = null;
let currentProfId = null;
let dataAtual = new Date(); // Data selecionada (foco)
let servicosCache = [];
let agendamentosCache = [];
let clientesCache = [];
let pacotesCache = [];
let usuariosCache = [];
let itensPacoteTemp = [];
let pacoteSelecionado = null; // Armazena o pacote aberto no modal
let abaAtiva = 'agenda';
let abaPacotesAtiva = 'ativos'; // 'ativos' ou 'historico'

let config = { 
    abertura: '08:00', 
    fechamento: '19:00', 
    intervalo_minutos: 60, 
    permite_encaixe: false,
    mensagem_lembrete: "Olá {cliente}, seu agendamento é dia {data} às {hora}.",
    mensagens_rapidas: [],
    horarios_semanais: [] 
};

let agendamentosRaw = [];
let isSyncing = false;
let isSaving = false; // Flag para bloquear updates durante salvamento
let pollingInterval = null;