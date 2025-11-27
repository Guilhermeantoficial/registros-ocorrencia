// js/admin.js - Versão Corrigida
// Lógica específica para a área administrativa da CIPA

let ocorrenciaAtualId = null;
let statusSelecionado = null;

// =============================================
// INICIALIZAÇÃO DA ÁREA ADMIN
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeAdminArea();
});

function initializeAdminArea() {
    setupAdminEventListeners();
    criarModaisDinamicos();
}

function setupAdminEventListeners() {
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
}

function criarModaisDinamicos() {
    // Criar modais apenas se não existirem
    if (!document.getElementById('modalObservacao')) {
        criarModalObservacao();
    }
    if (!document.getElementById('modalStatus')) {
        criarModalStatus();
    }
}

// =============================================
// ÁREA ADMINISTRATIVA - CARREGAR OCORRÊNCIAS
// =============================================

function loadOcorrencias(filteredOcorrencias = null) {
    const container = document.getElementById('ocorrenciasContainer');
    if (!container) return;
    
    const ocorrenciasToShow = filteredOcorrencias || ocorrencias;
    
    console.log('Carregando ocorrências:', ocorrenciasToShow.length);
    
    if (ocorrenciasToShow.length === 0) {
        const mensagem = filteredOcorrencias ? 
            '<div class="no-resultados"><h3>Nenhuma ocorrência encontrada</h3><p>Tente ajustar os filtros ou verificar os critérios de busca.</p></div>' :
            '<div class="no-ocorrencias">Nenhuma ocorrência encontrada.</div>';
        
        container.innerHTML = mensagem;
        return;
    }
    
    let html = '';
    ocorrenciasToShow.forEach(ocorrencia => {
        const status = getStatusOcorrencia(ocorrencia);
        
        html += `
            <div class="ocorrencia-item">
                <div class="ocorrencia-header">
                    <span class="ocorrencia-tipo">${formatTipoOcorrencia(ocorrencia.tipo)}</span>
                    <span class="ocorrencia-data">${formatDate(ocorrencia.dataRegistro)}</span>
                </div>
                <div class="ocorrencia-content">
                    <p><strong>Protocolo:</strong> ${ocorrencia.protocolo}</p>
                    <p><strong>Envolvimento:</strong> ${formatTipoEnvolvimento(ocorrencia.tipoEnvolvimento)}</p>
                    ${ocorrencia.dataOcorrencia ? `<p><strong>Data da Ocorrência:</strong> ${formatDateDisplay(ocorrencia.dataOcorrencia)}</p>` : ''}
                    ${ocorrencia.localOcorrencia ? `<p><strong>Local:</strong> ${formatLocalOcorrencia(ocorrencia.localOcorrencia)}</p>` : ''}
                    <p><strong>Status:</strong> <span class="status-badge ${status.class}">${status.text}</span></p>
                    <p><strong>Descrição:</strong> ${ocorrencia.descricao}</p>
                    ${ocorrencia.observacoes ? `<p><strong>Observações:</strong> ${ocorrencia.observacoes}</p>` : ''}
                </div>
                ${ocorrencia.evidencias.length > 0 ? `
                    <div class="ocorrencia-evidencias">
                        <strong>Evidências (${ocorrencia.evidencias.length}):</strong>
                        ${ocorrencia.evidencias.map(evidencia => `
                            <div class="evidencia-item">
                                <div class="evidencia-info">
                                    <span>${evidencia.name}</span>
                                    <span>(${formatFileSize(evidencia.size)})</span>
                                </div>
                                <button class="evidencia-download" onclick="downloadEvidencia('${ocorrencia.id}', '${evidencia.name}')">
                                    Download
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="ocorrencia-actions">
                    <button onclick="atualizarStatus('${ocorrencia.id}')" class="btn-admin-action">Atualizar Status</button>
                    <button onclick="adicionarObservacao('${ocorrencia.id}')" class="btn-admin-action">Adicionar Observação</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// =============================================
// FUNÇÕES DE STATUS DA OCORRÊNCIA
// =============================================

function getStatusOcorrencia(ocorrencia) {
    if (ocorrencia.status === 'concluida') {
        return { text: 'Concluída', class: 'status-concluida' };
    }
    
    if (ocorrencia.status === 'andamento') {
        return { text: 'Em Andamento', class: 'status-andamento' };
    }
    
    if (ocorrencia.status === 'analise') {
        return { text: 'Em Análise', class: 'status-analise' };
    }
    
    const dias = Math.floor((new Date() - new Date(ocorrencia.dataRegistro)) / (1000 * 60 * 60 * 24));
    
    if (dias < 1) return { text: 'Recebida', class: 'status-recebida' };
    if (dias < 3) return { text: 'Em Análise', class: 'status-analise' };
    if (dias < 7) return { text: 'Em Andamento', class: 'status-andamento' };
    return { text: 'Em Análise Avançada', class: 'status-andamento' };
}

// =============================================
// MODAIS DE OBSERVAÇÃO E STATUS
// =============================================

function adicionarObservacao(ocorrenciaId) {
    ocorrenciaAtualId = ocorrenciaId;
    const ocorrencia = ocorrencias.find(d => d.id === ocorrenciaId);
    
    if (ocorrencia) {
        document.getElementById('textareaObservacao').value = ocorrencia.observacoes || '';
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
    ocorrenciaAtualId = null;
}

function salvarObservacao() {
    if (!ocorrenciaAtualId) return;
    
    const observacao = document.getElementById('textareaObservacao').value.trim();
    const ocorrencia = ocorrencias.find(d => d.id === ocorrenciaAtualId);
    
    if (ocorrencia) {
        ocorrencia.observacoes = observacao;
        ocorrencia.ultimaAtualizacao = new Date().toISOString();
        
        saveOcorrenciasToStorage();
        loadOcorrencias();
        showSyncNotification('Observação salva com sucesso');
        fecharModalObservacao();
        
        // Sincronizar mudança
        sincronizarMudancaIndividual(ocorrencia);
    }
}

function atualizarStatus(ocorrenciaId) {
    ocorrenciaAtualId = ocorrenciaId;
    const ocorrencia = ocorrencias.find(d => d.id === ocorrenciaId);
    
    if (ocorrencia) {
        statusSelecionado = ocorrencia.status || 'recebida';
        atualizarSelecaoStatus();
        document.getElementById('textareaStatusObs').value = '';
        atualizarContadorStatusObs();
        
        // Mostrar o modal
        const modalStatus = document.getElementById('modalStatus');
        modalStatus.style.display = 'block';
        
        // Focar no modal
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
    ocorrenciaAtualId = null;
    statusSelecionado = null;
}

function selecionarStatus(status) {
    statusSelecionado = status;
    atualizarSelecaoStatus();
    
    // Scroll suave para a opção selecionada
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
    if (!ocorrenciaAtualId || !statusSelecionado) {
        alert('Por favor, selecione um status.');
        return;
    }
    
    const observacao = document.getElementById('textareaStatusObs').value.trim();
    const ocorrencia = ocorrencias.find(d => d.id === ocorrenciaAtualId);
    
    if (ocorrencia) {
        ocorrencia.status = statusSelecionado;
        ocorrencia.ultimaAtualizacao = new Date().toISOString();
        
        // Adicionar observação se fornecida
        if (observacao) {
            // Se já existem observações, adicionar nova linha
            if (ocorrencia.observacoes) {
                ocorrencia.observacoes += '\n\n--- Atualização de Status ---\n' + observacao;
            } else {
                ocorrencia.observacoes = observacao;
            }
        }
        
        saveOcorrenciasToStorage();
        loadOcorrencias();
        showSyncNotification('Status atualizado com sucesso');
        fecharModalStatus();
        
        // Sincronizar mudança
        sincronizarMudancaIndividual(ocorrencia);
    }
}

function sincronizarMudancaIndividual(ocorrencia) {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(SYNC_CHANNEL);
            channel.postMessage({
                type: 'OCORRENCIA_UPDATED',
                ocorrencia: ocorrencia,
                timestamp: Date.now(),
                deviceId: getDeviceId()
            });
        } catch (error) {
            console.log('Erro ao sincronizar mudança individual');
        }
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
    
    let filteredOcorrencias = ocorrencias;
    
    // Filtro por tipo
    if (tipo) {
        filteredOcorrencias = filteredOcorrencias.filter(d => d.tipo === tipo);
        console.log('Após filtro tipo:', filteredOcorrencias.length);
    }
    
    // Filtro por data
    if (data) {
        filteredOcorrencias = filteredOcorrencias.filter(d => {
            if (!d.dataOcorrencia) return false;
            return d.dataOcorrencia === data;
        });
        console.log('Após filtro data:', filteredOcorrencias.length);
    }
    
    // Filtro por local
    if (local) {
        filteredOcorrencias = filteredOcorrencias.filter(d => {
            if (!d.localOcorrencia) return false;
            return d.localOcorrencia === local;
        });
        console.log('Após filtro local:', filteredOcorrencias.length);
    }
    
    loadOcorrencias(filteredOcorrencias);
    updateStats(filteredOcorrencias);
    
    // Mostrar contador de resultados
    mostrarContadorResultados(filteredOcorrencias.length);
}

function clearFilterHandler() {
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterData').value = '';
    document.getElementById('filterLocal').value = '';
    loadOcorrencias();
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
    
    const total = ocorrencias.length;
    if (quantidade === total) {
        contador.textContent = `Mostrando todas as ${total} ocorrências`;
    } else {
        contador.textContent = `${quantidade} de ${total} ocorrências correspondem aos filtros`;
    }
}

function updateStats(filteredOcorrencias) {
    const stats = {
        total: filteredOcorrencias.length,
        porTipo: {},
        porStatus: {},
        ultimoMes: filteredOcorrencias.filter(d => {
            const data = new Date(d.dataRegistro);
            const umMesAtras = new Date();
            umMesAtras.setMonth(umMesAtras.getMonth() - 1);
            return data > umMesAtras;
        }).length
    };
    
    filteredOcorrencias.forEach(ocorrencia => {
        stats.porTipo[ocorrencia.tipo] = (stats.porTipo[ocorrencia.tipo] || 0) + 1;
        const status = getStatusOcorrencia(ocorrencia).text;
        stats.porStatus[status] = (stats.porStatus[status] || 0) + 1;
    });
    
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;
    
    let statsHtml = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total de Ocorrências</div>
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
                <div class="stat-label">${formatTipoOcorrencia(tipo)}</div>
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
    updateStats(ocorrencias);
}

// =============================================
// EXPORTAÇÃO (mantida aqui para compatibilidade)
// =============================================

function exportToCSV() {
    if (ocorrencias.length === 0) {
        alert('Não há ocorrências para exportar.');
        return;
    }
    
    const headers = [
        'Protocolo',
        'Tipo de Ocorrência',
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
    
    ocorrencias.forEach(ocorrencia => {
        const status = getStatusOcorrencia(ocorrencia);
        
        // Gerar nomes de arquivos aleatórios baseados no protocolo
        const nomesArquivos = ocorrencia.evidencias.map((evidencia, index) => {
            const extensao = evidencia.name.split('.').pop().toLowerCase();
            const randomId = Math.random().toString(36).substr(2, 6).toUpperCase();
            return `evidencia_${ocorrencia.protocolo}_${index + 1}_${randomId}.${extensao}`;
        });
        
        const row = [
            ocorrencia.protocolo,
            formatTipoOcorrencia(ocorrencia.tipo),
            formatTipoEnvolvimento(ocorrencia.tipoEnvolvimento),
            ocorrencia.dataOcorrencia || 'N/A',
            formatLocalOcorrencia(ocorrencia.localOcorrencia) || 'N/A',
            `"${ocorrencia.descricao.replace(/"/g, '""')}"`,
            formatDateForCSV(ocorrencia.dataRegistro),
            status.text,
            formatDateForCSV(ocorrencia.ultimaAtualizacao || ocorrencia.dataRegistro),
            ocorrencia.evidencias.length.toString(),
            `"${nomesArquivos.join(', ')}"`
        ];
        csvLines.push(row.join(';'));
    });
    
    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ocorrencias_cipa_${formatDate(new Date().toISOString(), 'file')}.csv`;
    link.click();
}

function formatDateForCSV(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

function downloadEvidencia(ocorrenciaId, fileName) {
    const ocorrencia = ocorrencias.find(d => d.id === ocorrenciaId);
    if (!ocorrencia) return;
    
    const evidencia = ocorrencia.evidencias.find(e => e.name === fileName);
    if (!evidencia) return;
    
    const link = document.createElement('a');
    link.href = evidencia.data;
    link.download = fileName;
    link.click();
}