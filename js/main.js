// js/main.js
// Funções compartilhadas entre todas as páginas

// Variáveis globais compartilhadas
let ocorrencias = [];
let currentUser = null;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const ENCRYPTION_KEY = 'cipa-ocorrencias-2024-secret-key';
const SYNC_CHANNEL = 'ocorrencias_sync_channel';

// =============================================
// INICIALIZAÇÃO COMPARTILHADA
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeSharedApp();
});

function initializeSharedApp() {
    setupSharedEventListeners();
    checkSavedCredentials();
    loadOcorrenciasFromStorage();
    setupAutoBackup();
    setupSyncSystem();
    
    // Sincronização inicial rápida
    setTimeout(() => {
        solicitarSincronizacao();
    }, 3000);
}

function setupSharedEventListeners() {
    // Botão admin (presente em todas as páginas)
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', showLoginModal);
    }
    
    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const loginCancel = document.getElementById('loginCancel');
    if (loginCancel) {
        loginCancel.addEventListener('click', hideLoginModal);
    }
    
    // Modais compartilhados
    setupModalEvents();
}

// =============================================
// SISTEMA DE SINCRONIZAÇÃO
// =============================================

function setupSyncSystem() {
    setupBroadcastChannel();
    setupLocalStorageSync();
    
    // Sincronização a cada 30 segundos
    setInterval(() => {
        if (ocorrencias.length > 0) {
            solicitarSincronizacao();
        }
    }, 30000);
}

function setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            
            channel.addEventListener('message', (event) => {
                switch (event.data.type) {
                    case 'SYNC_REQUEST':
                        enviarDadosSincronizacao(channel);
                        break;
                    case 'SYNC_DATA':
                        processarDadosSincronizacao(event.data);
                        break;
                    case 'NEW_OCORRENCIA':
                        processarNovaOcorrencia(event.data.ocorrencia);
                        break;
                    case 'OCORRENCIA_UPDATED':
                        processarOcorrenciaAtualizada(event.data.ocorrencia);
                        break;
                    case 'SYNC_PING':
                        responderPing(channel, event.data);
                        break;
                }
            });
            
            // Ping para descobrir outros dispositivos
            setTimeout(() => {
                channel.postMessage({ 
                    type: 'SYNC_PING',
                    timestamp: Date.now(),
                    deviceId: getDeviceId()
                });
            }, 2000);
            
        } catch (error) {
            console.log('BroadcastChannel não suportado, usando fallback');
        }
    }
}

function setupLocalStorageSync() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'ocorrencias_encrypted' && event.newValue) {
            const remoteData = decryptData(event.newValue);
            if (remoteData && Array.isArray(remoteData)) {
                mergeOcorrencias(remoteData);
            }
        }
    });
}

function solicitarSincronizacao() {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            channel.postMessage({ 
                type: 'SYNC_REQUEST',
                timestamp: Date.now(),
                deviceId: getDeviceId()
            });
            updateSyncIndicator('Sincronizando...', 'syncing');
        } catch (error) {
            console.log('Erro ao solicitar sincronização');
        }
    }
}

function enviarDadosSincronizacao(channel) {
    const syncData = {
        type: 'SYNC_DATA',
        ocorrencias: ocorrencias,
        timestamp: Date.now(),
        deviceId: getDeviceId(),
        totalOcorrencias: ocorrencias.length
    };
    
    channel.postMessage(syncData);
}

function processarDadosSincronizacao(data) {
    if (data.ocorrencias && Array.isArray(data.ocorrencias)) {
        const antes = ocorrencias.length;
        mergeOcorrencias(data.ocorrencias);
        const depois = ocorrencias.length;
        
        if (depois > antes) {
            showSyncNotification(`${depois - antes} nova(s) ocorrência(s) sincronizada(s)`);
        }
        updateSyncIndicator('Sincronizado', 'synced');
    }
}

