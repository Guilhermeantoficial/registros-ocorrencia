// script.js

// Variáveis globais
let denuncias = [];
let currentUser = null;
let denunciaAtualId = null;
let statusSelecionado = null;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const ENCRYPTION_KEY = 'cipa-denuncias-2024-secret-key';
const SYNC_CHANNEL = 'denuncias_sync_channel';

// =============================================
// INICIALIZAÇÃO
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    checkSavedCredentials();
    loadDenunciasFromStorage();
    setupAutoBackup();
    setupSyncSystem();
    checkProtocoloURL();
    iniciarEfeitoPulse();
    
    // Sincronização inicial rápida
    setTimeout(() => {
        solicitarSincronizacao();
    }, 3000);
}

function setupEventListeners() {
    // Botão admin
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', showLoginModal);
    }
    
    // Formulário de denúncia
    const denunciaForm = document.getElementById('denunciaForm');
    if (denunciaForm) {
        denunciaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleDenunciaSubmit(e);
        });
        denunciaForm.addEventListener('reset', handleFormReset);
    }
    
    // Upload de arquivos
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('evidencias');
    
    if (fileUploadArea && fileInput) {
        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileUploadArea.addEventListener('dragover', handleDragOver);
        fileUploadArea.addEventListener('dragleave', handleDragLeave);
        fileUploadArea.addEventListener('drop', handleFileDrop);
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Modais
    setupModalEvents();
    
    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const loginCancel = document.getElementById('loginCancel');
    if (loginCancel) {
        loginCancel.addEventListener('click', hideLoginModal);
    }
    
    // Admin actions
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    const applyFilter = document.getElementById('applyFilter');
    if (applyFilter) {
        applyFilter.addEventListener('click', applyFilterHandler);
    }
    
    const clearFilter = document.getElementById('clearFilter');
    if (clearFilter) {
        clearFilter.addEventListener('click', clearFilterHandler);
    }
    
    // Modal close
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', function() {
            document.getElementById('confirmationModal').style.display = 'none';
        });
    }

    // Acompanhamento
    const inputProtocolo = document.getElementById('inputProtocolo');
    if (inputProtocolo) {
        inputProtocolo.addEventListener('input', validarProtocoloEmTempoReal);
        inputProtocolo.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                acompanharDenuncia();
            }
        });
    }
    
    // Contadores de caracteres
    const textareaObs = document.getElementById('textareaObservacao');
    const textareaStatus = document.getElementById('textareaStatusObs');
    
    if (textareaObs) {
        textareaObs.addEventListener('input', atualizarContadorObservacao);
    }
    
    if (textareaStatus) {
        textareaStatus.addEventListener('input', atualizarContadorStatusObs);
    }
}

// =============================================
// SISTEMA DE SINCRONIZAÇÃO
// =============================================

