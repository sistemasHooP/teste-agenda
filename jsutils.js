/**
 * Constantes Globais de Utilidade
 */
const PALETA_CORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const IMGBB_API_KEY = 'fa0265b3bfc740c1eb09a7e4d6ec493a';
const CACHE_KEY_PREFIX = 'minhaAgenda_';

/**
 * Gerenciamento de Cache Local
 */
function saveToCache(key, data) {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(data));
}

function getFromCache(key) {
    const data = localStorage.getItem(CACHE_KEY_PREFIX + key);
    return data ? JSON.parse(data) : null;
}

/**
 * Formatação de Dados e Utilitários
 */
function formatarDataBr(s) {
    if (!s) return '';
    if (s.includes('T')) return new Date(s).toLocaleDateString('pt-BR');
    return s.split('-').reverse().join('/');
}

function getCorServico(s) {
    return s ? (s.cor_hex || s.cor || '#3b82f6') : '#3b82f6';
}

function hexToRgba(hex, a) {
    if (!hex) return `rgba(59,130,246,${a})`;
    hex = hex.replace('#', '');
    return `rgba(${parseInt(hex.substring(0,2),16)},${parseInt(hex.substring(2,4),16)},${parseInt(hex.substring(4,6),16)},${a})`;
}

function calcularHoraFim(inicio, duracao) {
    const [h, m] = inicio.split(':').map(Number);
    const fimMin = h * 60 + m + parseInt(duracao);
    return `${String(Math.floor(fimMin / 60)).padStart(2,'0')}:${String(fimMin % 60).padStart(2,'0')}`;
}