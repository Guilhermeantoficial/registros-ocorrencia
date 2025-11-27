// js/acompanhar.js
// Lógica específica para a página de acompanhamento

document.addEventListener('DOMContentLoaded', function() {
    initializeAcompanhamentoPage();
});

function initializeAcompanhamentoPage() {
    setupAcompanhamentoEventListeners();
    checkProtocoloURL();
    iniciarEfeitoPulse();
}

function setupAcompanhamentoEventListeners() {
    // Acompanhamento
    const inputProtocolo = document.getElementById('inputProtocolo');
    if (inputProtocolo) {
        inputProtocolo.addEventListener('input', validarProtocoloEmTempoReal);
        inputProtocolo.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                acompanharOcorrencia();
            }
        });
    }
}

// =============================================
// ACOMPANHAMENTO DE OCORRÊNCIAS
// =============================================

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

function acompanharOcorrencia() {
    const protocoloInput = document.getElementById('inputProtocolo');
    const statusContainer = document.getElementById('statusOcorrencia');
    
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
    
    const ocorrencia = ocorrencias.find(d => d.protocolo === protocolo);
    
    if (!ocorrencia) {
        statusContainer.innerHTML = `
            <div class="status-error">
                ❌ Protocolo não encontrado.<br>
                <small>Verifique o número digitado e tente novamente.</small>
            </div>
        `;
        return;
    }
    
    const status = getStatusOcorrencia(ocorrencia);
    const dias = Math.floor((new Date() - new Date(ocorrencia.dataRegistro)) / (1000 * 60 * 60 * 24));
    
    statusContainer.innerHTML = `
        <div class="status-info" style="animation: slideInUp 0.5s ease;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 3rem; margin-bottom: 10px;">${getStatusEmoji(status.text)}</div>
                <h3 style="color: #2c3e50; margin: 0;">Status da Ocorrência</h3>
            </div>
            
            <div style="display: grid; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Protocolo:</strong>
                    <code style="background: #f8f9fa; padding: 5px 10px; border-radius: 5px;">${ocorrencia.protocolo}</code>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Data do Registro:</strong>
                    <span>${formatDate(ocorrencia.dataRegistro)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Status:</strong>
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Última Atualização:</strong>
                    <span>${formatDate(ocorrencia.ultimaAtualizacao || ocorrencia.dataRegistro)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Tempo decorrido:</strong>
                    <span>${dias} dia(s)</span>
                </div>
                
                <div style="display: flex; justify-content: space-between;">
                    <strong>Tipo:</strong>
                    <span>${formatTipoOcorrencia(ocorrencia.tipo)}</span>
                </div>
                
                ${ocorrencia.localOcorrencia ? `
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Local:</strong>
                        <span>${formatLocalOcorrencia(ocorrencia.localOcorrencia)}</span>
                    </div>
                ` : ''}
            </div>
            
            ${ocorrencia.observacoes ? `
                <div style="margin-top: 20px; padding: 15px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <strong>📝 Observações da CIPA:</strong>
                    <p style="margin: 10px 0 0 0; color: #856404;">${ocorrencia.observacoes}</p>
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
        'Recebida': 'Sua ocorrência foi recebida e será analisada pela CIPA em breve.',
        'Em Análise': 'Sua ocorrência está sendo analisada pela equipe da CIPA.',
        'Em Andamento': 'A CIPA está tomando as medidas cabíveis para resolver a situação.',
        'Em Análise Avançada': 'Sua ocorrência está em fase avançada de análise.',
        'Concluída': 'O processo referente à sua ocorrência foi concluído.'
    };
    
    return messages[status] || 'Sua ocorrência está sendo processada pela CIPA.';
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
                acompanharOcorrencia();
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