function setupSyncSystem() {
    setupBroadcastChannel();
    setupLocalStorageSync();
    
    // Sincronização mais rápida - a cada 30 segundos
    setInterval(() => {
        if (denuncias.length > 0) {
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
                    case 'NEW_DENUNCIA':
                        processarNovaDenuncia(event.data.denuncia);
                        break;
                    case 'DENUNCIA_UPDATED':
                        processarDenunciaAtualizada(event.data.denuncia);
                        break;
                    case 'SYNC_PING':
                        responderPing(channel, event.data);
                        break;
                }
            });
            
            // Ping rápido para descobrir outros dispositivos
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
        if (event.key === 'denuncias_encrypted' && event.newValue) {
            const remoteData = decryptData(event.newValue);
            if (remoteData && Array.isArray(remoteData)) {
                mergeDenuncias(remoteData);
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
        denuncias: denuncias,
        timestamp: Date.now(),
        deviceId: getDeviceId(),
        totalDenuncias: denuncias.length
    };
    
    channel.postMessage(syncData);
}

function processarDadosSincronizacao(data) {
    if (data.denuncias && Array.isArray(data.denuncias)) {
        const antes = denuncias.length;
        mergeDenuncias(data.denuncias);
        const depois = denuncias.length;
        
        if (depois > antes) {
            showSyncNotification(`${depois - antes} nova(s) denúncia(s) sincronizada(s)`);
        }
        updateSyncIndicator('Sincronizado', 'synced');
    }
}

function processarNovaDenuncia(denuncia) {
    const exists = denuncias.some(d => d.id === denuncia.id);
    if (!exists) {
        denuncias.push(denuncia);
        saveDenunciasToStorage();
        showSyncNotification('Nova denúncia recebida de outro dispositivo');
        
        if (isLoggedIn()) {
            loadDenuncias();
            loadStats();
        }
    }
}

function processarDenunciaAtualizada(denuncia) {
    const index = denuncias.findIndex(d => d.id === denuncia.id);
    if (index !== -1) {
        denuncias[index] = denuncia;
        saveDenunciasToStorage();
        
        if (isLoggedIn()) {
            loadDenuncias();
            loadStats();
        }
    }
}

function responderPing(channel, data) {
    if (data.deviceId !== getDeviceId()) {
        channel.postMessage({ 
            type: 'SYNC_PONG',
            timestamp: Date.now(),
            deviceId: getDeviceId(),
            totalDenuncias: denuncias.length
        });
    }
}

function mergeDenuncias(remoteDenuncias) {
    let hasChanges = false;
    let newDenuncias = 0;
    
    remoteDenuncias.forEach(remoteDenuncia => {
        const localIndex = denuncias.findIndex(local => local.id === remoteDenuncia.id);
        
        if (localIndex === -1) {
            denuncias.push(remoteDenuncia);
            hasChanges = true;
            newDenuncias++;
        } else {
            const localDenuncia = denuncias[localIndex];
            if (shouldUpdate(localDenuncia, remoteDenuncia)) {
                denuncias[localIndex] = remoteDenuncia;
                hasChanges = true;
            }
        }
    });
    
    if (hasChanges) {
        saveDenunciasToStorage();
        if (isLoggedIn()) {
            loadDenuncias();
            loadStats();
        }
    }
    
    return newDenuncias;
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
// ACOMPANHAMENTO DE DENÚNCIAS
// =============================================

function mostrarAcompanhamento() {
    // Fechar todos os modais
    const modals = document.querySelectorAll('.modal, .modal-personalizado');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
    
    const protocoloSection = document.querySelector('.protocolo-section');
    if (protocoloSection) {
        protocoloSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
        
        setTimeout(() => {
            const inputProtocolo = document.getElementById('inputProtocolo');
            if (inputProtocolo) {
                inputProtocolo.focus();
                inputProtocolo.select();
            }
            
            protocoloSection.style.transition = 'all 0.3s ease';
            protocoloSection.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.3)';
            
            setTimeout(() => {
                protocoloSection.style.boxShadow = '';
            }, 1000);
        }, 800);
    }
}

function validarProtocoloEmTempoReal(e) {
    const protocolo = e.target.value.toUpperCase();
    const regex = /^CIPA-\d{8}-[A-Z0-9]{0,5}$/;
    
    if (protocolo.length > 0) {
        if (regex.test(protocolo)) {
            e.target.style.borderColor = '#2ecc71';
            e.target.style.background = 'rgba(46, 204, 113, 0.05)';
        } else {
            e.target.style.borderColor = '#e74c3c';
            e.target.style.background = 'rgba(231, 76, 60, 0.05)';
        }
    } else {
        e.target.style.borderColor = '#e9ecef';
        e.target.style.background = 'white';
    }
}

function acompanharDenuncia() {
    const protocoloInput = document.getElementById('inputProtocolo');
    const statusContainer = document.getElementById('statusDenuncia');
    
    if (!protocoloInput || !statusContainer) return;
    
    const protocolo = protocoloInput.value.trim().toUpperCase();
    
    if (!protocolo) {
        statusContainer.innerHTML = `
            <div class="status-error" style="animation: shake 0.5s ease;">
                ⚠️ Por favor, digite o número do protocolo.
            </div>
        `;
        protocoloInput.focus();
        return;
    }
    
    if (!protocolo.match(/^CIPA-\d{8}-[A-Z0-9]{5}$/)) {
        statusContainer.innerHTML = `
            <div class="status-error">
                ❌ Formato de protocolo inválido.<br>
                <small>O formato correto é: <strong>CIPA-AAAAMMDD-XXXXX</strong></small>
            </div>
        `;
        return;
    }
    
    const denuncia = denuncias.find(d => d.protocolo === protocolo);
    
    if (!denuncia) {
        statusContainer.innerHTML = `
            <div class="status-error">
                ❌ Protocolo não encontrado.<br>
                <small>Verifique o número digitado e tente novamente.</small>
            </div>
        `;
        return;
    }
    
    const status = getStatusDenuncia(denuncia);
    const dias = Math.floor((new Date() - new Date(denuncia.dataRegistro)) / (1000 * 60 * 60 * 24));
    
    statusContainer.innerHTML = `
        <div class="status-info" style="animation: slideInUp 0.5s ease;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 3rem; margin-bottom: 10px;">${getStatusEmoji(status.text)}</div>
                <h3 style="color: #2c3e50; margin: 0;">Status da Denúncia</h3>
            </div>
            
            <div style="display: grid; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Protocolo:</strong>
                    <code style="background: #f8f9fa; padding: 5px 10px; border-radius: 5px;">${denuncia.protocolo}</code>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Data do Registro:</strong>
                    <span>${formatDate(denuncia.dataRegistro)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Status:</strong>
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Última Atualização:</strong>
                    <span>${formatDate(denuncia.ultimaAtualizacao || denuncia.dataRegistro)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Tempo decorrido:</strong>
                    <span>${dias} dia(s)</span>
                </div>
            </div>
            
            ${denuncia.observacoes ? `
                <div style="margin-top: 20px; padding: 15px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <strong>📝 Observações da CIPA:</strong>
                    <p style="margin: 10px 0 0 0; color: #856404;">${denuncia.observacoes}</p>
                </div>
            ` : ''}
            
            <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #2c3e50; font-weight: 500;">
                    ${getStatusMessage(status.text, dias)}
                </p>
            </div>
        </div>
    `;
}

function getStatusDenuncia(denuncia) {
    if (denuncia.status === 'concluida') {
        return { text: 'Concluída', class: 'status-concluida' };
    }
    
    if (denuncia.status === 'andamento') {
        return { text: 'Em Andamento', class: 'status-andamento' };
    }
    
    if (denuncia.status === 'analise') {
        return { text: 'Em Análise', class: 'status-analise' };
    }
    
    const dias = Math.floor((new Date() - new Date(denuncia.dataRegistro)) / (1000 * 60 * 60 * 24));
    
    if (dias < 1) return { text: 'Recebida', class: 'status-recebida' };
    if (dias < 3) return { text: 'Em Análise', class: 'status-analise' };
    if (dias < 7) return { text: 'Em Andamento', class: 'status-andamento' };
    return { text: 'Em Análise Avançada', class: 'status-andamento' };
}

function getStatusEmoji(status) {
    const emojis = {
        'Recebida': '📥',
        'Em Análise': '🔍',
        'Em Andamento': '⚙️',
        'Em Análise Avançada': '📊',
        'Concluída': '✅'
    };
    return emojis[status] || '📋';
}

function getStatusMessage(status, dias) {
    const messages = {
        'Recebida': 'Sua denúncia foi recebida e será analisada pela CIPA em breve.',
        'Em Análise': 'Sua denúncia está sendo analisada pela equipe da CIPA.',
        'Em Andamento': 'A CIPA está tomando as medidas cabíveis para resolver a situação.',
        'Em Análise Avançada': 'Sua denúncia está em fase avançada de análise.',
        'Concluída': 'O processo referente à sua denúncia foi concluído.'
    };
    
    return messages[status] || 'Sua denúncia está sendo processada pela CIPA.';
}

function checkProtocoloURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const protocolo = urlParams.get('protocolo');
    
    if (protocolo) {
        const protocoloSection = document.querySelector('.protocolo-section');
        if (protocoloSection) {
            protocoloSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        const inputProtocolo = document.getElementById('inputProtocolo');
        if (inputProtocolo) {
            inputProtocolo.value = protocolo.toUpperCase();
            setTimeout(() => {
                acompanharDenuncia();
            }, 500);
        }
    }
}

function iniciarEfeitoPulse() {
    const linkAcompanhamento = document.querySelector('.acompanhamento-link a');
    if (linkAcompanhamento) {
        setInterval(() => {
            linkAcompanhamento.classList.add('pulse');
            setTimeout(() => {
                linkAcompanhamento.classList.remove('pulse');
            }, 2000);
        }, 10000);
    }
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

function saveDenunciasToStorage() {
    try {
        const encrypted = encryptData(denuncias);
        if (encrypted) {
            localStorage.setItem('denuncias_encrypted', encrypted);
            localStorage.setItem('denuncias_backup', encrypted);
            syncWithOtherDevices();
        }
    } catch (error) {
        console.error('Erro ao salvar denúncias:', error);
    }
}

function loadDenunciasFromStorage() {
    try {
        const encrypted = localStorage.getItem('denuncias_encrypted');
        if (encrypted) {
            const decrypted = decryptData(encrypted);
            if (decrypted && Array.isArray(decrypted)) {
                denuncias = decrypted;
                return;
            }
        }
        
        // Migração de dados legados
        const legacyData = localStorage.getItem('denuncias');
        if (legacyData) {
            try {
                denuncias = JSON.parse(legacyData);
                saveDenunciasToStorage();
                localStorage.removeItem('denuncias');
            } catch (e) {
                console.error('Erro ao migrar dados legados:', e);
                denuncias = [];
            }
        } else {
            denuncias = [];
        }
    } catch (error) {
        console.error('Erro ao carregar denúncias:', error);
        denuncias = [];
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
            denuncias: denuncias,
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
// MANIPULAÇÃO DE ARQUIVOS
// =============================================

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.classList.add('dragover');
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.classList.remove('dragover');
    }
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.classList.remove('dragover');
    }
    const files = e.dataTransfer.files;
    processFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

function processFiles(files) {
    const filePreview = document.getElementById('filePreview');
    if (!filePreview) return;
    
    filePreview.style.display = 'block';
    
    for (let file of files) {
        if (file.size > MAX_FILE_SIZE) {
            alert(`❌ O arquivo "${file.name}" excede o tamanho máximo de 5MB.`);
            continue;
        }
        
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
            alert(`❌ Tipo de arquivo não permitido: "${file.name}".\nTipos permitidos: ${ALLOWED_FILE_TYPES.join(', ')}`);
            continue;
        }
        
        addFileToPreview(file);
    }
}

function addFileToPreview(file) {
    const filePreview = document.getElementById('filePreview');
    if (!filePreview) return;
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const fileSize = formatFileSize(file.size);
    
    fileItem.innerHTML = `
        <div class="file-info">
            <span class="file-icon">📎</span>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${fileSize}</span>
        </div>
        <button class="file-remove" type="button">×</button>
    `;
    
    fileItem.querySelector('.file-remove').addEventListener('click', function() {
        fileItem.remove();
        updateFileInput();
        if (filePreview.children.length === 0) {
            filePreview.style.display = 'none';
        }
    });
    
    filePreview.appendChild(fileItem);
    updateFileInput();
}

function updateFileInput() {
    // Esta função pode ser implementada se necessário para atualizar o input de arquivos
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// =============================================
// FORMULÁRIO DE DENÚNCIA
// =============================================

async function handleDenunciaSubmit(e) {
    console.log('Enviando denúncia...');
    
    if (!validateForm()) {
        return;
    }
    
    const protocolo = generateProtocolo();
    
    const denuncia = {
        id: generateId(),
        protocolo: protocolo,
        tipo: document.getElementById('tipo-denuncia').value,
        tipoEnvolvimento: document.getElementById('tipo-envolvimento').value,
        dataOcorrencia: document.getElementById('data-ocorrencia').value,
        localOcorrencia: document.getElementById('local-ocorrencia').value,
        descricao: document.getElementById('descricao').value,
        dataRegistro: new Date().toISOString(),
        ultimaAtualizacao: new Date().toISOString(),
        status: 'recebida',
        evidencias: []
    };
    
    console.log('Dados da denúncia:', denuncia);
    
    const fileInput = document.getElementById('evidencias');
    const files = fileInput.files;
    
    for (let file of files) {
        try {
            const fileData = await readFileAsBase64(file);
            denuncia.evidencias.push({
                name: file.name,
                type: file.type,
                size: file.size,
                data: fileData
            });
        } catch (error) {
            console.error('Erro ao processar arquivo:', error);
        }
    }
    
    denuncias.push(denuncia);
    saveDenunciasToStorage();
    syncNewDenuncia(denuncia);
    showProtocoloModal(protocolo);
    
    document.getElementById('denunciaForm').reset();
    const filePreview = document.getElementById('filePreview');
    if (filePreview) {
        filePreview.style.display = 'none';
        filePreview.innerHTML = '';
    }
    
    console.log('Denúncia salva com sucesso! Protocolo:', protocolo);
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function validateForm() {
    const tipo = document.getElementById('tipo-denuncia').value;
    const tipoEnvolvimento = document.getElementById('tipo-envolvimento').value;
    const descricao = document.getElementById('descricao').value;
    
    if (!tipo) {
        alert('❌ Por favor, selecione o tipo de denúncia.');
        return false;
    }
    
    if (!tipoEnvolvimento) {
        alert('❌ Por favor, selecione se a denúncia foi com você ou se presenciou.');
        return false;
    }
    
    if (!descricao.trim()) {
        alert('❌ Por favor, descreva a ocorrência.');
        return false;
    }
    
    return true;
}

function handleFormReset() {
    const filePreview = document.getElementById('filePreview');
    if (filePreview) {
        filePreview.style.display = 'none';
        filePreview.innerHTML = '';
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function syncNewDenuncia(denuncia) {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            channel.postMessage({
                type: 'NEW_DENUNCIA',
                denuncia: denuncia,
                timestamp: new Date().toISOString(),
                deviceId: getDeviceId()
            });
        } catch (error) {
            console.log('Erro ao sincronizar nova denúncia');
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
        
        loadDenunciasFromStorage();
        loadDenuncias();
        loadStats();
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
        'protocoloModal',
        'modalObservacao',
        'modalStatus'
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
        const modals = document.querySelectorAll('.modal, .modal-personalizado');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Fechar modal com tecla ESC
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal, .modal-personalizado');
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
    
    loadDenuncias();
    loadStats();
    document.getElementById('adminModal').style.display = 'block';
}

function hideAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
}

// =============================================
// ÁREA ADMINISTRATIVA
// =============================================

function loadDenuncias(filteredDenuncias = null) {
    const container = document.getElementById('denunciasContainer');
    if (!container) return;
    
    const denunciasToShow = filteredDenuncias || denuncias;
    
    console.log('Carregando denúncias:', denunciasToShow.length);
    
    if (denunciasToShow.length === 0) {
        const mensagem = filteredDenuncias ? 
            '<div class="no-resultados"><h3>Nenhuma denúncia encontrada</h3><p>Tente ajustar os filtros ou verificar os critérios de busca.</p></div>' :
            '<div class="no-denuncias">Nenhuma denúncia encontrada.</div>';
        
        container.innerHTML = mensagem;
        return;
    }
    
    let html = '';
    denunciasToShow.forEach(denuncia => {
        const status = getStatusDenuncia(denuncia);
        
        html += `
            <div class="denuncia-item">
                <div class="denuncia-header">
                    <span class="denuncia-tipo">${formatTipoDenuncia(denuncia.tipo)}</span>
                    <span class="denuncia-data">${formatDate(denuncia.dataRegistro)}</span>
                </div>
                <div class="denuncia-content">
                    <p><strong>Protocolo:</strong> ${denuncia.protocolo}</p>
                    <p><strong>Envolvimento:</strong> ${formatTipoEnvolvimento(denuncia.tipoEnvolvimento)}</p>
                    ${denuncia.dataOcorrencia ? `<p><strong>Data da Ocorrência:</strong> ${formatDateDisplay(denuncia.dataOcorrencia)}</p>` : ''}
                    ${denuncia.localOcorrencia ? `<p><strong>Local:</strong> ${formatLocalOcorrencia(denuncia.localOcorrencia)}</p>` : ''}
                    <p><strong>Status:</strong> <span class="status-badge ${status.class}">${status.text}</span></p>
                    <p><strong>Descrição:</strong> ${denuncia.descricao}</p>
                    ${denuncia.observacoes ? `<p><strong>Observações:</strong> ${denuncia.observacoes}</p>` : ''}
                </div>
                ${denuncia.evidencias.length > 0 ? `
                    <div class="denuncia-evidencias">
                        <strong>Evidências (${denuncia.evidencias.length}):</strong>
                        ${denuncia.evidencias.map(evidencia => `
                            <div class="evidencia-item">
                                <div class="evidencia-info">
                                    <span>${evidencia.name}</span>
                                    <span>(${formatFileSize(evidencia.size)})</span>
                                </div>
                                <button class="evidencia-download" onclick="downloadEvidencia('${denuncia.id}', '${evidencia.name}')">
                                    Download
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="denuncia-actions">
                    <button onclick="atualizarStatus('${denuncia.id}')" class="btn-admin-action">Atualizar Status</button>
                    <button onclick="adicionarObservacao('${denuncia.id}')" class="btn-admin-action">Adicionar Observação</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// =============================================
// MODAIS DE OBSERVAÇÃO E STATUS
// =============================================

function adicionarObservacao(denunciaId) {
    denunciaAtualId = denunciaId;
    const denuncia = denuncias.find(d => d.id === denunciaId);
    
    if (denuncia) {
        document.getElementById('textareaObservacao').value = denuncia.observacoes || '';
        atualizarContadorObservacao();
        document.getElementById('modalObservacao').style.display = 'block';
        
        // Focar no textarea
        setTimeout(() => {
            document.getElementById('textareaObservacao').focus();
        }, 100);
    }
}

function fecharModalObservacao() {
    document.getElementById('modalObservacao').style.display = 'none';
    denunciaAtualId = null;
}

function salvarObservacao() {
    if (!denunciaAtualId) return;
    
    const observacao = document.getElementById('textareaObservacao').value.trim();
    const denuncia = denuncias.find(d => d.id === denunciaAtualId);
    
    if (denuncia) {
        denuncia.observacoes = observacao;
        denuncia.ultimaAtualizacao = new Date().toISOString();
        
        saveDenunciasToStorage();
        loadDenuncias();
        showSyncNotification('Observação salva com sucesso');
        fecharModalObservacao();
        
        // Sincronizar mudança
        sincronizarMudancaIndividual(denuncia);
    }
}

function atualizarStatus(denunciaId) {
    denunciaAtualId = denunciaId;
    const denuncia = denuncias.find(d => d.id === denunciaId);
    
    if (denuncia) {
        statusSelecionado = denuncia.status || 'recebida';
        atualizarSelecaoStatus();
        document.getElementById('textareaStatusObs').value = '';
        atualizarContadorStatusObs();
        
        // Mostrar o modal
        const modalStatus = document.getElementById('modalStatus');
        modalStatus.style.display = 'block';
        
        // Focar no modal e garantir que esteja visível
        setTimeout(() => {
            modalStatus.scrollTop = 0;
            const primeiraOpcao = document.querySelector('.status-option');
            if (primeiraOpcao) {
                primeiraOpcao.focus();
            }
        }, 100);
    }
}

function fecharModalStatus() {
    const modalStatus = document.getElementById('modalStatus');
    modalStatus.style.display = 'none';
    denunciaAtualId = null;
    statusSelecionado = null;
}

function selecionarStatus(status) {
    statusSelecionado = status;
    atualizarSelecaoStatus();
    
    // Scroll suave para a opção selecionada (se necessário)
    const opcaoSelecionada = document.querySelector(`.status-option[onclick="selecionarStatus('${status}')"]`);
    if (opcaoSelecionada) {
        opcaoSelecionada.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }
}

function atualizarSelecaoStatus() {
    // Remover seleção anterior
    document.querySelectorAll('.status-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Adicionar seleção atual
    const optionSelecionada = document.querySelector(`.status-option[onclick="selecionarStatus('${statusSelecionado}')"]`);
    if (optionSelecionada) {
        optionSelecionada.classList.add('selected');
    }
}

function salvarStatus() {
    if (!denunciaAtualId || !statusSelecionado) {
        alert('Por favor, selecione um status.');
        return;
    }
    
    const observacao = document.getElementById('textareaStatusObs').value.trim();
    const denuncia = denuncias.find(d => d.id === denunciaAtualId);
    
    if (denuncia) {
        denuncia.status = statusSelecionado;
        denuncia.ultimaAtualizacao = new Date().toISOString();
        
        // Adicionar observação se fornecida
        if (observacao) {
            // Se já existem observações, adicionar nova linha
            if (denuncia.observacoes) {
                denuncia.observacoes += '\n\n--- Atualização de Status ---\n' + observacao;
            } else {
                denuncia.observacoes = observacao;
            }
        }
        
        saveDenunciasToStorage();
        loadDenuncias();
        showSyncNotification('Status atualizado com sucesso');
        fecharModalStatus();
        
        // Sincronizar mudança
        sincronizarMudancaIndividual(denuncia);
    }
}

function sincronizarMudancaIndividual(denuncia) {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            channel.postMessage({
                type: 'DENUNCIA_UPDATED',
                denuncia: denuncia,
                timestamp: Date.now(),
                deviceId: getDeviceId()
            });
        } catch (error) {
            console.log('Erro ao sincronizar mudança individual');
        }
    }
}

// =============================================
// CONTADORES DE CARACTERES
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

// =============================================
// FILTROS
// =============================================

function applyFilterHandler() {
    const tipo = document.getElementById('filterTipo').value;
    const data = document.getElementById('filterData').value;
    const local = document.getElementById('filterLocal').value;
    
    console.log('Aplicando filtros:', { tipo, data, local });
    
    let filteredDenuncias = denuncias;
    
    // Filtro por tipo
    if (tipo) {
        filteredDenuncias = filteredDenuncias.filter(d => d.tipo === tipo);
        console.log('Após filtro tipo:', filteredDenuncias.length);
    }
    
    // Filtro por data
    if (data) {
        filteredDenuncias = filteredDenuncias.filter(d => {
            if (!d.dataOcorrencia) return false;
            return d.dataOcorrencia === data;
        });
        console.log('Após filtro data:', filteredDenuncias.length);
    }
    
    // Filtro por local
    if (local) {
        filteredDenuncias = filteredDenuncias.filter(d => {
            if (!d.localOcorrencia) return false;
            return d.localOcorrencia === local;
        });
        console.log('Após filtro local:', filteredDenuncias.length);
    }
    
    loadDenuncias(filteredDenuncias);
    updateStats(filteredDenuncias);
    
    // Mostrar contador de resultados
    mostrarContadorResultados(filteredDenuncias.length);
}

function clearFilterHandler() {
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterData').value = '';
    document.getElementById('filterLocal').value = '';
    loadDenuncias();
    loadStats();
    console.log('Filtros limpos');
}

function mostrarContadorResultados(quantidade) {
    let contador = document.getElementById('contadorResultados');
    
    if (!contador) {
        contador = document.createElement('div');
        contador.id = 'contadorResultados';
        contador.style.cssText = `
            margin: 10px 0;
            padding: 8px 12px;
            background: #e8f4fd;
            border-radius: 6px;
            font-size: 14px;
            color: #2980b9;
            font-weight: 500;
        `;
        
        const filtersDiv = document.querySelector('.filters');
        if (filtersDiv) {
            filtersDiv.parentNode.insertBefore(contador, filtersDiv.nextSibling);
        }
    }
    
    const total = denuncias.length;
    if (quantidade === total) {
        contador.textContent = `Mostrando todas as ${total} denúncias`;
    } else {
        contador.textContent = `${quantidade} de ${total} denúncias correspondem aos filtros`;
    }
}

function updateStats(filteredDenuncias) {
    const stats = {
        total: filteredDenuncias.length,
        porTipo: {},
        porStatus: {},
        ultimoMes: filteredDenuncias.filter(d => {
            const data = new Date(d.dataRegistro);
            const umMesAtras = new Date();
            umMesAtras.setMonth(umMesAtras.getMonth() - 1);
            return data > umMesAtras;
        }).length
    };
    
    filteredDenuncias.forEach(denuncia => {
        stats.porTipo[denuncia.tipo] = (stats.porTipo[denuncia.tipo] || 0) + 1;
        const status = getStatusDenuncia(denuncia).text;
        stats.porStatus[status] = (stats.porStatus[status] || 0) + 1;
    });
    
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;
    
    let statsHtml = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total de Denúncias</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.ultimoMes}</div>
                <div class="stat-label">Últimos 30 dias</div>
            </div>
    `;
    
    Object.entries(stats.porTipo).forEach(([tipo, quantidade]) => {
        statsHtml += `
            <div class="stat-item">
                <div class="stat-value">${quantidade}</div>
                <div class="stat-label">${formatTipoDenuncia(tipo)}</div>
            </div>
        `;
    });
    
    Object.entries(stats.porStatus).forEach(([status, quantidade]) => {
        statsHtml += `
            <div class="stat-item">
                <div class="stat-value">${quantidade}</div>
                <div class="stat-label">${status}</div>
            </div>
        `;
    });
    
    statsHtml += '</div>';
    statsContainer.innerHTML = statsHtml;
}

function loadStats() {
    updateStats(denuncias);
}

// =============================================
// EXPORTAÇÃO DE DADOS
// =============================================

function exportToCSV() {
    if (denuncias.length === 0) {
        alert('Não há denúncias para exportar.');
        return;
    }
    
    const headers = [
        'Protocolo',
        'Tipo de Denúncia',
        'Envolvimento', 
        'Data da Ocorrência',
        'Local da Ocorrência',
        'Descrição',
        'Data do Registro',
        'Status',
        'Última Atualização',
        'Quantidade de Evidências',
        'Nomes dos Arquivos'
    ];
    
    const BOM = '\uFEFF';
    
    const csvLines = [headers.join(';')];
    
    denuncias.forEach(denuncia => {
        const status = getStatusDenuncia(denuncia);
        
        const row = [
            denuncia.protocolo,
            formatTipoDenuncia(denuncia.tipo),
            formatTipoEnvolvimento(denuncia.tipoEnvolvimento),
            denuncia.dataOcorrencia || 'N/A',
            formatLocalOcorrencia(denuncia.localOcorrencia) || 'N/A',
            `"${denuncia.descricao.replace(/"/g, '""')}"`,
            formatDateForCSV(denuncia.dataRegistro),
            status.text,
            formatDateForCSV(denuncia.ultimaAtualizacao || denuncia.dataRegistro),
            denuncia.evidencias.length.toString(),
            `"${denuncia.evidencias.map(e => e.name).join(', ')}"`
        ];
        csvLines.push(row.join(';'));
    });
    
    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `denuncias_cipa_${formatDate(new Date().toISOString(), 'file')}.csv`;
    link.click();
}

function formatDateForCSV(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

function downloadEvidencia(denunciaId, fileName) {
    const denuncia = denuncias.find(d => d.id === denunciaId);
    if (!denuncia) return;
    
    const evidencia = denuncia.evidencias.find(e => e.name === fileName);
    if (!evidencia) return;
    
    const link = document.createElement('a');
    link.href = evidencia.data;
    link.download = fileName;
    link.click();
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function formatTipoDenuncia(tipo) {
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
`;
document.head.appendChild(style);