// js/registrar.js
// Lógica específica para a página de registro de ocorrências

document.addEventListener('DOMContentLoaded', function() {
    initializeRegistroPage();
});

function initializeRegistroPage() {
    setupRegistroEventListeners();
    checkProtocoloURL();
}

function setupRegistroEventListeners() {
    // Formulário de ocorrência
    const ocorrenciaForm = document.getElementById('ocorrenciaForm');
    if (ocorrenciaForm) {
        ocorrenciaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleOcorrenciaSubmit(e);
        });
        ocorrenciaForm.addEventListener('reset', handleFormReset);
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
    
    // Modal close específico
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', function() {
            document.getElementById('confirmationModal').style.display = 'none';
        });
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

// =============================================
// FORMULÁRIO DE OCORRÊNCIA
// =============================================

async function handleOcorrenciaSubmit(e) {
    console.log('Enviando ocorrência...');
    
    if (!validateForm()) {
        return;
    }
    
    const protocolo = generateProtocolo();
    
    const ocorrencia = {
        id: generateId(),
        protocolo: protocolo,
        tipo: document.getElementById('tipo-ocorrencia').value,
        tipoEnvolvimento: document.getElementById('tipo-envolvimento').value,
        dataOcorrencia: document.getElementById('data-ocorrencia').value,
        localOcorrencia: document.getElementById('local-ocorrencia').value,
        descricao: document.getElementById('descricao').value,
        dataRegistro: new Date().toISOString(),
        ultimaAtualizacao: new Date().toISOString(),
        status: 'recebida',
        evidencias: []
    };
    
    console.log('Dados da ocorrência:', ocorrencia);
    
    const fileInput = document.getElementById('evidencias');
    const files = fileInput.files;
    
    for (let file of files) {
        try {
            const fileData = await readFileAsBase64(file);
            ocorrencia.evidencias.push({
                name: file.name,
                type: file.type,
                size: file.size,
                data: fileData
            });
        } catch (error) {
            console.error('Erro ao processar arquivo:', error);
        }
    }
    
    ocorrencias.push(ocorrencia);
    saveOcorrenciasToStorage();
    syncNewOcorrencia(ocorrencia);
    showProtocoloModal(protocolo);
    
    document.getElementById('ocorrenciaForm').reset();
    const filePreview = document.getElementById('filePreview');
    if (filePreview) {
        filePreview.style.display = 'none';
        filePreview.innerHTML = '';
    }
    
    console.log('Ocorrência salva com sucesso! Protocolo:', protocolo);
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
    const tipo = document.getElementById('tipo-ocorrencia').value;
    const tipoEnvolvimento = document.getElementById('tipo-envolvimento').value;
    const descricao = document.getElementById('descricao').value;
    
    if (!tipo) {
        alert('❌ Por favor, selecione o tipo de ocorrência.');
        return false;
    }
    
    if (!tipoEnvolvimento) {
        alert('❌ Por favor, selecione se a ocorrência foi com você ou se presenciou.');
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

function syncNewOcorrencia(ocorrencia) {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            channel.postMessage({
                type: 'NEW_OCORRENCIA',
                ocorrencia: ocorrencia,
                timestamp: new Date().toISOString(),
                deviceId: getDeviceId()
            });
        } catch (error) {
            console.log('Erro ao sincronizar nova ocorrência');
        }
    }
}

function checkProtocoloURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const protocolo = urlParams.get('protocolo');
    
    if (protocolo) {
        const inputProtocolo = document.getElementById('inputProtocolo');
        if (inputProtocolo) {
            inputProtocolo.value = protocolo.toUpperCase();
        }
    }
}