function processarNovaOcorrencia(ocorrencia) {
    const exists = ocorrencias.some(d => d.id === ocorrencia.id);
    if (!exists) {
        ocorrencias.push(ocorrencia);
        saveOcorrenciasToStorage();
        showSyncNotification('Nova ocorrência recebida de outro dispositivo');
        
        if (isLoggedIn()) {
            if (typeof loadOcorrencias === 'function') loadOcorrencias();
            if (typeof loadStats === 'function') loadStats();
        }
    }
}

function processarOcorrenciaAtualizada(ocorrencia) {
    const index = ocorrencias.findIndex(d => d.id === ocorrencia.id);
    if (index !== -1) {
        ocorrencias[index] = ocorrencia;
        saveOcorrenciasToStorage();
        
        if (isLoggedIn()) {
            if (typeof loadOcorrencias === 'function') loadOcorrencias();
            if (typeof loadStats === 'function') loadStats();
        }
    }
}

function responderPing(channel, data) {
    if (data.deviceId !== getDeviceId()) {
        channel.postMessage({ 
            type: 'SYNC_PONG',
            timestamp: Date.now(),
            deviceId: getDeviceId(),
            totalOcorrencias: ocorrencias.length
        });
    }
}

function mergeOcorrencias(remoteOcorrencias) {
    let hasChanges = false;
    let newOcorrencias = 0;
    
    remoteOcorrencias.forEach(remoteOcorrencia => {
        const localIndex = ocorrencias.findIndex(local => local.id === remoteOcorrencia.id);
        
        if (localIndex === -1) {
            ocorrencias.push(remoteOcorrencia);
            hasChanges = true;
            newOcorrencias++;
        } else {
            const localOcorrencia = ocorrencias[localIndex];
            if (shouldUpdate(localOcorrencia, remoteOcorrencia)) {
                ocorrencias[localIndex] = remoteOcorrencia;
                hasChanges = true;
            }
        }
    });
    
    if (hasChanges) {
        saveOcorrenciasToStorage();
        if (isLoggedIn()) {
            if (typeof loadOcorrencias === 'function') loadOcorrencias();
            if (typeof loadStats === 'function') loadStats();
        }
    }
    
    return newOcorrencias;
}

function shouldUpdate(local, remote) {
    const localTime = new Date(local.ultimaAtualizacao || local.dataRegistro).getTime();
    const remoteTime = new Date(remote.ultimaAtualizacao || remote.dataRegistro).getTime();
    return remoteTime > localTime;
}

function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

function updateSyncIndicator(text, status) {
    const indicator = document.getElementById('syncIndicator');
    if (indicator) {
        indicator.textContent = status === 'syncing' ? '🔄 ' + text : '✅ ' + text;
        indicator.className = `sync-indicator ${status}`;
    }
}

function showSyncNotification(message) {
    // Remove notificações existentes
    const existingNotifications = document.querySelectorAll('.sync-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// =============================================
// SISTEMA DE PROTOCOLO
// =============================================

function generateProtocolo() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `CIPA-${dateStr}-${randomStr}`;
}

function showProtocoloModal(protocolo) {
    document.getElementById('protocoloNumber').textContent = protocolo;
    document.getElementById('protocoloModal').style.display = 'block';
}

function fecharProtocolo() {
    document.getElementById('protocoloModal').style.display = 'none';
}

function copiarProtocolo() {
    const protocolo = document.getElementById('protocoloNumber').textContent;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(protocolo).then(() => {
            alert('✅ Protocolo copiado para a área de transferência!');
        }).catch(() => {
            fallbackCopyToClipboard(protocolo);
        });
    } else {
        fallbackCopyToClipboard(protocolo);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        alert('✅ Protocolo copiado para a área de transferência!');
    } catch (err) {
        alert('❌ Erro ao copiar protocolo. Por favor, copie manualmente.');
    }
    
    document.body.removeChild(textArea);
}

// =============================================
// CRIPTOGRAFIA E ARMAZENAMENTO
// =============================================

function encryptData(data) {
    try {
        return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
    } catch (error) {
        console.error('Erro ao criptografar dados:', error);
        return null;
    }
}

function decryptData(encryptedData) {
    try {
        if (!encryptedData) return null;
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted ? JSON.parse(decrypted) : null;
    } catch (error) {
        console.error('Erro ao descriptografar dados:', error);
        return null;
    }
}

