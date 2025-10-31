// script.js

// Variáveis globais
let denuncias = [];
let currentUser = null;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const ENCRYPTION_KEY = 'cipa-denuncias-2024-secret-key';

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Configurar event listeners
    setupEventListeners();
    
    // Verificar se há credenciais salvas
    checkSavedCredentials();
    
    // Carregar denúncias
    loadDenunciasFromStorage();
    
    // Configurar backup automático
    setupAutoBackup();
}

function setupEventListeners() {
    // Botão da área da CIPA
    document.getElementById('adminBtn').addEventListener('click', showLoginModal);
    
    // Formulário de denúncia
    document.getElementById('denunciaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleDenunciaSubmit(e);
    });
    
    document.getElementById('denunciaForm').addEventListener('reset', handleFormReset);
    
    // Upload de arquivos
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('evidencias');
    
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Modais
    setupModalEvents();
    
    // Formulário de login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('loginCancel').addEventListener('click', hideLoginModal);
    
    // Botões da área administrativa - APENAS EXPORTAR CSV MANTIDO
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('applyFilter').addEventListener('click', applyFilter);
    document.getElementById('clearFilter').addEventListener('click', clearFilter);
    
    // Modal close buttons
    document.getElementById('modalClose').addEventListener('click', function() {
        document.getElementById('confirmationModal').style.display = 'none';
    });
}

// Sistema de Criptografia
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

// Armazenamento com criptografia
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
            if (decrypted) {
                denuncias = decrypted;
                return;
            }
        }
        
        const legacyData = localStorage.getItem('denuncias');
        if (legacyData) {
            denuncias = JSON.parse(legacyData);
            saveDenunciasToStorage();
            localStorage.removeItem('denuncias');
        } else {
            denuncias = [];
        }
    } catch (error) {
        console.error('Erro ao carregar denúncias:', error);
        denuncias = [];
    }
}

// Sincronização entre dispositivos
function syncWithOtherDevices() {
    console.log('Dados prontos para sincronização com outros dispositivos da CIPA');
    
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('denuncias_sync');
            channel.postMessage({
                type: 'DATA_UPDATED',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.log('BroadcastChannel não suportado');
        }
    }
}

// Backup Automático
function setupAutoBackup() {
    setInterval(createAutoBackup, 24 * 60 * 60 * 1000);
    window.addEventListener('beforeunload', createAutoBackup);
}

