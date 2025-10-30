// js/script.js
document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const form = document.getElementById('denunciaForm');
    const modal = document.getElementById('confirmationModal');
    const adminModal = document.getElementById('adminModal');
    const loginModal = document.getElementById('loginModal');
    const configModal = document.getElementById('configModal');
    const closeBtns = document.querySelectorAll('.close');
    const modalCloseBtn = document.getElementById('modalClose');
    const adminBtn = document.getElementById('adminBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const configBtn = document.getElementById('configBtn');
    const loginForm = document.getElementById('loginForm');
    const configForm = document.getElementById('configForm');
    const loginCancel = document.getElementById('loginCancel');
    const configCancel = document.getElementById('configCancel');
    const denunciasContainer = document.getElementById('denunciasContainer');
    const statsContainer = document.getElementById('statsContainer');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('evidencias');
    const filePreview = document.getElementById('filePreview');
    
    // Chaves para armazenamento
    const STORAGE_KEY = 'denuncias_anonimas';
    const LOGIN_KEY = 'cipa_login';
    const FILES_KEY = 'denuncia_files';
    
    // Arquivos selecionados
    let selectedFiles = [];
    
    // Inicialização
    initFileUpload();
    
    // Evento de envio do formulário
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        saveDenuncia();
        modal.style.display = 'block';
        form.reset();
        clearFilePreview();
    });
    
    // Área administrativa
    adminBtn.addEventListener('click', function() {
        loginModal.style.display = 'block';
    });
    
    // Login
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (validateLogin()) {
            loginModal.style.display = 'none';
            adminModal.style.display = 'block';
            loadDenuncias();
            loadStats();
        }
    });
    
    loginCancel.addEventListener('click', function() {
        loginModal.style.display = 'none';
    });
    
    // Exportação
    exportBtn.addEventListener('click', exportToCSV);
    exportAllBtn.addEventListener('click', exportAllToZip);
    
    // Limpar denúncias
    clearAllBtn.addEventListener('click', function() {
        if (confirm('Tem certeza que deseja limpar TODAS as denúncias? Esta ação não pode ser desfeita.')) {
            clearAllDenuncias();
        }
    });
    
    // Configuração
    configBtn.addEventListener('click', function() {
        configModal.style.display = 'block';
    });
    
    configForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (saveConfig()) {
            configModal.style.display = 'none';
            alert('Configurações salvas com sucesso!');
        }
    });
    
    configCancel.addEventListener('click', function() {
        configModal.style.display = 'none';
    });
    
    // Fechar modais
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            modal.style.display = 'none';
            adminModal.style.display = 'none';
            loginModal.style.display = 'none';
            configModal.style.display = 'none';
        });
    });
    
    modalCloseBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === adminModal) adminModal.style.display = 'none';
        if (e.target === loginModal) loginModal.style.display = 'none';
        if (e.target === configModal) configModal.style.display = 'none';
    });
    
    // Inicializar upload de arquivos
    function initFileUpload() {
        // Click no área de upload
        fileUploadArea.addEventListener('click', function() {
            fileInput.click();
        });
        
        // Drag and drop
        fileUploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
        
        fileUploadArea.addEventListener('dragleave', function() {
            fileUploadArea.classList.remove('dragover');
        });
        
        fileUploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
        
        // Seleção via input
        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });
    }
    
    // Processar arquivos
    function handleFiles(files) {
        for (let file of files) {
            if (validateFile(file)) {
                selectedFiles.push(file);
                addFileToPreview(file);
            }
        }
        fileInput.value = '';
    }
    
    // Validar arquivo
    function validateFile(file) {
        const validTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'application/pdf', 
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!validTypes.includes(file.type)) {
            alert(`Tipo de arquivo não suportado: ${file.type}`);
            return false;
        }
        
        if (file.size > maxSize) {
            alert(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(2)}MB. Máximo: 5MB`);
            return false;
        }
        
        return true;
    }
    
    // Adicionar arquivo à pré-visualização
    function addFileToPreview(file) {
        filePreview.style.display = 'block';
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileSize = (file.size / 1024 / 1024).toFixed(2) + 'MB';
        const fileIcon = getFileIcon(file.type);
        
        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${fileSize}</span>
            </div>
            <button class="file-remove" data-name="${file.name}">×</button>
        `;
        
        filePreview.appendChild(fileItem);
        
        // Remover arquivo
        fileItem.querySelector('.file-remove').addEventListener('click', function() {
            selectedFiles = selectedFiles.filter(f => f.name !== file.name);
            fileItem.remove();
            if (selectedFiles.length === 0) {
                filePreview.style.display = 'none';
            }
        });
    }
    
    // Obter ícone do arquivo
    function getFileIcon(type) {
        if (type.startsWith('image/')) return '🖼️';
        if (type === 'application/pdf') return '📄';
        if (type.includes('word')) return '📝';
        if (type.includes('excel')) return '📊';
        return '📎';
    }
    
    // Limpar pré-visualização
    function clearFilePreview() {
        selectedFiles = [];
        filePreview.innerHTML = '';
        filePreview.style.display = 'none';
    }
    
    // Validar formulário
    function validateForm() {
        const tipoDenuncia = document.getElementById('tipo-denuncia');
        const descricao = document.getElementById('descricao');
        
        if (!tipoDenuncia.value) {
            alert('Por favor, selecione o tipo de denúncia.');
            tipoDenuncia.focus();
            return false;
        }
        
        if (!descricao.value.trim()) {
            alert('Por favor, descreva a ocorrência.');
            descricao.focus();
            return false;
        }
        
        return true;
    }
    
    // Salvar denúncia
    function saveDenuncia() {
        const denuncia = {
            id: generateId(),
            tipo: document.getElementById('tipo-denuncia').value,
            dataOcorrencia: document.getElementById('data-ocorrencia').value,
            local: document.getElementById('local-ocorrencia').value,
            envolvidos: document.getElementById('envolvidos').value,
            descricao: document.getElementById('descricao').value,
            dataRegistro: new Date().toISOString(),
            arquivos: []
        };
        
        // Salvar arquivos
        if (selectedFiles.length > 0) {
            denuncia.arquivos = selectedFiles.map(file => ({
                name: file.name,
                type: file.type,
                size: file.size,
                data: null // Será preenchido após leitura
            }));
            
            // Ler e salvar arquivos
            saveFiles(denuncia.id, selectedFiles);
        }
        
        // Salvar denúncia
        const denuncias = getDenuncias();
        denuncias.push(denuncia);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(denuncias));
        
        console.log('Denúncia salva:', denuncia);
    }
    
    // Salvar arquivos
    function saveFiles(denunciaId, files) {
        const filePromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    resolve({
                        name: file.name,
                        type: file.type,
                        data: e.target.result
                    });
                };
                reader.readAsDataURL(file);
            });
        });
        
        Promise.all(filePromises).then(fileData => {
            const savedFiles = JSON.parse(localStorage.getItem(FILES_KEY) || '{}');
            savedFiles[denunciaId] = fileData;
            localStorage.setItem(FILES_KEY, JSON.stringify(savedFiles));
        });
    }
    
    // Recuperar denúncias
    function getDenuncias() {
        const denuncias = localStorage.getItem(STORAGE_KEY);
        return denuncias ? JSON.parse(denuncias) : [];
    }
    
    // Recuperar arquivos
    function getFiles(denunciaId) {
        const savedFiles = JSON.parse(localStorage.getItem(FILES_KEY) || '{}');
        return savedFiles[denunciaId] || [];
    }
    
    // Gerar ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Validar login
    function validateLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const savedLogin = JSON.parse(localStorage.getItem(LOGIN_KEY) || '{"username":"cipa","password":"cipa2024"}');
        
        if (username === savedLogin.username && password === savedLogin.password) {
            return true;
        } else {
            alert('Usuário ou senha incorretos.');
            return false;
        }
    }
    
    // Salvar configurações
    function saveConfig() {
        const newUsername = document.getElementById('newUsername').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('As senhas não coincidem.');
            return false;
        }
        
        const loginData = {
            username: newUsername,
            password: newPassword
        };
        
        localStorage.setItem(LOGIN_KEY, JSON.stringify(loginData));
        document.getElementById('configForm').reset();
        return true;
    }
    
    // Carregar denúncias
    function loadDenuncias() {
        const denuncias = getDenuncias();
        
        if (denuncias.length === 0) {
            denunciasContainer.innerHTML = '<p class="no-denuncias">Nenhuma denúncia recebida até o momento.</p>';
            return;
        }
        
        denuncias.sort((a, b) => new Date(b.dataRegistro) - new Date(a.dataRegistro));
        
        let html = '';
        
        denuncias.forEach(denuncia => {
            const dataRegistro = new Date(denuncia.dataRegistro).toLocaleDateString('pt-BR');
            const dataOcorrencia = denuncia.dataOcorrencia ? 
                new Date(denuncia.dataOcorrencia).toLocaleDateString('pt-BR') : 'Não informada';
            
            const arquivos = getFiles(denuncia.id);
            
            html += `
                <div class="denuncia-item">
                    <div class="denuncia-header">
                        <span class="denuncia-tipo">${formatTipoDenuncia(denuncia.tipo)}</span>
                        <span class="denuncia-data">Recebida em: ${dataRegistro}</span>
                    </div>
                    <div class="denuncia-content">
                        <p><strong>Data da Ocorrência:</strong> ${dataOcorrencia}</p>
                        <p><strong>Local:</strong> ${denuncia.local || 'Não informado'}</p>
                        <p><strong>Envolvidos:</strong> ${denuncia.envolvidos || 'Não informado'}</p>
                        <p><strong>Descrição:</strong> ${denuncia.descricao}</p>
                        ${arquivos.length > 0 ? `
                            <div class="denuncia-evidencias">
                                <p><strong>Evidências anexadas (${arquivos.length}):</strong></p>
                                ${arquivos.map(arquivo => `
                                    <div class="evidencia-item">
                                        ${arquivo.type.startsWith('image/') ? 
                                            `<img src="${arquivo.data}" alt="${arquivo.name}">` : 
                                            `<span class="file-icon">${getFileIcon(arquivo.type)}</span>`
                                        }
                                        <div class="evidencia-info">
                                            <div>${arquivo.name}</div>
                                            <div>${(arquivo.size / 1024 / 1024).toFixed(2)}MB</div>
                                        </div>
                                        <button class="evidencia-download" onclick="downloadFile('${arquivo.name}', '${arquivo.data}')">
                                            Download
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        denunciasContainer.innerHTML = html;
    }
    
    // Carregar estatísticas
    function loadStats() {
        const denuncias = getDenuncias();
        
        if (denuncias.length === 0) {
            statsContainer.innerHTML = '<p>Nenhuma denúncia para exibir estatísticas.</p>';
            return;
        }
        
        const contadorTipos = {};
        denuncias.forEach(denuncia => {
            contadorTipos[denuncia.tipo] = (contadorTipos[denuncia.tipo] || 0) + 1;
        });
        
        let html = `
            <div class="stat-item">
                <div class="stat-value">${denuncias.length}</div>
                <div class="stat-label">Total de Denúncias</div>
            </div>
        `;
        
        for (const tipo in contadorTipos) {
            html += `
                <div class="stat-item">
                    <div class="stat-value">${contadorTipos[tipo]}</div>
                    <div class="stat-label">${formatTipoDenuncia(tipo)}</div>
                </div>
            `;
        }
        
        statsContainer.innerHTML = `<div class="stats-grid">${html}</div>`;
    }
    
    // Formatar tipo de denúncia
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
    
    // Exportar para CSV
    function exportToCSV() {
        const denuncias = getDenuncias();
        
        if (denuncias.length === 0) {
            alert('Não há denúncias para exportar.');
            return;
        }
        
        let csv = 'Tipo;Data Ocorrência;Local;Envolvidos;Descrição;Data Registro;Arquivos\n';
        
        denuncias.forEach(denuncia => {
            const dataOcorrencia = denuncia.dataOcorrencia ? 
                new Date(denuncia.dataOcorrencia).toLocaleDateString('pt-BR') : '';
            const dataRegistro = new Date(denuncia.dataRegistro).toLocaleDateString('pt-BR');
            const arquivos = getFiles(denuncia.id);
            const nomesArquivos = arquivos.map(a => a.name).join(', ');
            
            csv += `"${formatTipoDenuncia(denuncia.tipo)}";"${dataOcorrencia}";"${denuncia.local || ''}";"${denuncia.envolvidos || ''}";"${denuncia.descricao.replace(/"/g, '""')}";"${dataRegistro}";"${nomesArquivos}"\n`;
        });
        
        downloadFile('denuncias.csv', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    }
    
    // Exportar tudo para ZIP
    function exportAllToZip() {
        alert('Em um sistema real, esta função criaria um ZIP com todas as denúncias e arquivos.\\n\\nPara implementação completa, seria necessário usar uma biblioteca como JSZip.');
    }
    
    // Download de arquivo
    window.downloadFile = function(filename, dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
    };
    
    // Limpar todas as denúncias
    function clearAllDenuncias() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(FILES_KEY);
        loadDenuncias();
        loadStats();
        alert('Todas as denúncias foram removidas.');
    }
    
    console.log(`
    ✅ SISTEMA DE DENÚNCIAS ANÔNIMAS
    ⚠️  PARA IMPLANTAÇÃO NA EMPRESA:
    
    1. COMO DISTRIBUIR:
       - Coloque os arquivos em uma pasta compartilhada na rede
       - Ou em um servidor web interno da empresa
       - Todos os colaboradores acessam o mesmo arquivo HTML
    
    2. SEGURANÇA DA CIPA:
       - Credenciais padrão: usuário "cipa", senha "cipa2024"
       - Altere no primeiro acesso em "Configurar Acesso"
    
    3. ARMAZENAMENTO:
       - Dados ficam no navegador de quem acessa
       - Para backup, exporte regularmente via Área da CIPA
       - Em rede, considere um servidor com banco de dados
    
    4. EVIDÊNCIAS:
       - Suporta imagens, PDF, Word, Excel (até 5MB cada)
       - Arquivos são convertidos e armazenados localmente
    `);
});