function saveOcorrenciasToStorage() {
    try {
        const encrypted = encryptData(ocorrencias);
        if (encrypted) {
            localStorage.setItem('ocorrencias_encrypted', encrypted);
            localStorage.setItem('ocorrencias_backup', encrypted);
            syncWithOtherDevices();
        }
    } catch (error) {
        console.error('Erro ao salvar ocorrências:', error);
    }
}

function loadOcorrenciasFromStorage() {
    try {
        const encrypted = localStorage.getItem('ocorrencias_encrypted');
        if (encrypted) {
            const decrypted = decryptData(encrypted);
            if (decrypted && Array.isArray(decrypted)) {
                ocorrencias = decrypted;
                return;
            }
        }
        
        // Migração de dados legados (se houver)
        const legacyData = localStorage.getItem('denuncias');
        if (legacyData) {
            try {
                ocorrencias = JSON.parse(legacyData);
                saveOcorrenciasToStorage();
                localStorage.removeItem('denuncias');
            } catch (e) {
                console.error('Erro ao migrar dados legados:', e);
                ocorrencias = [];
            }
        } else {
            ocorrencias = [];
        }
    } catch (error) {
        console.error('Erro ao carregar ocorrências:', error);
        ocorrencias = [];
    }
}

function syncWithOtherDevices() {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            channel.postMessage({ type: 'SYNC_REQUEST' });
        } catch (error) {
            console.log('BroadcastChannel não disponível para sincronização');
        }
    }
}

// =============================================
// BACKUP AUTOMÁTICO
// =============================================

function setupAutoBackup() {
    setInterval(createAutoBackup, 6 * 60 * 60 * 1000); // 6 horas
    window.addEventListener('beforeunload', createAutoBackup);
}

function createAutoBackup() {
    try {
        const backupData = {
            ocorrencias: ocorrencias,
            timestamp: new Date().toISOString(),
            version: '2.0'
        };
        
        const encryptedBackup = encryptData(backupData);
        if (encryptedBackup) {
            localStorage.setItem('auto_backup_' + new Date().toISOString().split('T')[0], encryptedBackup);
            cleanupOldBackups();
        }
    } catch (error) {
        console.error('Erro ao criar backup automático:', error);
    }
}

function cleanupOldBackups() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('auto_backup_')) {
            const dateStr = key.replace('auto_backup_', '');
            const backupDate = new Date(dateStr);
            
            if (backupDate < oneWeekAgo) {
                localStorage.removeItem(key);
            }
        }
    }
}

// =============================================
// SISTEMA DE LOGIN
// =============================================

function checkSavedCredentials() {
    const savedUser = localStorage.getItem('adminUser');
    const savedPass = localStorage.getItem('adminPass');
    
    if (savedUser && savedPass) {
        currentUser = { username: savedUser };
    } else {
        // Credenciais padrão
        localStorage.setItem('adminUser', 'cipa');
        localStorage.setItem('adminPass', 'cipa2024');
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const savedUser = localStorage.getItem('adminUser');
    const savedPass = localStorage.getItem('adminPass');
    
    if (username === savedUser && password === savedPass) {
        currentUser = { username };
        hideLoginModal();
        showAdminModal();
        
        loadOcorrenciasFromStorage();
        if (typeof loadOcorrencias === 'function') loadOcorrencias();
        if (typeof loadStats === 'function') loadStats();
    } else {
        alert('❌ Credenciais inválidas. Tente novamente.');
    }
}

function isLoggedIn() {
    return currentUser !== null;
}

// =============================================
// GERENCIAMENTO DE MODAIS
// =============================================

function setupModalEvents() {
    const modals = [
        'confirmationModal',
        'loginModal', 
        'adminModal',
        'protocoloModal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
        }
    });
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Fechar modal com tecla ESC
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

function showConfirmationModal() {
    document.getElementById('confirmationModal').style.display = 'block';
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.reset();
    }
}

function showAdminModal() {
    if (!isLoggedIn()) {
        showLoginModal();
        return;
    }
    
    if (typeof loadOcorrencias === 'function') loadOcorrencias();
    if (typeof loadStats === 'function') loadStats();
    document.getElementById('adminModal').style.display = 'block';
}

function hideAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function formatTipoOcorrencia(tipo) {
    const tipos = {
        'assedio-moral': 'Assédio Moral',
        'assedio-sexual': 'Assédio Sexual',
        'discriminacao': 'Discriminação',
        'violencia': 'Violência',
        'assedio-virtual': 'Assédio Virtual',
        'outro': 'Outro'
    };
    return tipos[tipo] || tipo;
}

function formatTipoEnvolvimento(tipo) {
    const tipos = {
        'foi-comigo': 'Foi comigo',
        'presenciei': 'Presenciei'
    };
    return tipos[tipo] || tipo;
}

function formatLocalOcorrencia(local) {
    const locais = {
        'home-office': 'Home office',
        'ufjf': 'UFJF',
        'unidade-br-040': 'Unidade BR 040',
        'unidade-dom-orione': 'Unidade Dom Orione',
        'unidade-sao-mateus': 'Unidade São Mateus'
    };
    return locais[local] || local;
}

function formatDateDisplay(dateString) {
    if (!dateString) return 'N/A';
    
    if (dateString.length === 10) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDate(dateString, format = 'display') {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (format === 'file') {
        return date.toISOString().split('T')[0].replace(/-/g, '');
    }
    
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// =============================================
// ANIMAÇÕES CSS DINÂMICAS
// =============================================

// Adicionar estilos dinâmicos
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// =============================================
// FUNÇÕES PARA MODAIS DINÂMICOS (ADMIN)
// =============================================

function criarModalObservacao() {
    const modalHTML = `
        <div id="modalObservacao" class="modal-personalizado modal-observacao" role="dialog" aria-labelledby="observacaoTitle" aria-hidden="true">
            <div class="modal-personalizado-content">
                <div class="modal-personalizado-header">
                    <div class="modal-personalizado-icon" aria-hidden="true">📝</div>
                    <h3 class="modal-personalizado-title" id="observacaoTitle">Adicionar Observação</h3>
                </div>
                <div class="modal-personalizado-body">
                    <label class="modal-personalizado-label">
                        Observação para a ocorrência:
                        <span class="modal-tooltip" data-tooltip="Esta observação ficará visível no acompanhamento da ocorrência">ℹ️</span>
                    </label>
                    <textarea 
                        id="textareaObservacao" 
                        class="modal-personalizado-textarea" 
                        placeholder="Digite aqui as observações sobre o andamento desta ocorrência..."
                        maxlength="500"
                        aria-describedby="contadorObservacao"
                    ></textarea>
                    <div style="text-align: right; margin-top: 5px; font-size: 12px; color: #7f8c8d;">
                        <span id="contadorObservacao">0</span>/500 caracteres
                    </div>
                </div>
                <div class="modal-personalizado-actions">
                    <button type="button" class="modal-personalizado-btn modal-personalizado-btn-secondary" onclick="fecharModalObservacao()">
                        Cancelar
                    </button>
                    <button type="button" class="modal-personalizado-btn modal-personalizado-btn-primary" onclick="salvarObservacao()">
                        ✅ Salvar Observação
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar event listeners
    const textareaObs = document.getElementById('textareaObservacao');
    if (textareaObs) {
        textareaObs.addEventListener('input', atualizarContadorObservacao);
    }
    
    // Event listeners para fechar modal
    const modal = document.getElementById('modalObservacao');
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            fecharModalObservacao();
        }
    });
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            fecharModalObservacao();
        }
    });
}

function criarModalStatus() {
    const modalHTML = `
        <div id="modalStatus" class="modal-personalizado modal-status" role="dialog" aria-labelledby="statusTitle" aria-hidden="true">
            <div class="modal-personalizado-content">
                <div class="modal-personalizado-header">
                    <div class="modal-personalizado-icon" aria-hidden="true">🔄</div>
                    <h3 class="modal-personalizado-title" id="statusTitle">Atualizar Status</h3>
                </div>
                <div class="modal-personalizado-body">
                    <label class="modal-personalizado-label">
                        Selecione o novo status:
                        <span class="modal-tooltip" data-tooltip="O status define a fase atual do processo da ocorrência">ℹ️</span>
                    </label>
                    
                    <div class="status-options-container" id="opcoesStatus">
                        <div class="status-option" onclick="selecionarStatus('recebida')" role="button" tabindex="0">
                            <span class="status-badge-modal status-recebida">Recebida</span>
                            <span style="font-size: 14px; color: #5d6d7e;">Ocorrência recebida e aguardando análise inicial</span>
                        </div>
                        
                        <div class="status-option" onclick="selecionarStatus('analise')" role="button" tabindex="0">
                            <span class="status-badge-modal status-analise">Em Análise</span>
                            <span style="font-size: 14px; color: #5d6d7e;">Em processo de análise pela equipe da CIPA</span>
                        </div>
                        
                        <div class="status-option" onclick="selecionarStatus('andamento')" role="button" tabindex="0">
                            <span class="status-badge-modal status-andamento">Em Andamento</span>
                            <span style="font-size: 14px; color: #5d6d7e;">Ações estão sendo tomadas para resolver a situação</span>
                        </div>
                        
                        <div class="status-option" onclick="selecionarStatus('concluida')" role="button" tabindex="0">
                            <span class="status-badge-modal status-concluida">Concluída</span>
                            <span style="font-size: 14px; color: #5d6d7e;">Processo finalizado com as devidas medidas</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <label class="modal-personalizado-label">Observação adicional (opcional):</label>
                        <textarea 
                            id="textareaStatusObs" 
                            class="modal-personalizado-textarea" 
                            placeholder="Observação sobre a mudança de status..."
                            style="min-height: 80px;"
                            maxlength="300"
                            aria-describedby="contadorStatusObs"
                        ></textarea>
                        <div style="text-align: right; margin-top: 5px; font-size: 12px; color: #7f8c8d;">
                            <span id="contadorStatusObs">0</span>/300 caracteres
                        </div>
                    </div>
                </div>
                <div class="modal-personalizado-actions">
                    <button type="button" class="modal-personalizado-btn modal-personalizado-btn-secondary" onclick="fecharModalStatus()">
                        Cancelar
                    </button>
                    <button type="button" class="modal-personalizado-btn modal-personalizado-btn-primary" onclick="salvarStatus()">
                        ✅ Atualizar Status
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar event listeners
    const textareaStatus = document.getElementById('textareaStatusObs');
    if (textareaStatus) {
        textareaStatus.addEventListener('input', atualizarContadorStatusObs);
    }
    
    // Event listeners para fechar modal
    const modal = document.getElementById('modalStatus');
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            fecharModalStatus();
        }
    });
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            fecharModalStatus();
        }
    });
}