function createAutoBackup() {
    try {
        const backupData = {
            denuncias: denuncias,
            timestamp: new Date().toISOString(),
            version: '1.0'
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

// Manipulação de Arquivos
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('fileUploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('fileUploadArea').classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('fileUploadArea').classList.remove('dragover');
    const files = e.dataTransfer.files;
    processFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

function processFiles(files) {
    const filePreview = document.getElementById('filePreview');
    filePreview.style.display = 'block';
    
    for (let file of files) {
        if (file.size > MAX_FILE_SIZE) {
            alert(`O arquivo "${file.name}" excede o tamanho máximo de 5MB.`);
            continue;
        }
        
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
            alert(`Tipo de arquivo não permitido: "${file.name}". Tipos permitidos: ${ALLOWED_FILE_TYPES.join(', ')}`);
            continue;
        }
        
        addFileToPreview(file);
    }
}

function addFileToPreview(file) {
    const filePreview = document.getElementById('filePreview');
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
}

function updateFileInput() {
    // Implementação mantida
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Manipulação do Formulário de Denúncia
async function handleDenunciaSubmit(e) {
    console.log('Enviando denúncia...');
    
    if (!validateForm()) {
        return;
    }
    
    // Coletar dados do formulário
    const denuncia = {
        id: generateId(),
        tipo: document.getElementById('tipo-denuncia').value,
        tipoEnvolvimento: document.getElementById('tipo-envolvimento').value,
        dataOcorrencia: document.getElementById('data-ocorrencia').value,
        localOcorrencia: document.getElementById('local-ocorrencia').value,
        descricao: document.getElementById('descricao').value,
        dataRegistro: new Date().toISOString(),
        evidencias: []
    };
    
    console.log('Dados da denúncia:', denuncia);
    
    // Processar arquivos
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
    
    // Salvar denúncia
    denuncias.push(denuncia);
    saveDenunciasToStorage();
    
    // Mostrar confirmação
    showConfirmationModal();
    
    // Limpar formulário
    document.getElementById('denunciaForm').reset();
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('filePreview').innerHTML = '';
    
    console.log('Denúncia salva com sucesso!');
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
        alert('Por favor, selecione o tipo de denúncia.');
        return false;
    }
    
    if (!tipoEnvolvimento) {
        alert('Por favor, selecione se a denúncia foi com você ou se presenciou.');
        return false;
    }
    
    if (!descricao.trim()) {
        alert('Por favor, descreva a ocorrência.');
        return false;
    }
    
    return true;
}

function handleFormReset() {
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('filePreview').innerHTML = '';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Sistema de Login
function checkSavedCredentials() {
    const savedUser = localStorage.getItem('adminUser');
    const savedPass = localStorage.getItem('adminPass');
    
    if (savedUser && savedPass) {
        currentUser = { username: savedUser };
    } else {
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
        alert('Credenciais inválidas. Tente novamente.');
    }
}

function isLoggedIn() {
    return currentUser !== null;
}

// Gerenciamento de Modais
function setupModalEvents() {
    const confirmationModal = document.getElementById('confirmationModal');
    const loginModal = document.getElementById('loginModal');
    const adminModal = document.getElementById('adminModal');
    
    loginModal.querySelector('.close').addEventListener('click', hideLoginModal);
    adminModal.querySelector('.close').addEventListener('click', hideAdminModal);
    
    window.addEventListener('click', function(event) {
        if (event.target === confirmationModal) {
            confirmationModal.style.display = 'none';
        }
        if (event.target === loginModal) {
            hideLoginModal();
        }
        if (event.target === adminModal) {
            hideAdminModal();
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
    document.getElementById('loginForm').reset();
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

// Área Administrativa
function loadDenuncias(filteredDenuncias = null) {
    const container = document.getElementById('denunciasContainer');
    const denunciasToShow = filteredDenuncias || denuncias;
    
    console.log('Carregando denúncias:', denunciasToShow.length);
    
    if (denunciasToShow.length === 0) {
        container.innerHTML = '<div class="no-denuncias">Nenhuma denúncia encontrada.</div>';
        return;
    }
    
    let html = '';
    denunciasToShow.forEach(denuncia => {
        html += `
            <div class="denuncia-item">
                <div class="denuncia-header">
                    <span class="denuncia-tipo">${formatTipoDenuncia(denuncia.tipo)}</span>
                    <span class="denuncia-data">${formatDate(denuncia.dataRegistro)}</span>
                </div>
                <div class="denuncia-content">
                    <p><strong>Envolvimento:</strong> ${formatTipoEnvolvimento(denuncia.tipoEnvolvimento)}</p>
                    ${denuncia.dataOcorrencia ? `<p><strong>Data da Ocorrência:</strong> ${formatDateDisplay(denuncia.dataOcorrencia)}</p>` : ''}
                    ${denuncia.localOcorrencia ? `<p><strong>Local:</strong> ${formatLocalOcorrencia(denuncia.localOcorrencia)}</p>` : ''}
                    <p><strong>Descrição:</strong> ${denuncia.descricao}</p>
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
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// FILTROS CORRIGIDOS - FUNCIONANDO
function applyFilter() {
    const tipo = document.getElementById('filterTipo').value;
    const data = document.getElementById('filterData').value;
    const local = document.getElementById('filterLocal').value;
    
    console.log('Aplicando filtros:', { tipo, data, local });
    
    let filteredDenuncias = denuncias;
    
    if (tipo) {
        filteredDenuncias = filteredDenuncias.filter(d => d.tipo === tipo);
        console.log('Após filtro tipo:', filteredDenuncias.length);
    }
    
    if (data) {
        filteredDenuncias = filteredDenuncias.filter(d => {
            if (!d.dataOcorrencia) return false;
            return d.dataOcorrencia === data;
        });
        console.log('Após filtro data:', filteredDenuncias.length);
    }
    
    if (local) {
        filteredDenuncias = filteredDenuncias.filter(d => d.localOcorrencia === local);
        console.log('Após filtro local:', filteredDenuncias.length);
    }
    
    loadDenuncias(filteredDenuncias);
    updateStats(filteredDenuncias);
}

function clearFilter() {
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterData').value = '';
    document.getElementById('filterLocal').value = '';
    loadDenuncias();
    loadStats();
    console.log('Filtros limpos');
}

function updateStats(filteredDenuncias) {
    const stats = {
        total: filteredDenuncias.length,
        porTipo: {},
        ultimoMes: filteredDenuncias.filter(d => {
            const data = new Date(d.dataRegistro);
            const umMesAtras = new Date();
            umMesAtras.setMonth(umMesAtras.getMonth() - 1);
            return data > umMesAtras;
        }).length
    };
    
    filteredDenuncias.forEach(denuncia => {
        stats.porTipo[denuncia.tipo] = (stats.porTipo[denuncia.tipo] || 0) + 1;
    });
    
    const statsContainer = document.getElementById('statsContainer');
    let statsHtml = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Denúncias Filtradas</div>
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
    
    statsHtml += '</div>';
    statsContainer.innerHTML = statsHtml;
}

function loadStats() {
    updateStats(denuncias);
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

// Exportação de Dados - CSV ATUALIZADO com caminhos dos arquivos
function exportToCSV() {
    if (denuncias.length === 0) {
        alert('Não há denúncias para exportar.');
        return;
    }
    
    const headers = [
        'ID',
        'Tipo de Denúncia',
        'Envolvimento', 
        'Data da Ocorrência',
        'Local da Ocorrência',
        'Descrição',
        'Data do Registro',
        'Quantidade de Evidências',
        'Nomes dos Arquivos',
        'Links para Download'
    ];
    
    const BOM = '\uFEFF';
    
    // Criar linhas do CSV corretamente formatadas
    const csvLines = [headers.join(';')];
    
    denuncias.forEach(denuncia => {
        // Gerar links para download das evidências
        const downloadLinks = denuncia.evidencias.map(evidencia => {
            // Criar um link temporário para cada arquivo
            const blob = dataURLToBlob(evidencia.data);
            const url = URL.createObjectURL(blob);
            return `${evidencia.name}::${url}`;
        }).join(' | ');
        
        const row = [
            denuncia.id,
            formatTipoDenuncia(denuncia.tipo),
            formatTipoEnvolvimento(denuncia.tipoEnvolvimento),
            denuncia.dataOcorrencia || 'N/A',
            formatLocalOcorrencia(denuncia.localOcorrencia) || 'N/A',
            `"${denuncia.descricao.replace(/"/g, '""')}"`,
            formatDateForCSV(denuncia.dataRegistro),
            denuncia.evidencias.length.toString(),
            `"${denuncia.evidencias.map(e => e.name).join(', ')}"`,
            `"${downloadLinks}"`
        ];
        csvLines.push(row.join(';'));
    });
    
    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `denuncias_completo_${formatDate(new Date().toISOString(), 'file')}.csv`;
    link.click();
    
    // Limpar URLs criadas após algum tempo
    setTimeout(cleanupTempURLs, 30000);
}

// Função auxiliar para converter dataURL para Blob
function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
}

// Função para limpar URLs temporárias (opcional)
function cleanupTempURLs() {
    // Esta função pode ser expandida para limpar URLs criadas
    console.log('Limpeza de URLs temporárias pode ser implementada aqui');
}

// Função auxiliar para formatar data no CSV
function formatDateForCSV(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

// Funções auxiliares
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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