// =============================================
// FUNÇÕES DE CONTADOR DE CARACTERES
// =============================================

function atualizarContadorObservacao() {
    const textarea = document.getElementById('textareaObservacao');
    const contador = document.getElementById('contadorObservacao');
    if (!textarea || !contador) return;
    
    const caracteres = textarea.value.length;
    contador.textContent = caracteres;
    
    if (caracteres > 450) {
        contador.style.color = '#e74c3c';
        contador.style.fontWeight = 'bold';
    } else if (caracteres > 400) {
        contador.style.color = '#f39c12';
        contador.style.fontWeight = 'bold';
    } else {
        contador.style.color = '#7f8c8d';
        contador.style.fontWeight = 'normal';
    }
}

function atualizarContadorStatusObs() {
    const textarea = document.getElementById('textareaStatusObs');
    const contador = document.getElementById('contadorStatusObs');
    if (!textarea || !contador) return;
    
    const caracteres = textarea.value.length;
    contador.textContent = caracteres;
    
    if (caracteres > 250) {
        contador.style.color = '#e74c3c';
        contador.style.fontWeight = 'bold';
    } else if (caracteres > 200) {
        contador.style.color = '#f39c12';
        contador.style.fontWeight = 'bold';
    } else {
        contador.style.color = '#7f8c8d';
        contador.style.fontWeight = 'normal';
    }
}